/**
 * SSE (Server-Sent Events) API for Document Sync Streaming
 * Provides real-time progress updates for document synchronization
 */

import { NextRequest } from 'next/server';
import {
  getDocumentsByDate,
  getDocumentContent,
  extractDocumentMetadata,
  filterDocumentsByCategory,
} from '@/lib/crm/smartadvocate/document';
import { mapSmartAdvocateDocumentToInvoice } from '@/lib/utils/smartadvocate-mapper';
import { getConfig } from '@/lib/crm/smartadvocate/utils';
import { processInvoiceAction } from '@/lib/actions/invoice.actions';
import type { SmartAdvocateDocument } from '@/lib/crm/smartadvocate/types';
import { findInvoiceByDocumentHash } from '@/lib/repositories/invoice.repository';
import { createDocumentSyncError } from '@/lib/repositories/document-sync-error.repository';
import { generateDocumentHash } from '@/lib/utils/document-hash';
import { convertWordToPdf } from '@/lib/word-to-pdf-server';
import { revalidatePath } from 'next/cache';
import type { SyncEvent } from '@/lib/types/sync.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/octet-stream',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/heic',
];

const DOCUMENT_DELAY_MS = 500;
const PAGE_DELAY_MS = 1000;

function shouldUpdateDocument(
  existingInvoice: { status: string; saModifiedDate?: Date | null } | null,
  docModifiedDate?: string
): boolean {
  if (!existingInvoice || !docModifiedDate) return false;
  
  const canUpdate = existingInvoice.status === 'Draft' || existingInvoice.status === 'Review';
  if (!canUpdate) return false;
  
  const existingModifiedDate = existingInvoice.saModifiedDate;
  if (!existingModifiedDate) return true;
  
  const docDate = new Date(docModifiedDate);
  const existingDate = new Date(existingModifiedDate);
  
  return docDate > existingDate;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  
  if (!fromDate || !toDate) {
    return new Response(JSON.stringify({ error: 'fromDate and toDate are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: SyncEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const config = getConfig();
        const categoryIDs = [78, 1080]; // Invoices and Receipts
        const pageSize = config.SA_DOCUMENT_SYNC_PAGE_SIZE || 100;

        // Send start event
        sendEvent({
          type: 'start',
          timestamp: new Date().toISOString(),
          data: {
            message: `Starting sync from ${fromDate} to ${toDate}`,
          },
        });

        const result = {
          totalDocuments: 0,
          filteredDocuments: 0,
          processedDocuments: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          updated: 0,
        };

        let currentPage = 0;
        let hasMorePages = true;
        let documentCounter = 0;

        // First pass: count total documents
        let totalFilteredDocs = 0;
        let tempPage = 0;
        let tempHasMore = true;
        
        while (tempHasMore) {
          const response = await getDocumentsByDate({
            modifiedFromDateTime: fromDate,
            modifiedToDateTime: toDate,
            currentPage: tempPage,
            pageSize,
          });
          
          const allDocs = response.documents || [];
          const filtered = filterDocumentsByCategory(allDocs, categoryIDs);
          totalFilteredDocs += filtered.length;
          result.totalDocuments += allDocs.length;
          
          const totalPages = response.pageRequest?.totalPages ?? 0;
          tempHasMore = tempPage < totalPages - 1;
          tempPage++;
        }

        result.filteredDocuments = totalFilteredDocs;

        // Send initial progress
        sendEvent({
          type: 'progress',
          timestamp: new Date().toISOString(),
          data: {
            totalDocuments: result.totalDocuments,
            filteredDocuments: result.filteredDocuments,
            processedDocuments: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            updated: 0,
            message: `Found ${result.filteredDocuments} documents to process`,
          },
        });

        // Process documents
        while (hasMorePages) {
          const response = await getDocumentsByDate({
            modifiedFromDateTime: fromDate,
            modifiedToDateTime: toDate,
            currentPage,
            pageSize,
          });

          const allDocuments = response.documents || [];
          const filteredDocs = filterDocumentsByCategory(allDocuments, categoryIDs);

          for (const doc of filteredDocs) {
            documentCounter++;
            const metadata = extractDocumentMetadata(doc);
            const documentHash = generateDocumentHash(metadata.documentID, metadata.caseNumber);

            // Send processing event
            sendEvent({
              type: 'document_processing',
              timestamp: new Date().toISOString(),
              data: {
                currentDocument: documentCounter,
                totalDocuments: result.filteredDocuments,
                documentId: metadata.documentID,
                documentName: metadata.documentName,
                caseNumber: metadata.caseNumber,
                status: 'processing',
                message: `Processing document ${documentCounter}/${result.filteredDocuments}`,
              },
            });

            try {
              // Check for existing invoice
              const existingInvoice = await findInvoiceByDocumentHash(documentHash);
              
              let shouldProcess = false;
              let isUpdate = false;

              if (!existingInvoice) {
                shouldProcess = true;
              } else if (shouldUpdateDocument(
                { status: existingInvoice.status, saModifiedDate: existingInvoice.saModifiedDate },
                metadata.modifiedDate
              )) {
                shouldProcess = true;
                isUpdate = true;
                result.updated++;
              } else {
                result.skipped++;
                result.processedDocuments++;
                
                sendEvent({
                  type: 'document_skipped',
                  timestamp: new Date().toISOString(),
                  data: {
                    currentDocument: documentCounter,
                    totalDocuments: result.filteredDocuments,
                    processedDocuments: result.processedDocuments,
                    successful: result.successful,
                    failed: result.failed,
                    skipped: result.skipped,
                    updated: result.updated,
                    documentId: metadata.documentID,
                    documentName: metadata.documentName,
                    caseNumber: metadata.caseNumber,
                    status: 'skipped',
                    message: `Skipped (already exists)`,
                  },
                });
                
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                continue;
              }

              if (!shouldProcess) continue;

              // Fetch document content
              const content = await getDocumentContent(metadata.documentID);

              // Check for .msg format (Microsoft Outlook message files)
              const fileExtension = metadata.documentName?.split('.').pop()?.toLowerCase() || '';
              const isMsgFile = fileExtension === 'msg' || 
                                content.contentType === 'application/vnd.ms-outlook' ||
                                content.contentType === 'message/rfc822';
              
              if (isMsgFile) {
                result.failed++;
                result.processedDocuments++;
                const errorMessage = 'Unsupported format';

                await createDocumentSyncError({
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
                });

                sendEvent({
                  type: 'document_error',
                  timestamp: new Date().toISOString(),
                  data: {
                    currentDocument: documentCounter,
                    totalDocuments: result.filteredDocuments,
                    processedDocuments: result.processedDocuments,
                    successful: result.successful,
                    failed: result.failed,
                    skipped: result.skipped,
                    updated: result.updated,
                    documentId: metadata.documentID,
                    documentName: metadata.documentName,
                    caseNumber: metadata.caseNumber,
                    status: 'error',
                    error: errorMessage,
                  },
                });

                await new Promise(resolve => setTimeout(resolve, DOCUMENT_DELAY_MS));
                continue;
              }

              // Check file type
              // Allow application/octet-stream if it's a Word document (detected by extension)
              const isOctetStreamWordDoc = content.contentType === 'application/octet-stream' && 
                (fileExtension === 'doc' || fileExtension === 'docx');
              
              if (!SUPPORTED_FILE_TYPES.includes(content.contentType) && !isOctetStreamWordDoc) {
                result.failed++;
                result.processedDocuments++;
                const errorMessage = `Unsupported file type: ${content.contentType}`;

                await createDocumentSyncError({
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
                });

                sendEvent({
                  type: 'document_error',
                  timestamp: new Date().toISOString(),
                  data: {
                    currentDocument: documentCounter,
                    totalDocuments: result.filteredDocuments,
                    processedDocuments: result.processedDocuments,
                    successful: result.successful,
                    failed: result.failed,
                    skipped: result.skipped,
                    updated: result.updated,
                    documentId: metadata.documentID,
                    documentName: metadata.documentName,
                    caseNumber: metadata.caseNumber,
                    status: 'error',
                    error: errorMessage,
                  },
                });

                await new Promise(resolve => setTimeout(resolve, DOCUMENT_DELAY_MS));
                continue;
              }

              // Convert Word documents to PDF first, then convert PDF to image if needed
              let invoiceDataUri = content.dataUri;
              
              // Detect Word documents by both MIME type and file extension
              // Word documents might come as application/octet-stream with .doc/.docx extension
              const isWordDocumentByMime = 
                content.contentType === 'application/msword' ||
                content.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              const isWordDocumentByExtension = 
                fileExtension === 'doc' || fileExtension === 'docx';
              const isWordDocument = isWordDocumentByMime || 
                (content.contentType === 'application/octet-stream' && isWordDocumentByExtension);
              
              const isPdfOrOctetStream =
                content.contentType === 'application/pdf' ||
                (content.contentType === 'application/octet-stream' && !isWordDocument);

              // Convert Word documents to PDF first
              if (isWordDocument) {
                try {
                  // Determine if it's .docx or .doc
                  // Check MIME type first, then file extension, then default to docx
                  let isDocx = content.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                  if (!isDocx && content.contentType !== 'application/msword') {
                    // If MIME type is octet-stream, use file extension
                    isDocx = fileExtension === 'docx';
                  }
                  
                  console.log(`[Document Sync] Converting ${isDocx ? '.docx' : '.doc'} to PDF for document ${metadata.documentID}...`);
                  const convertedPdf = await convertWordToPdf(content.dataUri, isDocx);
                  
                  // Validate that the conversion actually produced a PDF
                  // Use same parsing as pdf-to-image-server.ts
                  const dataUriMatch = convertedPdf.match(/^data:(.+?);base64,(.+)$/);
                  if (!dataUriMatch || !dataUriMatch[2]) {
                    throw new Error(`Word-to-PDF conversion returned invalid data URI format: ${convertedPdf.substring(0, 50)}...`);
                  }
                  
                  const pdfBase64 = dataUriMatch[2];
                  let pdfBuffer: Buffer;
                  try {
                    pdfBuffer = Buffer.from(pdfBase64, 'base64');
                  } catch (error) {
                    throw new Error(`Failed to decode base64 PDF data: ${error instanceof Error ? error.message : String(error)}`);
                  }
                  
                  // Check if it's actually a PDF (starts with %PDF)
                  if (pdfBuffer.length < 4) {
                    throw new Error(`Word-to-PDF conversion returned invalid PDF - buffer too short (${pdfBuffer.length} bytes)`);
                  }
                  
                  if (pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50 || 
                      pdfBuffer[2] !== 0x44 || pdfBuffer[3] !== 0x46) {
                    const firstBytes = Array.from(pdfBuffer.slice(0, Math.min(10, pdfBuffer.length)))
                      .map(b => `0x${b.toString(16).padStart(2, '0')}`)
                      .join(' ');
                    throw new Error(
                      `Word-to-PDF conversion failed - returned invalid PDF data. ` +
                      `Expected PDF signature (0x25 0x50 0x44 0x46) but got: ${firstBytes}. ` +
                      `Buffer length: ${pdfBuffer.length} bytes. ` +
                      `This indicates LibreOffice conversion failed or returned the original Word document.`
                    );
                  }
                  
                  invoiceDataUri = convertedPdf;
                  console.log(`[Document Sync] Successfully converted Word document to PDF for document ${metadata.documentID} (${pdfBuffer.length} bytes)`);
                } catch (error) {
                  const errorMsg = error instanceof Error ? error.message : String(error);
                  console.error(`[Document Sync] Word-to-PDF conversion failed for document ${metadata.documentID}:`, errorMsg);
                  result.failed++;
                  result.processedDocuments++;

                  await createDocumentSyncError({
                    documentID: doc.documentID,
                    error: `Failed to convert Word document to PDF: ${errorMsg}`,
                    errorType: 'Processing Error',
                    caseID: doc.caseID,
                    caseNumber: doc.caseNumber,
                    documentName: doc.documentName,
                    contentType: content.contentType,
                    fileSize: content.size,
                    categoryID: doc.categoryID,
                    categoryName: doc.categoryName,
                  });

                  sendEvent({
                    type: 'document_error',
                    timestamp: new Date().toISOString(),
                    data: {
                      currentDocument: documentCounter,
                      totalDocuments: result.filteredDocuments,
                      processedDocuments: result.processedDocuments,
                      successful: result.successful,
                      failed: result.failed,
                      skipped: result.skipped,
                      updated: result.updated,
                      documentId: metadata.documentID,
                      documentName: metadata.documentName,
                      caseNumber: metadata.caseNumber,
                      status: 'error',
                      error: `Word document conversion failed: ${errorMsg}`,
                    },
                  });

                  await new Promise(resolve => setTimeout(resolve, DOCUMENT_DELAY_MS));
                  continue;
                }
              }

              // Skip PDF-to-image conversion - save PDFs directly
              // The invoice viewer supports PDFs natively, so no conversion is needed
              // This avoids canvas dependency issues and preserves original document quality
              console.log(`[Document Sync] Using original document format for document ${metadata.documentID} (PDF/image)`);

              // Validate data URI before processing
              if (invoiceDataUri.startsWith('data:')) {
                const dataUriMatch = invoiceDataUri.match(/^data:([^;]+);base64,(.+)$/);
                if (!dataUriMatch || !dataUriMatch[2] || dataUriMatch[2].length === 0) {
                  result.failed++;
                  result.processedDocuments++;

                  const errorMsg = 'Invalid or incomplete data URI - document data is missing';
                  await createDocumentSyncError({
                    documentID: doc.documentID,
                    error: errorMsg,
                    errorType: 'Processing Error',
                    caseID: doc.caseID,
                    caseNumber: doc.caseNumber,
                    documentName: doc.documentName,
                    contentType: content.contentType,
                    fileSize: content.size,
                    categoryID: doc.categoryID,
                    categoryName: doc.categoryName,
                  });

                  sendEvent({
                    type: 'document_error',
                    timestamp: new Date().toISOString(),
                    data: {
                      currentDocument: documentCounter,
                      totalDocuments: result.filteredDocuments,
                      processedDocuments: result.processedDocuments,
                      successful: result.successful,
                      failed: result.failed,
                      skipped: result.skipped,
                      updated: result.updated,
                      documentId: metadata.documentID,
                      documentName: metadata.documentName,
                      caseNumber: metadata.caseNumber,
                      status: 'error',
                      error: errorMsg,
                    },
                  });

                  await new Promise(resolve => setTimeout(resolve, DOCUMENT_DELAY_MS));
                  continue;
                }
              }

              // Process the document
              const saMetadata = mapSmartAdvocateDocumentToInvoice(doc);
              const processResult = await processInvoiceAction({
                invoiceDataUri,
                caseNumber: metadata.caseNumber,
                documentID: metadata.documentID,
                description: metadata.description || undefined,
                comment: metadata.comments || undefined,
                smartAdvocateMetadata: saMetadata,
              });

              result.processedDocuments++;

              if (processResult.error) {
                result.failed++;

                await createDocumentSyncError({
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
                });

                sendEvent({
                  type: 'document_error',
                  timestamp: new Date().toISOString(),
                  data: {
                    currentDocument: documentCounter,
                    totalDocuments: result.filteredDocuments,
                    processedDocuments: result.processedDocuments,
                    successful: result.successful,
                    failed: result.failed,
                    skipped: result.skipped,
                    updated: result.updated,
                    documentId: metadata.documentID,
                    documentName: metadata.documentName,
                    caseNumber: metadata.caseNumber,
                    status: 'error',
                    error: processResult.error,
                  },
                });
              } else {
                result.successful++;

                sendEvent({
                  type: 'document_complete',
                  timestamp: new Date().toISOString(),
                  data: {
                    currentDocument: documentCounter,
                    totalDocuments: result.filteredDocuments,
                    processedDocuments: result.processedDocuments,
                    successful: result.successful,
                    failed: result.failed,
                    skipped: result.skipped,
                    updated: result.updated,
                    documentId: metadata.documentID,
                    documentName: metadata.documentName,
                    caseNumber: metadata.caseNumber,
                    status: 'success',
                    invoiceId: processResult.data?.id,
                    isUpdate,
                    message: isUpdate ? 'Updated successfully' : 'Created successfully',
                  },
                });
              }

              await new Promise(resolve => setTimeout(resolve, DOCUMENT_DELAY_MS));
            } catch (error) {
              result.failed++;
              result.processedDocuments++;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              await createDocumentSyncError({
                documentID: doc.documentID,
                error: errorMessage,
                errorType: 'Other',
                caseID: doc.caseID,
                caseNumber: doc.caseNumber,
                documentName: doc.documentName,
                categoryID: doc.categoryID,
                categoryName: doc.categoryName,
              });

              sendEvent({
                type: 'document_error',
                timestamp: new Date().toISOString(),
                data: {
                  currentDocument: documentCounter,
                  totalDocuments: result.filteredDocuments,
                  processedDocuments: result.processedDocuments,
                  successful: result.successful,
                  failed: result.failed,
                  skipped: result.skipped,
                  updated: result.updated,
                  documentId: metadata.documentID,
                  documentName: metadata.documentName,
                  caseNumber: metadata.caseNumber,
                  status: 'error',
                  error: errorMessage,
                },
              });

              await new Promise(resolve => setTimeout(resolve, DOCUMENT_DELAY_MS));
            }
          }

          // Page complete
          const totalPages = response.pageRequest?.totalPages ?? 0;
          
          sendEvent({
            type: 'page_complete',
            timestamp: new Date().toISOString(),
            data: {
              currentPage: currentPage + 1,
              totalPages,
              processedDocuments: result.processedDocuments,
              successful: result.successful,
              failed: result.failed,
              skipped: result.skipped,
              message: `Completed page ${currentPage + 1} of ${totalPages}`,
            },
          });

          hasMorePages = currentPage < totalPages - 1;
          currentPage++;

          if (hasMorePages) {
            await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS));
          }
        }

        // Revalidate paths
        revalidatePath('/invoices');
        revalidatePath('/approvals');
        revalidatePath('/dashboard');

        // Send complete event
        sendEvent({
          type: 'complete',
          timestamp: new Date().toISOString(),
          data: {
            totalDocuments: result.totalDocuments,
            filteredDocuments: result.filteredDocuments,
            processedDocuments: result.processedDocuments,
            successful: result.successful,
            failed: result.failed,
            skipped: result.skipped,
            updated: result.updated,
            message: `Sync completed! ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`,
          },
        });

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        sendEvent({
          type: 'error',
          timestamp: new Date().toISOString(),
          data: {
            error: errorMessage,
            message: 'Sync failed with an error',
          },
        });

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

