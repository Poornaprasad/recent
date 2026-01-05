/**
 * Sync documents from SmartAdvocate
 * 
 * This script syncs documents from SmartAdvocate API and processes them as invoices.
 * Uses script-compatible functions (not server actions) so it can run standalone.
 * 
 * Usage:
 *   npm run sync:documents [fromDate] [toDate]
 * 
 * Environment variables:
 *   - SA_DOCUMENT_SYNC_FROM_DATE (e.g., "2024-01-01")
 *   - SA_DOCUMENT_SYNC_TO_DATE (e.g., "2024-12-31")
 *   - SA_DOCUMENT_SYNC_PAGE_SIZE (default: 100)
 *   - SA_DOCUMENT_SYNC_CATEGORY_IDS (comma-separated, default: "78,1080")
 *   - EXCLUDE_CASE_NUMBER_PREFIX (default: "TBF-") - Case numbers starting with this prefix will be excluded
 */

import 'dotenv/config';
import {
  getDocumentsByDate,
  getDocumentContent,
  filterDocumentsByCategory,
  extractDocumentMetadata,
} from '../src/lib/crm/smartadvocate/document.script';
import { getConfig } from '../src/lib/crm/smartadvocate/utils';
import { mapSmartAdvocateDocumentToInvoice } from '../src/lib/utils/smartadvocate-mapper';
import { processInvoice } from '../src/lib/services/invoice.service.script';
import { generateDocumentHash } from '../src/lib/utils/document-hash';
import { getDb, initDb, closeDb } from '../src/lib/db/script';
import { invoices, documentSyncErrors } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

interface DocumentSyncResult {
  totalDocuments: number;
  filteredDocuments: number;
  processedDocuments: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ documentID: number; error: string }>;
}

async function findInvoiceByDocumentHash(documentHash: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(invoices)
    .where(eq(invoices.documentHash, documentHash))
    .limit(1);
  return result[0] || null;
}

async function createDocumentSyncError(error: {
  documentID: number;
  error: string;
  errorType: 'Unsupported File Type' | 'Processing Error' | 'API Error' | 'Other';
  caseID?: number;
  caseNumber?: string;
  documentName?: string;
  contentType?: string;
  fileSize?: number;
  categoryID?: number;
  categoryName?: string;
  subCategoryID?: number;
  subCategoryName?: string;
  subSubCategoryID?: number;
  subSubSubCategoryID?: number;
  description?: string;
  comments?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  saFromUniqueContactId?: number;
  saToContactName?: string;
  saFromContactName?: string;
  saDocType?: string;
  saTemplateId?: number;
  saAttachFlag?: boolean;
  saCreatedUserId?: number;
  saModifiedUserId?: number;
  saMedProvUniqueContactId?: number;
  saIsReviewed?: boolean;
  saToUniqueContactId?: number;
  saDocumentDate?: Date;
  saPriority?: number;
  saPriorityName?: string;
  saDocumentDirection?: number;
  saDirectionName?: string;
  saDocumentOrigin?: number;
  saOriginName?: string;
  saIsSharedInPortal?: boolean;
  saIsSharedWithEveryoneInPortal?: boolean;
  saCaseDocumentId?: number;
  saDeliveryMethodId?: number;
  saDeliveryName?: string;
}) {
  const db = getDb();
  const id = nanoid();
  
  await db.insert(documentSyncErrors).values({
    id,
    documentID: error.documentID,
    error: error.error,
    errorType: error.errorType,
    caseID: error.caseID,
    caseNumber: error.caseNumber,
    documentName: error.documentName,
    contentType: error.contentType,
    fileSize: error.fileSize,
    categoryID: error.categoryID,
    categoryName: error.categoryName,
    subCategoryID: error.subCategoryID,
    subCategoryName: error.subCategoryName,
    subSubCategoryID: error.subSubCategoryID,
    subSubSubCategoryID: error.subSubSubCategoryID,
    description: error.description,
    comments: error.comments,
    createdDate: error.createdDate,
    modifiedDate: error.modifiedDate,
    saFromUniqueContactId: error.saFromUniqueContactId,
    saToContactName: error.saToContactName,
    saFromContactName: error.saFromContactName,
    saDocType: error.saDocType,
    saTemplateId: error.saTemplateId,
    saAttachFlag: error.saAttachFlag,
    saCreatedUserId: error.saCreatedUserId,
    saModifiedUserId: error.saModifiedUserId,
    saMedProvUniqueContactId: error.saMedProvUniqueContactId,
    saIsReviewed: error.saIsReviewed,
    saToUniqueContactId: error.saToUniqueContactId,
    saDocumentDate: error.saDocumentDate,
    saPriority: error.saPriority,
    saPriorityName: error.saPriorityName,
    saDocumentDirection: error.saDocumentDirection,
    saDirectionName: error.saDirectionName,
    saDocumentOrigin: error.saDocumentOrigin,
    saOriginName: error.saOriginName,
    saIsSharedInPortal: error.saIsSharedInPortal,
    saIsSharedWithEveryoneInPortal: error.saIsSharedWithEveryoneInPortal,
    saCaseDocumentId: error.saCaseDocumentId,
    saDeliveryMethodId: error.saDeliveryMethodId,
    saDeliveryName: error.saDeliveryName,
  });
}

async function syncDocuments() {
  try {
    console.log('🚀 Starting document sync from SmartAdvocate...\n');
    
    // Initialize database connection
    await initDb();

    // Get date range from command line arguments or environment variables
    const args = process.argv.slice(2);
    const fromDate = args[0] || process.env.SA_DOCUMENT_SYNC_FROM_DATE;
    const toDate = args[1] || process.env.SA_DOCUMENT_SYNC_TO_DATE;

    if (!fromDate || !toDate) {
      console.error('❌ Error: Date range required');
      console.error('\nUsage:');
      console.error('  npm run sync:documents [fromDate] [toDate]');
      console.error('\nExample:');
      console.error('  npm run sync:documents 2024-01-01 2024-12-31');
      console.error('\nOr set environment variables:');
      console.error('  SA_DOCUMENT_SYNC_FROM_DATE=2024-01-01');
      console.error('  SA_DOCUMENT_SYNC_TO_DATE=2024-12-31');
      process.exit(1);
    }

    const config = getConfig();
    const pageSize = parseInt(process.env.SA_DOCUMENT_SYNC_PAGE_SIZE || '100', 10);
    const categoryIDs = process.env.SA_DOCUMENT_SYNC_CATEGORY_IDS
      ? process.env.SA_DOCUMENT_SYNC_CATEGORY_IDS.split(',').map(id => parseInt(id.trim(), 10))
      : [78, 1080]; // Default: Invoices (78) and Receipts (1080)

    console.log(`📅 Date range: ${fromDate} to ${toDate}`);
    console.log(`📄 Page size: ${pageSize}`);
    console.log(`🏷️  Category IDs: ${categoryIDs.join(', ')}\n`);

    const result: DocumentSyncResult = {
      totalDocuments: 0,
      filteredDocuments: 0,
      processedDocuments: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    let currentPage = 0;
    let hasMorePages = true;

    // Fetch all pages of documents
    while (hasMorePages) {
      console.log(`📄 Fetching page ${currentPage}...`);

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

      console.log(`   Found ${allDocuments.length} total, ${filteredDocs.length} filtered documents\n`);

      // Process each filtered document
      for (const doc of filteredDocs) {
        try {
          // Extract metadata
          const metadata = extractDocumentMetadata(doc);
          
          // Skip documents with excluded case number prefix
          const excludePrefix = process.env.EXCLUDE_CASE_NUMBER_PREFIX || 'TBF-';
          if (metadata.caseNumber && metadata.caseNumber.startsWith(excludePrefix)) {
            result.skipped++;
            console.log(`⏭️  Skipping document ${metadata.documentID} (Case: ${metadata.caseNumber} - excluded prefix: ${excludePrefix})`);
            continue;
          }
          
          // Generate hash from document ID and case number
          const documentHash = generateDocumentHash(metadata.documentID, metadata.caseNumber);
          
          // Check if this document already exists (duplicate check)
          const existingInvoice = await findInvoiceByDocumentHash(documentHash);
          if (existingInvoice) {
            result.skipped++;
            console.log(`⏭️  Skipping duplicate document ${metadata.documentID} (Case: ${metadata.caseNumber})`);
            continue;
          }

          result.processedDocuments++;
          console.log(`🔄 Processing document ${metadata.documentID} (${metadata.documentName})`);

          // Fetch document content
          const content = await getDocumentContent(metadata.documentID);
          console.log(`   Fetched content: ${content.size} bytes, ${content.contentType}`);

          // Check file extension for additional type detection
          const getFileExtension = (filename: string): string => {
            const parts = filename.split('.');
            return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
          };
          const fileExtension = getFileExtension(metadata.documentName || '');

          // Skip unsupported file types
          const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/heic'];
          const supportedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'doc', 'docx'];
          
          // Allow if content type is supported OR if file extension suggests a supported document type
          const isContentTypeSupported = supportedTypes.includes(content.contentType);
          const isExtensionSupported = supportedExtensions.includes(fileExtension);
          
          // Special handling: if content type is octet-stream but extension suggests a document, allow it
          const isOctetStreamWithDocExtension = content.contentType === 'application/octet-stream' && 
            (fileExtension === 'doc' || fileExtension === 'docx');
          
          if (!isContentTypeSupported && !isExtensionSupported && !isOctetStreamWithDocExtension) {
            result.failed++;
            const errorMessage = `Unsupported file type: ${content.contentType}${fileExtension ? ` (extension: .${fileExtension})` : ''}`;
            result.errors.push({
              documentID: metadata.documentID,
              error: errorMessage,
            });
            
            await createDocumentSyncError({
              documentID: metadata.documentID,
              error: errorMessage,
              errorType: 'Unsupported File Type',
              caseID: metadata.caseID,
              caseNumber: metadata.caseNumber,
              documentName: metadata.documentName,
              contentType: content.contentType,
              fileSize: content.size,
              categoryID: metadata.categoryID,
              description: metadata.description ?? undefined,
              createdDate: metadata.createdDate ? new Date(metadata.createdDate) : undefined,
              modifiedDate: metadata.modifiedDate ? new Date(metadata.modifiedDate) : undefined,
              ...mapSmartAdvocateDocumentToInvoice(doc),
            });
            
            console.log(`   ❌ ${errorMessage}\n`);
            continue;
          }

          // Use the dataUri directly from the content
          const invoiceDataUri = content.dataUri;

          // Process invoice
          const processResult = await processInvoice(
            { invoiceDataUri },
            {
              caseNumber: metadata.caseNumber,
              documentID: metadata.documentID,
              description: metadata.description ?? undefined,
              smartAdvocateMetadata: mapSmartAdvocateDocumentToInvoice(doc),
            }
          );

          if (processResult.error) {
            result.failed++;
            result.errors.push({
              documentID: metadata.documentID,
              error: processResult.error,
            });
            
            await createDocumentSyncError({
              documentID: metadata.documentID,
              error: processResult.error,
              errorType: 'Processing Error',
              caseID: metadata.caseID,
              caseNumber: metadata.caseNumber,
              documentName: metadata.documentName,
              contentType: content.contentType,
              fileSize: content.size,
              categoryID: metadata.categoryID,
              description: metadata.description ?? undefined,
              createdDate: metadata.createdDate ? new Date(metadata.createdDate) : undefined,
              modifiedDate: metadata.modifiedDate ? new Date(metadata.modifiedDate) : undefined,
              ...mapSmartAdvocateDocumentToInvoice(doc),
            });
            
            console.log(`   ❌ Processing failed: ${processResult.error}\n`);
          } else {
            result.successful++;
            console.log(`   ✅ Successfully processed as invoice ${processResult.data?.id}\n`);
          }
        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push({
            documentID: doc.documentID,
            error: errorMessage,
          });
          
          await createDocumentSyncError({
            documentID: doc.documentID,
            error: errorMessage,
            errorType: 'API Error',
            caseID: doc.caseID,
            caseNumber: doc.caseNumber,
            documentName: doc.documentName,
            categoryID: doc.categoryID,
            ...mapSmartAdvocateDocumentToInvoice(doc),
          });
          
          console.log(`   ❌ Error: ${errorMessage}\n`);
        }
      }

      // Check if there are more pages
      const totalPages = response.pageRequest?.totalPages ?? 0;
      hasMorePages = currentPage < totalPages - 1;
      currentPage++;

      // Add a delay between pages
      if (hasMorePages) {
        console.log('⏳ Waiting 1 second before next page...\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n✅ Document sync completed!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total documents: ${result.totalDocuments}`);
    console.log(`   Filtered documents: ${result.filteredDocuments}`);
    console.log(`   Processed: ${result.processedDocuments}`);
    console.log(`   ✅ Successful: ${result.successful}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log(`   ⏭️  Skipped (duplicates): ${result.skipped}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. Document ${error.documentID}: ${error.error}`);
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more errors`);
      }
      console.log(`\n💡 Check the sync-errors page for detailed error information.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error during document sync:');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run the script
syncDocuments();
