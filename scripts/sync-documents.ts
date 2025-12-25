/**
 * Sync documents from SmartAdvocate API
 * This script syncs documents (Invoices and Receipts) from SmartAdvocate
 * and processes them through the invoice processing pipeline
 * 
 * Usage:
 *   npm run sync:documents
 * 
 * Environment variables required:
 *   SA_DOCUMENT_SYNC_FROM_DATE=2025-12-21T14:15:22Z
 *   SA_DOCUMENT_SYNC_TO_DATE=2025-12-23T23:59:59Z
 * 
 * Optional command line arguments:
 *   --from-date <ISO_DATE>    Override from date
 *   --to-date <ISO_DATE>      Override to date
 *   --categories <ID1,ID2>   Override category IDs (default: 78,1080)
 *   --preview                 Preview mode (don't process documents)
 */

import 'dotenv/config';
import { initDb, closeDb, getDb } from '../src/lib/db/script';
import {
  getDocumentsByDate,
  getDocumentContent,
  filterDocumentsByCategory,
  extractDocumentMetadata,
} from '../src/lib/crm/smartadvocate/document.script';
import { getConfig } from '../src/lib/crm/smartadvocate/utils.script';
import { processInvoice } from '../src/lib/services/invoice.service.script';
import type { SmartAdvocateDocument } from '../src/lib/crm/smartadvocate/types';
import { generateDocumentHash } from '../src/lib/utils/document-hash';
import { invoices, documentSyncErrors } from '../src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

interface SyncOptions {
  fromDate?: string;
  toDate?: string;
  categoryIDs?: number[];
  preview?: boolean;
}

interface SyncResult {
  totalDocuments: number;
  filteredDocuments: number;
  processedDocuments: number;
  successful: number;
  failed: number;
  skipped: number; // Documents skipped due to duplicates
  errors: Array<{ documentID: number; error: string }>;
}

/**
 * Find existing sync error by document ID and case number
 * Prevents duplicate error entries
 */
async function findExistingSyncError(
  documentID: number,
  caseNumber: string | null | undefined
): Promise<any> {
  const db = getDb();
  
  const conditions = [eq(documentSyncErrors.documentID, documentID)];
  
  if (caseNumber) {
    conditions.push(eq(documentSyncErrors.caseNumber, caseNumber));
  } else {
    conditions.push(sql`${documentSyncErrors.caseNumber} IS NULL`);
  }

  // Prefer unresolved errors
  const unresolvedConditions = [...conditions, eq(documentSyncErrors.resolved, false)];
  const unresolvedRow = await db
    .select()
    .from(documentSyncErrors)
    .where(and(...unresolvedConditions))
    .orderBy(sql`${documentSyncErrors.syncDate} DESC`)
    .limit(1)
    .then(rows => rows[0]);
  
  if (unresolvedRow) {
    return unresolvedRow;
  }

  // Otherwise, find any error
  const [row] = await db
    .select()
    .from(documentSyncErrors)
    .where(and(...conditions))
    .orderBy(sql`${documentSyncErrors.syncDate} DESC`)
    .limit(1);

  return row;
}

/**
 * Create or update a sync error (prevents duplicates)
 */
async function upsertSyncError(errorData: {
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
  createdDate?: Date | null;
  modifiedDate?: Date | null;
  // SmartAdvocate metadata
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
  saDocumentDate?: Date | null;
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
}): Promise<void> {
  const db = getDb();
  
  // Check for existing error
  const existing = await findExistingSyncError(errorData.documentID, errorData.caseNumber);
  
  const now = new Date();
  
  if (existing) {
    // Update existing error
    await db
      .update(documentSyncErrors)
      .set({
        error: errorData.error,
        errorType: errorData.errorType,
        contentType: errorData.contentType,
        fileSize: errorData.fileSize,
        documentName: errorData.documentName,
        categoryID: errorData.categoryID,
        categoryName: errorData.categoryName,
        subCategoryID: errorData.subCategoryID,
        subCategoryName: errorData.subCategoryName,
        subSubCategoryID: errorData.subSubCategoryID,
        subSubSubCategoryID: errorData.subSubSubCategoryID,
        description: errorData.description,
        comments: errorData.comments,
        createdDate: errorData.createdDate,
        modifiedDate: errorData.modifiedDate,
        // SmartAdvocate metadata
        saFromUniqueContactId: errorData.saFromUniqueContactId,
        saToContactName: errorData.saToContactName,
        saFromContactName: errorData.saFromContactName,
        saDocType: errorData.saDocType,
        saTemplateId: errorData.saTemplateId,
        saAttachFlag: errorData.saAttachFlag,
        saCreatedUserId: errorData.saCreatedUserId,
        saModifiedUserId: errorData.saModifiedUserId,
        saMedProvUniqueContactId: errorData.saMedProvUniqueContactId,
        saIsReviewed: errorData.saIsReviewed,
        saToUniqueContactId: errorData.saToUniqueContactId,
        saDocumentDate: errorData.saDocumentDate,
        saPriority: errorData.saPriority,
        saPriorityName: errorData.saPriorityName,
        saDocumentDirection: errorData.saDocumentDirection,
        saDirectionName: errorData.saDirectionName,
        saDocumentOrigin: errorData.saDocumentOrigin,
        saOriginName: errorData.saOriginName,
        saIsSharedInPortal: errorData.saIsSharedInPortal,
        saIsSharedWithEveryoneInPortal: errorData.saIsSharedWithEveryoneInPortal,
        saCaseDocumentId: errorData.saCaseDocumentId,
        saDeliveryMethodId: errorData.saDeliveryMethodId,
        saDeliveryName: errorData.saDeliveryName,
        syncDate: now, // Update sync date to track latest occurrence
        updatedAt: now,
        resolved: existing.resolved ? false : undefined, // Mark as unresolved if it was resolved
        resolvedAt: existing.resolved ? null : undefined,
        resolvedBy: existing.resolved ? null : undefined,
        resolutionNotes: existing.resolved ? null : undefined,
      })
      .where(eq(documentSyncErrors.id, existing.id));
  } else {
    // Create new error
    const errorId = nanoid();
    await db.insert(documentSyncErrors).values({
      id: errorId,
      documentID: errorData.documentID,
      caseID: errorData.caseID,
      caseNumber: errorData.caseNumber,
      documentName: errorData.documentName,
      error: errorData.error,
      errorType: errorData.errorType,
      contentType: errorData.contentType,
      fileSize: errorData.fileSize,
      categoryID: errorData.categoryID,
      categoryName: errorData.categoryName,
      subCategoryID: errorData.subCategoryID,
      subCategoryName: errorData.subCategoryName,
      subSubCategoryID: errorData.subSubCategoryID,
      subSubSubCategoryID: errorData.subSubSubCategoryID,
      description: errorData.description,
      comments: errorData.comments,
      createdDate: errorData.createdDate,
      modifiedDate: errorData.modifiedDate,
      // SmartAdvocate metadata
      saFromUniqueContactId: errorData.saFromUniqueContactId,
      saToContactName: errorData.saToContactName,
      saFromContactName: errorData.saFromContactName,
      saDocType: errorData.saDocType,
      saTemplateId: errorData.saTemplateId,
      saAttachFlag: errorData.saAttachFlag,
      saCreatedUserId: errorData.saCreatedUserId,
      saModifiedUserId: errorData.saModifiedUserId,
      saMedProvUniqueContactId: errorData.saMedProvUniqueContactId,
      saIsReviewed: errorData.saIsReviewed,
      saToUniqueContactId: errorData.saToUniqueContactId,
      saDocumentDate: errorData.saDocumentDate,
      saPriority: errorData.saPriority,
      saPriorityName: errorData.saPriorityName,
      saDocumentDirection: errorData.saDocumentDirection,
      saDirectionName: errorData.saDirectionName,
      saDocumentOrigin: errorData.saDocumentOrigin,
      saOriginName: errorData.saOriginName,
      saIsSharedInPortal: errorData.saIsSharedInPortal,
      saIsSharedWithEveryoneInPortal: errorData.saIsSharedWithEveryoneInPortal,
      saCaseDocumentId: errorData.saCaseDocumentId,
      saDeliveryMethodId: errorData.saDeliveryMethodId,
      saDeliveryName: errorData.saDeliveryName,
      syncDate: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function syncDocuments(options: SyncOptions = {}): Promise<SyncResult> {
  const config = getConfig();

  // Get date range from options or environment variables
  const fromDate = options.fromDate || config.SA_DOCUMENT_SYNC_FROM_DATE;
  const toDate = options.toDate || config.SA_DOCUMENT_SYNC_TO_DATE;

  if (!fromDate || !toDate) {
    throw new Error(
      'Date range not provided. Set SA_DOCUMENT_SYNC_FROM_DATE and SA_DOCUMENT_SYNC_TO_DATE in .env or provide --from-date and --to-date arguments.'
    );
  }

  // Default category IDs: 78 (Invoices) and 1080 (Receipts)
  const categoryIDs = options.categoryIDs || [78, 1080];

  console.log('\n=== Document Sync from SmartAdvocate ===');
  console.log(`From Date: ${fromDate}`);
  console.log(`To Date: ${toDate}`);
  console.log(`Category IDs: ${categoryIDs.join(', ')}`);
  console.log(`Mode: ${options.preview ? 'PREVIEW (no processing)' : 'SYNC (will process documents)'}`);
  console.log('');

    const result: SyncResult = {
      totalDocuments: 0,
      filteredDocuments: 0,
      processedDocuments: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

  let currentPage = 0;
  const pageSize = config.SA_DOCUMENT_SYNC_PAGE_SIZE || 100;
  let hasMorePages = true;

  // Fetch all pages of documents
  while (hasMorePages) {
    console.log(`📄 Fetching page ${currentPage + 1}...`);

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
      `   Found ${allDocuments.length} total documents, ${filteredDocs.length} match categories`
    );

    if (options.preview) {
      // Preview mode: just show what would be processed
      console.log(`\n   Preview of documents to be processed:`);
      filteredDocs.slice(0, 10).forEach((doc) => {
        const metadata = extractDocumentMetadata(doc);
        console.log(
          `   - [${metadata.categoryName}] ${metadata.documentName} (ID: ${metadata.documentID}, Case: ${metadata.caseNumber})`
        );
      });
      if (filteredDocs.length > 10) {
        console.log(`   ... and ${filteredDocs.length - 10} more`);
      }
    } else {
      // Process each filtered document
      for (const doc of filteredDocs) {
        try {
          // Extract metadata
          const metadata = extractDocumentMetadata(doc);
          
          // Generate hash from document ID and case number
          const documentHash = generateDocumentHash(metadata.documentID, metadata.caseNumber);
          
          // Check if this document already exists (duplicate check)
          // Use direct database access since we're in a script context
          const db = getDb();
          const existingInvoice = await db
            .select()
            .from(invoices)
            .where(eq(invoices.documentHash, documentHash))
            .limit(1)
            .then(rows => rows[0]);
          
          if (existingInvoice) {
            result.skipped++;
            console.log(
              `\n⏭️  Skipping duplicate document ${metadata.documentID} (Case: ${metadata.caseNumber}) - already exists as invoice ${existingInvoice.id}`
            );
            continue;
          }

          result.processedDocuments++;
          console.log(
            `\n📄 Processing document ${result.processedDocuments}/${filteredDocs.length}: ${metadata.documentName}`
          );
          console.log(`   Document ID: ${metadata.documentID}, Case: ${metadata.caseNumber}`);

          // Fetch document content
          console.log(`   Fetching document content...`);
          const content = await getDocumentContent(metadata.documentID);
          console.log(
            `   ✓ Fetched content (${(content.size / 1024).toFixed(2)} KB, ${content.contentType})`
          );

          // Skip unsupported file types (e.g., .msg email files)
          const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/heic'];
          if (!supportedTypes.includes(content.contentType)) {
            console.log(`   ⚠ Skipping unsupported file type: ${content.contentType}`);
            result.failed++;
            const errorMessage = `Unsupported file type: ${content.contentType}. Only PDF and images are supported.`;
            result.errors.push({
              documentID: metadata.documentID,
              error: errorMessage,
            });
            
            // Save error to database with all SmartAdvocate metadata (prevents duplicates)
            try {
              await upsertSyncError({
                documentID: doc.documentID,
                error: errorMessage,
                errorType: 'Unsupported File Type',
                caseID: doc.caseID,
                caseNumber: doc.caseNumber,
                documentName: doc.documentName,
                contentType: content.contentType,
                fileSize: content.size,
                categoryID: doc.categoryID,
                categoryName: doc.categoryName,
                subCategoryID: doc.subCategoryID,
                subCategoryName: doc.subCategoryName,
                subSubCategoryID: doc.subSubCategoryID,
                subSubSubCategoryID: doc.subSubSubCategoryID,
                description: doc.description,
                comments: doc.comments,
                createdDate: doc.createdDate ? new Date(doc.createdDate) : null,
                modifiedDate: doc.modifiedDate ? new Date(doc.modifiedDate) : null,
                // SmartAdvocate metadata fields
                saFromUniqueContactId: doc.fromUniqueContactID,
                saToContactName: doc.toContactName,
                saFromContactName: doc.fromContactName,
                saDocType: doc.docType,
                saTemplateId: doc.templateID,
                saAttachFlag: doc.attachFlag,
                saCreatedUserId: doc.createdUserID,
                saModifiedUserId: doc.modifiedUserID,
                saMedProvUniqueContactId: doc.medProvUniqueContactID,
                saIsReviewed: doc.isReviewed,
                saToUniqueContactId: doc.toUniqueContactID,
                saDocumentDate: doc.documentDate ? new Date(doc.documentDate) : null,
                saPriority: doc.priority,
                saPriorityName: doc.priorityName,
                saDocumentDirection: doc.documentDirection,
                saDirectionName: doc.directionName,
                saDocumentOrigin: doc.documentOrigin,
                saOriginName: doc.originName,
                saIsSharedInPortal: doc.isSharedInPortal,
                saIsSharedWithEveryoneInPortal: doc.isSharedWithEveryoneInPortal,
                saCaseDocumentId: doc.caseDocumentID,
                saDeliveryMethodId: (doc as any).deliveryMethodId,
                saDeliveryName: (doc as any).deliveryName,
              });
            } catch (dbError) {
              console.error(`   ⚠ Failed to save error to database: ${dbError}`);
            }
            
            continue;
          }

          // Process the document through invoice processing
          console.log(`   Processing through invoice pipeline...`);
          const processResult = await processInvoice(
            {
              invoiceDataUri: content.dataUri,
            },
            {
              caseNumber: metadata.caseNumber, // Auto-populate case number from SmartAdvocate
              documentID: metadata.documentID, // Pass document ID for hash generation
            }
          );

          if (processResult.error) {
            result.failed++;
            result.errors.push({
              documentID: metadata.documentID,
              error: processResult.error,
            });
            console.error(`   ✗ Failed: ${processResult.error}`);
            
            // Save error to database with all SmartAdvocate metadata (prevents duplicates)
            try {
              await upsertSyncError({
                documentID: doc.documentID,
                error: processResult.error,
                errorType: 'Processing Error',
                caseID: doc.caseID,
                caseNumber: doc.caseNumber,
                documentName: doc.documentName,
                contentType: content.contentType,
                fileSize: content.size,
                categoryID: doc.categoryID,
                categoryName: doc.categoryName,
                subCategoryID: doc.subCategoryID,
                subCategoryName: doc.subCategoryName,
                subSubCategoryID: doc.subSubCategoryID,
                subSubSubCategoryID: doc.subSubSubCategoryID,
                description: doc.description,
                comments: doc.comments,
                createdDate: doc.createdDate ? new Date(doc.createdDate) : null,
                modifiedDate: doc.modifiedDate ? new Date(doc.modifiedDate) : null,
                // SmartAdvocate metadata fields
                saFromUniqueContactId: doc.fromUniqueContactID,
                saToContactName: doc.toContactName,
                saFromContactName: doc.fromContactName,
                saDocType: doc.docType,
                saTemplateId: doc.templateID,
                saAttachFlag: doc.attachFlag,
                saCreatedUserId: doc.createdUserID,
                saModifiedUserId: doc.modifiedUserID,
                saMedProvUniqueContactId: doc.medProvUniqueContactID,
                saIsReviewed: doc.isReviewed,
                saToUniqueContactId: doc.toUniqueContactID,
                saDocumentDate: doc.documentDate ? new Date(doc.documentDate) : null,
                saPriority: doc.priority,
                saPriorityName: doc.priorityName,
                saDocumentDirection: doc.documentDirection,
                saDirectionName: doc.directionName,
                saDocumentOrigin: doc.documentOrigin,
                saOriginName: doc.originName,
                saIsSharedInPortal: doc.isSharedInPortal,
                saIsSharedWithEveryoneInPortal: doc.isSharedWithEveryoneInPortal,
                saCaseDocumentId: doc.caseDocumentID,
                saDeliveryMethodId: (doc as any).deliveryMethodId,
                saDeliveryName: (doc as any).deliveryName,
              });
            } catch (dbError) {
              console.error(`   ⚠ Failed to save error to database: ${dbError}`);
            }
          } else {
            result.successful++;
            console.log(
              `   ✓ Successfully processed → Invoice ID: ${processResult.data?.id}`
            );
          }

          // Add a small delay to avoid overwhelming the API
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            documentID: doc.documentID,
            error: errorMessage,
          });
          console.error(`   ✗ Error: ${errorMessage}`);
          
          // Save error to database with all SmartAdvocate metadata (prevents duplicates)
          try {
            await upsertSyncError({
              documentID: doc.documentID,
              error: errorMessage,
              errorType: 'Other',
              caseID: doc.caseID,
              caseNumber: doc.caseNumber,
              documentName: doc.documentName,
              categoryID: doc.categoryID,
              categoryName: doc.categoryName,
              subCategoryID: doc.subCategoryID,
              subCategoryName: doc.subCategoryName,
              subSubCategoryID: doc.subSubCategoryID,
              subSubSubCategoryID: doc.subSubSubCategoryID,
              description: doc.description,
              comments: doc.comments,
              createdDate: doc.createdDate ? new Date(doc.createdDate) : null,
              modifiedDate: doc.modifiedDate ? new Date(doc.modifiedDate) : null,
              // SmartAdvocate metadata fields
              saFromUniqueContactId: doc.fromUniqueContactID,
              saToContactName: doc.toContactName,
              saFromContactName: doc.fromContactName,
              saDocType: doc.docType,
              saTemplateId: doc.templateID,
              saAttachFlag: doc.attachFlag,
              saCreatedUserId: doc.createdUserID,
              saModifiedUserId: doc.modifiedUserID,
              saMedProvUniqueContactId: doc.medProvUniqueContactID,
              saIsReviewed: doc.isReviewed,
              saToUniqueContactId: doc.toUniqueContactID,
              saDocumentDate: doc.documentDate ? new Date(doc.documentDate) : null,
              saPriority: doc.priority,
              saPriorityName: doc.priorityName,
              saDocumentDirection: doc.documentDirection,
              saDirectionName: doc.directionName,
              saDocumentOrigin: doc.documentOrigin,
              saOriginName: doc.originName,
              saIsSharedInPortal: doc.isSharedInPortal,
              saIsSharedWithEveryoneInPortal: doc.isSharedWithEveryoneInPortal,
              saCaseDocumentId: doc.caseDocumentID,
              saDeliveryMethodId: (doc as any).deliveryMethodId,
              saDeliveryName: (doc as any).deliveryName,
            });
          } catch (dbError) {
            console.error(`   ⚠ Failed to save error to database: ${dbError}`);
          }
        }
      }
    }

    // Check if there are more pages
    const totalPages = response.pageRequest?.totalPages ?? 0;
    hasMorePages = currentPage < totalPages - 1;
    currentPage++;

    // Add a delay between pages
    if (hasMorePages && !options.preview) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return result;
}

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--from-date' && nextArg) {
      options.fromDate = nextArg;
      i++;
    } else if (arg === '--to-date' && nextArg) {
      options.toDate = nextArg;
      i++;
    } else if (arg === '--categories' && nextArg) {
      options.categoryIDs = nextArg.split(',').map((id) => parseInt(id.trim(), 10));
      i++;
    } else if (arg === '--preview') {
      options.preview = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run sync:documents [options]

Options:
  --from-date <ISO_DATE>    Override from date (e.g., 2025-12-21T14:15:22Z)
  --to-date <ISO_DATE>      Override to date (e.g., 2025-12-23T23:59:59Z)
  --categories <ID1,ID2>    Override category IDs (default: 78,1080)
  --preview                 Preview mode (don't process documents, just show what would be synced)
  --help, -h                Show this help message

Environment Variables:
  SA_DOCUMENT_SYNC_FROM_DATE    Default from date
  SA_DOCUMENT_SYNC_TO_DATE      Default to date

Examples:
  npm run sync:documents
  npm run sync:documents -- --preview
  npm run sync:documents -- --from-date 2025-12-21T14:15:22Z --to-date 2025-12-23T23:59:59Z
      `);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  try {
    const options = parseArgs();

    // Initialize database connection
    await initDb();

    // Run sync
    const result = await syncDocuments(options);

    // Print summary
    console.log('\n=== Sync Summary ===');
    console.log(`Total documents found: ${result.totalDocuments}`);
    console.log(`Documents matching categories: ${result.filteredDocuments}`);
    if (!options.preview) {
      console.log(`Documents processed: ${result.processedDocuments}`);
      console.log(`✓ Successful: ${result.successful}`);
      console.log(`✗ Failed: ${result.failed}`);
      console.log(`⏭️  Skipped (duplicates): ${result.skipped}`);

      if (result.errors.length > 0) {
        console.log('\n=== Errors ===');
        result.errors.slice(0, 10).forEach((err) => {
          console.log(`  Document ${err.documentID}: ${err.error}`);
        });
        if (result.errors.length > 10) {
          console.log(`  ... and ${result.errors.length - 10} more errors`);
        }
      }
    }

    console.log('\n✓ Sync completed!');
  } catch (error) {
    console.error('\n✗ Sync failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

// Run the sync
main();

