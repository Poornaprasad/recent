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
      invoiceDataUri = await convertPdfToImageServer(invoiceDataUri);
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
      return {
        success: false,
        error: result.error,
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

