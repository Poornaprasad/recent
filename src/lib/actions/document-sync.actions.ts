/**
 * Document sync server actions
 * Next.js server actions for syncing documents from SmartAdvocate
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  getDocumentsByDate,
  getDocumentContent,
  filterDocumentsByCategory,
  extractDocumentMetadata,
} from '../crm/smartadvocate/document';
import { getConfig } from '../crm/smartadvocate/utils';
import { processInvoiceAction } from './invoice.actions';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import type { SmartAdvocateDocument } from '../crm/smartadvocate/types';

export interface DocumentSyncResult {
  totalDocuments: number;
  filteredDocuments: number;
  processedDocuments: number;
  successful: number;
  failed: number;
  errors: Array<{ documentID: number; error: string }>;
}

/**
 * Sync documents from SmartAdvocate API
 * Fetches documents by date range, filters by category (Invoices/Receipts),
 * and processes each document through the invoice processing flow
 */
export async function syncDocumentsFromSmartAdvocate(
  options?: {
    fromDate?: string;
    toDate?: string;
    categoryIDs?: number[];
  }
): Promise<ActionResult<DocumentSyncResult>> {
  return withActionHandler(async () => {
    const config = getConfig();

    // Get date range from options or environment variables
    const fromDate = options?.fromDate || config.SA_DOCUMENT_SYNC_FROM_DATE;
    const toDate = options?.toDate || config.SA_DOCUMENT_SYNC_TO_DATE;

    if (!fromDate || !toDate) {
      throw new Error(
        'Date range not provided. Set SA_DOCUMENT_SYNC_FROM_DATE and SA_DOCUMENT_SYNC_TO_DATE in .env or provide fromDate/toDate in options.'
      );
    }

    // Default category IDs: 78 (Invoices) and 1080 (Receipts)
    const categoryIDs = options?.categoryIDs || [78, 1080];

    console.log(`[Document Sync] Starting sync from ${fromDate} to ${toDate}`);
    console.log(`[Document Sync] Filtering by category IDs: ${categoryIDs.join(', ')}`);

    const result: DocumentSyncResult = {
      totalDocuments: 0,
      filteredDocuments: 0,
      processedDocuments: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    let currentPage = 0;
    const pageSize = config.SA_DOCUMENT_SYNC_PAGE_SIZE || 100;
    let hasMorePages = true;

    // Fetch all pages of documents
    while (hasMorePages) {
      console.log(`[Document Sync] Fetching page ${currentPage}...`);

      const response = await getDocumentsByDate({
        modifiedFromDateTime: fromDate,
        modifiedToDateTime: toDate,
        currentPage,
        pageSize,
      });

      const allDocuments = response.documents || [];
      result.totalDocuments += allDocuments.length;

      // Filter documents by category
      const filteredDocs = filterDocumentsByCategory(allDocuments, categoryIDs);
      result.filteredDocuments += filteredDocs.length;

      console.log(
        `[Document Sync] Page ${currentPage}: ${allDocuments.length} total, ${filteredDocs.length} filtered`
      );

      // Process each filtered document
      for (const doc of filteredDocs) {
        try {
          result.processedDocuments++;

          // Extract metadata
          const metadata = extractDocumentMetadata(doc);
          console.log(
            `[Document Sync] Processing document ${metadata.documentID} (${metadata.documentName})`
          );

          // Fetch document content
          const content = await getDocumentContent(metadata.documentID);
          console.log(
            `[Document Sync] Fetched content for document ${metadata.documentID} (${content.size} bytes, ${content.contentType})`
          );

          // Process the document through invoice processing
          const processResult = await processInvoiceAction({
            invoiceDataUri: content.dataUri,
            caseNumber: metadata.caseNumber, // Auto-populate case number from SmartAdvocate
          });

          if (processResult.error) {
            result.failed++;
            result.errors.push({
              documentID: metadata.documentID,
              error: processResult.error,
            });
            console.error(
              `[Document Sync] Failed to process document ${metadata.documentID}: ${processResult.error}`
            );
          } else {
            result.successful++;
            console.log(
              `[Document Sync] Successfully processed document ${metadata.documentID} -> Invoice ID: ${processResult.data?.id}`
            );
          }

          // Add a small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            documentID: doc.documentID,
            error: errorMessage,
          });
          console.error(
            `[Document Sync] Error processing document ${doc.documentID}: ${errorMessage}`
          );
        }
      }

      // Check if there are more pages
      const totalPages = response.pageRequest?.totalPages ?? 0;
      hasMorePages = currentPage < totalPages - 1;
      currentPage++;

      // Add a delay between pages
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Document Sync] Sync completed:`);
    console.log(`  Total documents: ${result.totalDocuments}`);
    console.log(`  Filtered documents: ${result.filteredDocuments}`);
    console.log(`  Processed: ${result.processedDocuments}`);
    console.log(`  Successful: ${result.successful}`);
    console.log(`  Failed: ${result.failed}`);

    // Revalidate paths
    revalidatePath('/invoices');
    revalidatePath('/approvals');
    revalidatePath('/dashboard');

    return result;
  }, 'Failed to sync documents from SmartAdvocate');
}

/**
 * Get documents metadata from SmartAdvocate (without processing)
 * Useful for previewing what documents would be synced
 */
export async function previewDocumentsFromSmartAdvocate(
  options?: {
    fromDate?: string;
    toDate?: string;
    categoryIDs?: number[];
    maxPages?: number;
  }
): Promise<ActionResult<{ documents: Array<ReturnType<typeof extractDocumentMetadata>>; totalPages: number }>> {
  return withActionHandler(async () => {
    const config = getConfig();

    // Get date range from options or environment variables
    const fromDate = options?.fromDate || config.SA_DOCUMENT_SYNC_FROM_DATE;
    const toDate = options?.toDate || config.SA_DOCUMENT_SYNC_TO_DATE;

    if (!fromDate || !toDate) {
      throw new Error(
        'Date range not provided. Set SA_DOCUMENT_SYNC_FROM_DATE and SA_DOCUMENT_SYNC_TO_DATE in .env or provide fromDate/toDate in options.'
      );
    }

    // Default category IDs: 78 (Invoices) and 1080 (Receipts)
    const categoryIDs = options?.categoryIDs || [78, 1080];
    const maxPages = options?.maxPages ?? 1;

    const allDocuments: SmartAdvocateDocument[] = [];
    let currentPage = 0;
    const pageSize = config.SA_DOCUMENT_SYNC_PAGE_SIZE || 1000;

    // Fetch pages
    while (currentPage < maxPages) {
      const response = await getDocumentsByDate({
        modifiedFromDateTime: fromDate,
        modifiedToDateTime: toDate,
        currentPage,
        pageSize,
      });

      allDocuments.push(...(response.documents || []));

      const totalPages = response.pageRequest?.totalPages ?? 0;
      if (currentPage >= totalPages - 1) {
        break;
      }
      currentPage++;
    }

    // Filter documents by category
    const filteredDocs = filterDocumentsByCategory(allDocuments, categoryIDs);

    // Extract metadata
    const documents = filteredDocs.map(extractDocumentMetadata);

    return {
      documents,
      totalPages: Math.ceil((allDocuments.length || 0) / 100),
    };
  }, 'Failed to preview documents from SmartAdvocate');
}

