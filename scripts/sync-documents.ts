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
import { initDb, closeDb } from '../src/lib/db/script';
import {
  getDocumentsByDate,
  getDocumentContent,
  filterDocumentsByCategory,
  extractDocumentMetadata,
} from '../src/lib/crm/smartadvocate/document.script';
import { getConfig } from '../src/lib/crm/smartadvocate/utils.script';
import { processInvoice } from '../src/lib/services/invoice.service.script';
import type { SmartAdvocateDocument } from '../src/lib/crm/smartadvocate/types';

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
  errors: Array<{ documentID: number; error: string }>;
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
          result.processedDocuments++;

          // Extract metadata
          const metadata = extractDocumentMetadata(doc);
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
            result.errors.push({
              documentID: metadata.documentID,
              error: `Unsupported file type: ${content.contentType}. Only PDF and images are supported.`,
            });
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
            }
          );

          if (processResult.error) {
            result.failed++;
            result.errors.push({
              documentID: metadata.documentID,
              error: processResult.error,
            });
            console.error(`   ✗ Failed: ${processResult.error}`);
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

