/**
 * Document Sync Service
 * Core business logic for syncing documents from SmartAdvocate
 * Refactored for reusability across server actions, scripts, and cron jobs
 */

import type { SmartAdvocateDocument } from '../crm/smartadvocate/types';
import { generateDocumentHash } from '../utils/document-hash';

export interface DocumentSyncConfig {
  fromDate: string;
  toDate: string;
  categoryIDs?: number[];
  pageSize?: number;
}

export interface DocumentSyncResult {
  totalDocuments: number;
  filteredDocuments: number;
  processedDocuments: number;
  successful: number;
  failed: number;
  skipped: number;
  updated: number; // Documents updated due to modified date
  errors: Array<{ documentID: number; error: string }>;
}

export interface DocumentProcessor {
  getDocumentsByDate: (params: {
    modifiedFromDateTime: string;
    modifiedToDateTime: string;
    currentPage: number;
    pageSize: number;
  }) => Promise<{
    documents?: SmartAdvocateDocument[];
    pageRequest?: { totalPages?: number };
  }>;
  getDocumentContent: (documentID: number) => Promise<{
    dataUri: string;
    contentType: string;
    size: number;
  }>;
  findInvoiceByDocumentHash: (hash: string) => Promise<{
    id: string;
    status: string;
    saModifiedDate?: Date | null;
  } | null>;
  processDocument: (doc: SmartAdvocateDocument, content: {
    dataUri: string;
    contentType: string;
    size: number;
  }) => Promise<{ error?: string; data?: { id: string } }>;
  createSyncError: (error: {
    documentID: number;
    error: string;
    errorType: 'Unsupported File Type' | 'Processing Error' | 'API Error' | 'Other';
    doc: SmartAdvocateDocument;
    contentType?: string;
    fileSize?: number;
  }) => Promise<void>;
}

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/heic',
];

const DEFAULT_CATEGORY_IDS = [78, 1080]; // Invoices (78) and Receipts (1080)
const DEFAULT_PAGE_SIZE = 100;
const DOCUMENT_DELAY_MS = 500;
const PAGE_DELAY_MS = 1000;

/**
 * Extract document metadata for logging
 */
function extractDocumentMetadata(doc: SmartAdvocateDocument) {
  return {
    documentID: doc.documentID,
    documentName: doc.documentName,
    caseID: doc.caseID,
    caseNumber: doc.caseNumber,
    categoryID: doc.categoryID,
    categoryName: doc.categoryName,
    description: doc.description,
    comments: doc.comments,
    createdDate: doc.createdDate,
    modifiedDate: doc.modifiedDate,
  };
}

/**
 * Check if document needs to be updated based on modified date
 * Returns true if document exists AND has been modified AND is not yet processed
 */
function shouldUpdateDocument(
  existingInvoice: { status: string; saModifiedDate?: Date | null } | null,
  docModifiedDate?: string
): boolean {
  if (!existingInvoice || !docModifiedDate) {
    return false;
  }

  // Only update if invoice is still in Draft or Review status (not yet processed)
  const canUpdate = existingInvoice.status === 'Draft' || existingInvoice.status === 'Review';
  if (!canUpdate) {
    return false;
  }

  // Check if document has been modified since last sync
  const existingModifiedDate = existingInvoice.saModifiedDate;
  if (!existingModifiedDate) {
    return true; // No modified date recorded, assume it needs update
  }

  const docDate = new Date(docModifiedDate);
  const existingDate = new Date(existingModifiedDate);

  return docDate > existingDate;
}

/**
 * Filter documents by category IDs
 */
function filterDocumentsByCategory(
  documents: SmartAdvocateDocument[],
  categoryIDs: number[]
): SmartAdvocateDocument[] {
  return documents.filter((doc) => categoryIDs.includes(doc.categoryID));
}

/**
 * Core sync logic - processes documents from SmartAdvocate
 * @param config Sync configuration
 * @param processor Document processor implementation (server action, script, etc.)
 * @param logger Optional logger function
 */
export async function syncDocumentsCore(
  config: DocumentSyncConfig,
  processor: DocumentProcessor,
  logger?: (message: string) => void
): Promise<DocumentSyncResult> {
  const log = logger || console.log;

  const categoryIDs = config.categoryIDs || DEFAULT_CATEGORY_IDS;
  const pageSize = config.pageSize || DEFAULT_PAGE_SIZE;

  log(`[Document Sync] Starting sync from ${config.fromDate} to ${config.toDate}`);
  log(`[Document Sync] Filtering by category IDs: ${categoryIDs.join(', ')}`);

  const result: DocumentSyncResult = {
    totalDocuments: 0,
    filteredDocuments: 0,
    processedDocuments: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    updated: 0,
    errors: [],
  };

  let currentPage = 0;
  let hasMorePages = true;

  // Fetch all pages of documents
  while (hasMorePages) {
    log(`[Document Sync] Fetching page ${currentPage}...`);

    const response = await processor.getDocumentsByDate({
      modifiedFromDateTime: config.fromDate,
      modifiedToDateTime: config.toDate,
      currentPage,
      pageSize,
    });

    const allDocuments = response.documents || [];
    result.totalDocuments += allDocuments.length;

    // Filter documents by category
    const filteredDocs = filterDocumentsByCategory(allDocuments, categoryIDs);
    result.filteredDocuments += filteredDocs.length;

    log(
      `[Document Sync] Page ${currentPage}: ${allDocuments.length} total, ${filteredDocs.length} filtered`
    );

    // Process each filtered document
    for (const doc of filteredDocs) {
      try {
        const metadata = extractDocumentMetadata(doc);

        // Generate hash from document ID and case number
        const documentHash = generateDocumentHash(metadata.documentID, metadata.caseNumber);

        // Check if this document already exists
        const existingInvoice = await processor.findInvoiceByDocumentHash(documentHash);

        // Determine if we should process this document
        let shouldProcess = false;
        let isUpdate = false;

        if (!existingInvoice) {
          // New document
          shouldProcess = true;
          isUpdate = false;
        } else if (shouldUpdateDocument(existingInvoice, metadata.modifiedDate)) {
          // Existing document with newer modified date and not yet processed
          shouldProcess = true;
          isUpdate = true;
          result.updated++;
          log(
            `[Document Sync] Document ${metadata.documentID} has been modified and will be updated`
          );
        } else {
          // Skip: document exists and doesn't need update
          result.skipped++;
          log(
            `[Document Sync] Skipping document ${metadata.documentID} (Case: ${metadata.caseNumber}) - already exists${existingInvoice.status !== 'Draft' && existingInvoice.status !== 'Review' ? ' and processed' : ''}`
          );
          continue;
        }

        if (!shouldProcess) {
          continue;
        }

        result.processedDocuments++;
        log(
          `[Document Sync] ${isUpdate ? 'Updating' : 'Processing'} document ${metadata.documentID} (${metadata.documentName})`
        );

        // Fetch document content
        const content = await processor.getDocumentContent(metadata.documentID);
        log(
          `[Document Sync] Fetched content for document ${metadata.documentID} (${content.size} bytes, ${content.contentType})`
        );

        // Skip unsupported file types
        if (!SUPPORTED_FILE_TYPES.includes(content.contentType)) {
          result.failed++;
          const errorMessage = `Unsupported file type: ${content.contentType}. Only PDF and images are supported.`;
          result.errors.push({
            documentID: metadata.documentID,
            error: errorMessage,
          });

          await processor.createSyncError({
            documentID: doc.documentID,
            error: errorMessage,
            errorType: 'Unsupported File Type',
            doc,
            contentType: content.contentType,
            fileSize: content.size,
          });

          continue;
        }

        // Process the document
        const processResult = await processor.processDocument(doc, content);

        if (processResult.error) {
          result.failed++;
          result.errors.push({
            documentID: metadata.documentID,
            error: processResult.error,
          });
          log(
            `[Document Sync] Failed to process document ${metadata.documentID}: ${processResult.error}`
          );

          await processor.createSyncError({
            documentID: doc.documentID,
            error: processResult.error,
            errorType: 'Processing Error',
            doc,
            contentType: content.contentType,
            fileSize: content.size,
          });
        } else {
          result.successful++;
          log(
            `[Document Sync] Successfully ${isUpdate ? 'updated' : 'processed'} document ${metadata.documentID} -> Invoice ID: ${processResult.data?.id}`
          );
        }

        // Add a small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, DOCUMENT_DELAY_MS));
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          documentID: doc.documentID,
          error: errorMessage,
        });
        log(`[Document Sync] Error processing document ${doc.documentID}: ${errorMessage}`);

        await processor.createSyncError({
          documentID: doc.documentID,
          error: errorMessage,
          errorType: 'Other',
          doc,
        });
      }
    }

    // Check if there are more pages
    const totalPages = response.pageRequest?.totalPages ?? 0;
    hasMorePages = currentPage < totalPages - 1;
    currentPage++;

    // Add a delay between pages
    if (hasMorePages) {
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    }
  }

  log(`[Document Sync] Sync completed:`);
  log(`  Total documents: ${result.totalDocuments}`);
  log(`  Filtered documents: ${result.filteredDocuments}`);
  log(`  Processed: ${result.processedDocuments}`);
  log(`  Successful: ${result.successful}`);
  log(`  Failed: ${result.failed}`);
  log(`  Skipped (duplicates): ${result.skipped}`);
  log(`  Updated (modified): ${result.updated}`);

  return result;
}

/**
 * Get yesterday's date range (from yesterday 00:00:00 to today 00:00:00)
 * Used for automated daily syncs
 */
export function getYesterdayDateRange(): { fromDate: string; toDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    fromDate: yesterday.toISOString().split('T')[0], // YYYY-MM-DD
    toDate: today.toISOString().split('T')[0], // YYYY-MM-DD
  };
}
