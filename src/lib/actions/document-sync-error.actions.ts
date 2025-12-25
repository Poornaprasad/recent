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

