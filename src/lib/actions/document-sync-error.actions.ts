/**
 * Document sync error server actions
 * Next.js server actions for managing document sync errors
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  findAllDocumentSyncErrors,
  findDocumentSyncErrorById,
  resolveDocumentSyncError,
  getDocumentSyncErrorStats,
} from '../repositories/document-sync-error.repository';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

/**
 * Get all document sync errors
 */
export async function getDocumentSyncErrorsAction(options?: {
  resolved?: boolean;
  errorType?: string;
  caseNumber?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<Awaited<ReturnType<typeof findAllDocumentSyncErrors>>>> {
  return withActionHandler(async () => {
    return await findAllDocumentSyncErrors(options);
  }, 'Failed to fetch document sync errors');
}

/**
 * Get document sync error by ID
 */
export async function getDocumentSyncErrorByIdAction(
  id: string
): Promise<ActionResult<Awaited<ReturnType<typeof findDocumentSyncErrorById>>>> {
  return withActionHandler(async () => {
    return await findDocumentSyncErrorById(id);
  }, 'Failed to fetch document sync error');
}

/**
 * Resolve a document sync error
 */
export async function resolveDocumentSyncErrorAction(
  id: string,
  resolvedBy: string,
  resolutionNotes?: string
): Promise<ActionResult<void>> {
  return withActionHandler(async () => {
    await resolveDocumentSyncError(id, resolvedBy, resolutionNotes);
    revalidatePath('/sync-errors');
  }, 'Failed to resolve document sync error');
}

/**
 * Get document sync error statistics
 */
export async function getDocumentSyncErrorStatsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getDocumentSyncErrorStats>>>
> {
  return withActionHandler(async () => {
    return await getDocumentSyncErrorStats();
  }, 'Failed to fetch document sync error statistics');
}

/**
 * Get document content by document ID from SmartAdvocate
 * Returns a URL to the document API route instead of data URI for better performance
 * This avoids data URI size limitations and allows documents to be viewed directly
 */
export async function getDocumentContentAction(
  documentID: number
): Promise<ActionResult<{ dataUri: string; contentType: string; url?: string }>> {
  return withActionHandler(async () => {
    // Always use API route for viewing documents - this is more efficient and avoids data URI limitations
    // The API route will fetch and serve the document on-demand
    const documentUrl = `/api/documents/${documentID}`;
    
    // Fetch document metadata to verify it exists and get content type
    try {
      const { getDocumentContent } = await import('../crm/smartadvocate/document');
      const content = await getDocumentContent(documentID);
      
      // Check if buffer is empty
      if (content.size === 0) {
        throw new Error('Document content is empty (0 bytes)');
      }
      
      // Return the API route URL - the viewer will fetch it directly
      // This is more efficient than converting to data URI and avoids size limitations
      return {
        url: documentUrl,
        dataUri: documentUrl, // Use URL as dataUri for compatibility with existing viewer code
        contentType: content.contentType,
      };
    } catch (error) {
      // If fetching fails, we can't provide a URL either
      throw error;
    }
  }, 'Failed to fetch document content');
}

/**
 * Delete a document sync error by ID
 */
export async function deleteDocumentSyncErrorAction(
  id: string
): Promise<ActionResult<void>> {
  return withActionHandler(async () => {
    const { deleteDocumentSyncError } = await import('../repositories/document-sync-error.repository');
    await deleteDocumentSyncError(id);
    revalidatePath('/sync-errors');
  }, 'Failed to delete document sync error');
}

/**
 * Delete all document sync errors
 */
export async function deleteAllDocumentSyncErrorsAction(): Promise<ActionResult<{ deletedCount: number }>> {
  return withActionHandler(async () => {
    const { deleteAllDocumentSyncErrors } = await import('../repositories/document-sync-error.repository');
    const deletedCount = await deleteAllDocumentSyncErrors();
    revalidatePath('/sync-errors');
    return { deletedCount };
  }, 'Failed to delete all document sync errors');
}

/**
 * Delete all resolved document sync errors
 */
export async function deleteResolvedDocumentSyncErrorsAction(): Promise<ActionResult<{ deletedCount: number }>> {
  return withActionHandler(async () => {
    const { deleteResolvedDocumentSyncErrors } = await import('../repositories/document-sync-error.repository');
    const deletedCount = await deleteResolvedDocumentSyncErrors();
    revalidatePath('/sync-errors');
    return { deletedCount };
  }, 'Failed to delete resolved document sync errors');
}

/**
 * Retry syncing a single document by document ID
 * Fetches the document from SmartAdvocate and processes it through the invoice processing flow
 */
export async function retryDocumentSyncAction(
  documentID: number
): Promise<ActionResult<{ success: boolean; invoiceId?: string; error?: string }>> {
  return withActionHandler(async () => {
    const { getDocumentContent, extractDocumentMetadata } = await import('../crm/smartadvocate/document');
    const { mapSmartAdvocateDocumentToInvoice } = await import('../utils/smartadvocate-mapper');
    const { processInvoiceAction } = await import('./invoice.actions');
    const { convertPdfToImageServer } = await import('../pdf-to-image-server');
    const { convertWordToPdf } = await import('../word-to-pdf-server');
    const { findDocumentSyncErrorByDocumentID } = await import('../repositories/document-sync-error.repository');
    
    // Get the sync error to access stored metadata
    const syncError = await findDocumentSyncErrorByDocumentID(documentID);
    if (!syncError) {
      throw new Error(`Sync error not found for document ID ${documentID}`);
    }

    // Fetch document content
    const content = await getDocumentContent(documentID);

    // Check document size before processing to prevent stack overflow
    // Note: This check only applies to processing/retry, NOT to viewing
    // Documents can always be viewed regardless of size
    const dataUriMatch = content.dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUriMatch && dataUriMatch[2]) {
      const base64Data = dataUriMatch[2];
      const estimatedSize = (base64Data.length * 3) / 4; // Approximate binary size
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (estimatedSize > maxSize) {
        throw new Error(
          `Document is too large for processing (${Math.round(estimatedSize / 1024 / 1024)}MB). ` +
          `Maximum size for processing is ${maxSize / 1024 / 1024}MB. ` +
          `Note: You can still view this document, but it cannot be automatically processed. ` +
          `Please split the document into smaller files or process it manually.`
        );
      }
    } else {
      // If content.size is available, check that instead (for non-data-URI content)
      if (content.size && content.size > 50 * 1024 * 1024) {
        throw new Error(
          `Document is too large for processing (${Math.round(content.size / 1024 / 1024)}MB). ` +
          `Maximum size for processing is 50MB. ` +
          `Note: You can still view this document, but it cannot be automatically processed. ` +
          `Please split the document into smaller files or process it manually.`
        );
      }
    }

    // Check for unsupported file types
    const fileExtension = syncError.documentName?.split('.').pop()?.toLowerCase() || '';
    const isMsgFile = fileExtension === 'msg' || 
                      content.contentType === 'application/vnd.ms-outlook' ||
                      content.contentType === 'message/rfc822';
    
    if (isMsgFile) {
      throw new Error('Unsupported format (.msg files are not supported)');
    }

    const SUPPORTED_FILE_TYPES = [
      'application/pdf',
      'application/octet-stream',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/heic',
    ];

    const isOctetStreamWordDoc = content.contentType === 'application/octet-stream' && 
      (fileExtension === 'doc' || fileExtension === 'docx');
    const isOctetStreamPdf = content.contentType === 'application/octet-stream' && 
      fileExtension === 'pdf';
    const isOctetStreamImage = content.contentType === 'application/octet-stream' && 
      (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png' || fileExtension === 'heic');
    
    if (!SUPPORTED_FILE_TYPES.includes(content.contentType) && !isOctetStreamWordDoc && !isOctetStreamPdf && !isOctetStreamImage) {
      throw new Error(`Unsupported file type: ${content.contentType}. Only PDF, images, and Word documents are supported.`);
    }

    // Convert Word documents to PDF first
    let invoiceDataUri = content.dataUri;
    const isWordDocumentByMime = 
      content.contentType === 'application/msword' ||
      content.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isWordDocumentByExtension = fileExtension === 'doc' || fileExtension === 'docx';
    const isWordDocument = isWordDocumentByMime || 
      (content.contentType === 'application/octet-stream' && isWordDocumentByExtension);
    
    if (isWordDocument) {
      const isDocx = content.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                     fileExtension === 'docx';
      invoiceDataUri = await convertWordToPdf(content.dataUri, isDocx);
    }

    // Convert PDF to image if needed
    const isPdfOrOctetStream =
      content.contentType === 'application/pdf' ||
      (content.contentType === 'application/octet-stream' && !isWordDocument);

    if (isPdfOrOctetStream) {
      // Check PDF page count before conversion to prevent stack overflow
      // Large PDFs with many pages can cause stack overflow during processing
      try {
        const { getPdfPageCount } = await import('../pdf-to-image-server');
        const pageCount = await getPdfPageCount(invoiceDataUri);
        const maxPages = 50; // Limit to 50 pages to prevent stack overflow
        if (pageCount > maxPages) {
          throw new Error(
            `PDF has too many pages for processing (${pageCount} pages). ` +
            `Maximum supported for processing is ${maxPages} pages. ` +
            `Note: You can still view this document, but it cannot be automatically processed. ` +
            `Please split the document into smaller files or process it manually.`
          );
        }
      } catch (error) {
        // If page count check fails, log but continue (might not be a PDF or check failed)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('too many pages')) {
          throw error; // Re-throw page count errors
        }
        // Otherwise, continue with conversion (page count check is optional)
        console.warn(`[Retry] Could not check PDF page count: ${errorMessage}`);
      }
      
      invoiceDataUri = await convertPdfToImageServer(invoiceDataUri);
      
      // Check the converted image size to prevent stack overflow during AI processing
      const imageDataUriMatch = invoiceDataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (imageDataUriMatch && imageDataUriMatch[2]) {
        const base64Data = imageDataUriMatch[2];
        const estimatedSize = (base64Data.length * 3) / 4; // Approximate binary size
        const maxImageSize = 20 * 1024 * 1024; // 20MB limit for images
        if (estimatedSize > maxImageSize) {
          throw new Error(
            `Converted image is too large (${Math.round(estimatedSize / 1024 / 1024)}MB). ` +
            `Maximum size is ${maxImageSize / 1024 / 1024}MB. ` +
            `The PDF may be too large or have too many pages. ` +
            `Please split the document or use a smaller file.`
          );
        }
      }
    }

    // Reconstruct SmartAdvocate metadata from sync error
    const saMetadata = {
      fromUniqueContactID: syncError.saFromUniqueContactId,
      toContactName: syncError.saToContactName,
      fromContactName: syncError.saFromContactName,
      docType: syncError.saDocType,
      templateID: syncError.saTemplateId,
      attachFlag: syncError.saAttachFlag,
      createdUserID: syncError.saCreatedUserId,
      modifiedUserID: syncError.saModifiedUserId,
      medProvUniqueContactID: syncError.saMedProvUniqueContactId,
      isReviewed: syncError.saIsReviewed,
      toUniqueContactID: syncError.saToUniqueContactId,
      documentDate: syncError.saDocumentDate,
      priority: syncError.saPriority,
      priorityName: syncError.saPriorityName,
      documentDirection: syncError.saDocumentDirection,
      directionName: syncError.saDirectionName,
      documentOrigin: syncError.saDocumentOrigin,
      originName: syncError.saOriginName,
      isSharedInPortal: syncError.saIsSharedInPortal,
      isSharedWithEveryoneInPortal: syncError.saIsSharedWithEveryoneInPortal,
      caseDocumentID: syncError.saCaseDocumentId,
      deliveryMethodId: syncError.saDeliveryMethodId,
      deliveryName: syncError.saDeliveryName,
    };

    // Process the document
    const result = await processInvoiceAction({
      invoiceDataUri,
      caseNumber: syncError.caseNumber || undefined,
      documentID: syncError.documentID,
      description: syncError.description || undefined,
      comment: syncError.comments || undefined,
      smartAdvocateMetadata: saMetadata,
    });

    if (result.error) {
      // Provide more helpful error messages for stack overflow errors
      let errorMessage = result.error;
      if (result.error.includes('Maximum call stack size exceeded') || 
          result.error.includes('stack overflow') ||
          result.error.includes('Document processing failed due to size or complexity')) {
        errorMessage = 
          'Document processing failed due to size or complexity. This document may be too large, have too many pages, or be too complex for automatic processing. ' +
          'Note: You can still view this document using the "View Document" button. ' +
          'To process it, please try: (1) Splitting the document into smaller files, (2) Reducing the file size, or (3) Using a simpler document format. ' +
          'If this is a PDF, try reducing the number of pages or compressing the file.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Revalidate paths
    revalidatePath('/invoices');
    revalidatePath('/approvals');
    revalidatePath('/dashboard');
    revalidatePath('/sync-errors');

    return {
      success: true,
      invoiceId: result.data?.id,
    };
  }, 'Failed to retry document sync');
}

