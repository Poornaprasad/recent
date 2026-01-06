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

