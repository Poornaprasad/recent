/**
 * Document sync error repository
 * Data access layer for document sync errors
 */

import 'server-only';

import { desc, eq, and, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/context';
import { documentSyncErrors, type DocumentSyncError } from '../db/schema';
import { nanoid } from 'nanoid';

/**
 * Create a new document sync error or update existing one
 * Prevents duplicates by checking for existing errors with the same documentID and caseNumber
 * 
 * @param error Error data to create or update
 * @returns The created or updated error
 */
export async function createDocumentSyncError(
  error: {
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
    // SmartAdvocate metadata fields
    saFromUniqueContactId?: number;
    saToContactName?: string;
    saFromContactName?: string;
    saDocType?: string; // Document type (e.g., "Img", "Pdf", etc.)
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
    metadata?: Record<string, any>;
  }
): Promise<DocumentSyncError> {
  // Check for existing error with same documentID and caseNumber
  const existingError = await findDocumentSyncErrorByDocumentAndCase(
    error.documentID,
    error.caseNumber,
    true // Prefer unresolved errors
  );

  if (existingError) {
    // Update existing error instead of creating duplicate
    // If it was resolved, mark it as unresolved since the error occurred again
    return await updateDocumentSyncError(existingError.id, {
      error: error.error,
      errorType: error.errorType,
      contentType: error.contentType,
      fileSize: error.fileSize,
      documentName: error.documentName,
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
      metadata: error.metadata,
      resolved: existingError.resolved ? false : undefined, // Mark as unresolved if it was resolved
      // SmartAdvocate metadata fields
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

  // No existing error found, create new one
  const db = await getDatabase();

  const id = nanoid();
  const now = new Date();

  const [row] = await db
    .insert(documentSyncErrors)
    .values({
      id,
      documentID: error.documentID,
      caseID: error.caseID,
      caseNumber: error.caseNumber,
      documentName: error.documentName,
      error: error.error,
      errorType: error.errorType,
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
      // SmartAdvocate metadata fields
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
      metadata: error.metadata ? JSON.stringify(error.metadata) : null,
      syncDate: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

/**
 * Get all document sync errors (with optional filters)
 */
export async function findAllDocumentSyncErrors(options?: {
  resolved?: boolean;
  errorType?: string;
  caseNumber?: string;
  limit?: number;
  offset?: number;
}): Promise<DocumentSyncError[]> {
  const db = await getDatabase();

  const conditions = [];

  if (options?.resolved !== undefined) {
    conditions.push(eq(documentSyncErrors.resolved, options.resolved));
  }

  if (options?.errorType) {
    conditions.push(eq(documentSyncErrors.errorType, options.errorType as 'Unsupported File Type' | 'Processing Error' | 'API Error' | 'Other'));
  }

  if (options?.caseNumber) {
    conditions.push(eq(documentSyncErrors.caseNumber, options.caseNumber));
  }

  const baseQuery = db.select().from(documentSyncErrors);
  
  const query = conditions.length > 0
    ? baseQuery.where(and(...conditions)).orderBy(desc(documentSyncErrors.syncDate))
    : baseQuery.orderBy(desc(documentSyncErrors.syncDate));

  const results = await query;

  // Apply limit and offset manually since Drizzle's chaining can be tricky
  let finalResults = results;
  if (options?.offset) {
    finalResults = finalResults.slice(options.offset);
  }
  if (options?.limit) {
    finalResults = finalResults.slice(0, options.limit);
  }

  return finalResults;
}

/**
 * Get document sync error by ID
 */
export async function findDocumentSyncErrorById(id: string): Promise<DocumentSyncError | undefined> {
  const db = await getDatabase();

  const [row] = await db
    .select()
    .from(documentSyncErrors)
    .where(eq(documentSyncErrors.id, id))
    .limit(1);

  return row;
}

/**
 * Get document sync error by document ID
 */
export async function findDocumentSyncErrorByDocumentID(documentID: number): Promise<DocumentSyncError | undefined> {
  const db = await getDatabase();

  const [row] = await db
    .select()
    .from(documentSyncErrors)
    .where(eq(documentSyncErrors.documentID, documentID))
    .orderBy(desc(documentSyncErrors.syncDate))
    .limit(1);

  return row;
}

/**
 * Find existing sync error by document ID and case number
 * This is used to prevent duplicate error entries for the same document
 * 
 * @param documentID The SmartAdvocate document ID
 * @param caseNumber The case number (can be null/undefined)
 * @param preferUnresolved If true, prefer unresolved errors over resolved ones
 * @returns The existing error if found, undefined otherwise
 */
export async function findDocumentSyncErrorByDocumentAndCase(
  documentID: number,
  caseNumber: string | null | undefined,
  preferUnresolved: boolean = true
): Promise<DocumentSyncError | undefined> {
  const db = await getDatabase();

  // Build conditions for documentID and caseNumber
  const conditions = [eq(documentSyncErrors.documentID, documentID)];
  
  if (caseNumber) {
    conditions.push(eq(documentSyncErrors.caseNumber, caseNumber));
  } else {
    // If caseNumber is null/undefined, match records where caseNumber is also null
    conditions.push(sql`${documentSyncErrors.caseNumber} IS NULL`);
  }

  // If preferUnresolved, first try to find unresolved errors
  if (preferUnresolved) {
    const unresolvedConditions = [...conditions, eq(documentSyncErrors.resolved, false)];
    const unresolvedRow = await db
      .select()
      .from(documentSyncErrors)
      .where(and(...unresolvedConditions))
      .orderBy(desc(documentSyncErrors.syncDate))
      .limit(1)
      .then(rows => rows[0]);
    
    if (unresolvedRow) {
      return unresolvedRow;
    }
  }

  // Otherwise, find any error (resolved or unresolved)
  const [row] = await db
    .select()
    .from(documentSyncErrors)
    .where(and(...conditions))
    .orderBy(desc(documentSyncErrors.syncDate))
    .limit(1);

  return row;
}

/**
 * Update an existing document sync error
 */
export async function updateDocumentSyncError(
  id: string,
  updates: {
    error?: string;
    errorType?: 'Unsupported File Type' | 'Processing Error' | 'API Error' | 'Other';
    contentType?: string;
    fileSize?: number;
    documentName?: string;
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
    metadata?: Record<string, any>;
    resolved?: boolean;
    // SmartAdvocate metadata fields
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
  }
): Promise<DocumentSyncError> {
  const db = await getDatabase();

  const updateData: any = {
    updatedAt: new Date(),
  };

  // Only update fields that are provided
  if (updates.error !== undefined) updateData.error = updates.error;
  if (updates.errorType !== undefined) updateData.errorType = updates.errorType;
  if (updates.contentType !== undefined) updateData.contentType = updates.contentType;
  if (updates.fileSize !== undefined) updateData.fileSize = updates.fileSize;
  if (updates.documentName !== undefined) updateData.documentName = updates.documentName;
  if (updates.categoryID !== undefined) updateData.categoryID = updates.categoryID;
  if (updates.categoryName !== undefined) updateData.categoryName = updates.categoryName;
  if (updates.subCategoryID !== undefined) updateData.subCategoryID = updates.subCategoryID;
  if (updates.subCategoryName !== undefined) updateData.subCategoryName = updates.subCategoryName;
  if (updates.subSubCategoryID !== undefined) updateData.subSubCategoryID = updates.subSubCategoryID;
  if (updates.subSubSubCategoryID !== undefined) updateData.subSubSubCategoryID = updates.subSubSubCategoryID;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.comments !== undefined) updateData.comments = updates.comments;
  if (updates.createdDate !== undefined) updateData.createdDate = updates.createdDate;
  if (updates.modifiedDate !== undefined) updateData.modifiedDate = updates.modifiedDate;
  if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata);
  if (updates.resolved !== undefined) {
    updateData.resolved = updates.resolved;
    if (updates.resolved === false) {
      // If marking as unresolved, clear resolution fields
      updateData.resolvedAt = null;
      updateData.resolvedBy = null;
      updateData.resolutionNotes = null;
    }
  }

  // SmartAdvocate metadata fields
  if (updates.saFromUniqueContactId !== undefined) updateData.saFromUniqueContactId = updates.saFromUniqueContactId;
  if (updates.saToContactName !== undefined) updateData.saToContactName = updates.saToContactName;
  if (updates.saFromContactName !== undefined) updateData.saFromContactName = updates.saFromContactName;
  if (updates.saDocType !== undefined) updateData.saDocType = updates.saDocType;
  if (updates.saTemplateId !== undefined) updateData.saTemplateId = updates.saTemplateId;
  if (updates.saAttachFlag !== undefined) updateData.saAttachFlag = updates.saAttachFlag;
  if (updates.saCreatedUserId !== undefined) updateData.saCreatedUserId = updates.saCreatedUserId;
  if (updates.saModifiedUserId !== undefined) updateData.saModifiedUserId = updates.saModifiedUserId;
  if (updates.saMedProvUniqueContactId !== undefined) updateData.saMedProvUniqueContactId = updates.saMedProvUniqueContactId;
  if (updates.saIsReviewed !== undefined) updateData.saIsReviewed = updates.saIsReviewed;
  if (updates.saToUniqueContactId !== undefined) updateData.saToUniqueContactId = updates.saToUniqueContactId;
  if (updates.saDocumentDate !== undefined) updateData.saDocumentDate = updates.saDocumentDate;
  if (updates.saPriority !== undefined) updateData.saPriority = updates.saPriority;
  if (updates.saPriorityName !== undefined) updateData.saPriorityName = updates.saPriorityName;
  if (updates.saDocumentDirection !== undefined) updateData.saDocumentDirection = updates.saDocumentDirection;
  if (updates.saDirectionName !== undefined) updateData.saDirectionName = updates.saDirectionName;
  if (updates.saDocumentOrigin !== undefined) updateData.saDocumentOrigin = updates.saDocumentOrigin;
  if (updates.saOriginName !== undefined) updateData.saOriginName = updates.saOriginName;
  if (updates.saIsSharedInPortal !== undefined) updateData.saIsSharedInPortal = updates.saIsSharedInPortal;
  if (updates.saIsSharedWithEveryoneInPortal !== undefined) updateData.saIsSharedWithEveryoneInPortal = updates.saIsSharedWithEveryoneInPortal;
  if (updates.saCaseDocumentId !== undefined) updateData.saCaseDocumentId = updates.saCaseDocumentId;
  if (updates.saDeliveryMethodId !== undefined) updateData.saDeliveryMethodId = updates.saDeliveryMethodId;
  if (updates.saDeliveryName !== undefined) updateData.saDeliveryName = updates.saDeliveryName;

  // Always update syncDate to track when the error last occurred
  updateData.syncDate = new Date();

  const [row] = await db
    .update(documentSyncErrors)
    .set(updateData)
    .where(eq(documentSyncErrors.id, id))
    .returning();

  return row;
}

/**
 * Mark error as resolved
 */
export async function resolveDocumentSyncError(
  id: string,
  resolvedBy: string,
  resolutionNotes?: string
): Promise<void> {
  const db = await getDatabase();

  await db
    .update(documentSyncErrors)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
      resolutionNotes,
      updatedAt: new Date(),
    })
    .where(eq(documentSyncErrors.id, id));
}

/**
 * Get error statistics
 */
export async function getDocumentSyncErrorStats(): Promise<{
  total: number;
  resolved: number;
  unresolved: number;
  byErrorType: Record<string, number>;
}> {
  const db = await getDatabase();

  const allErrors = await db.select().from(documentSyncErrors);

  const stats = {
    total: allErrors.length,
    resolved: allErrors.filter(e => e.resolved).length,
    unresolved: allErrors.filter(e => !e.resolved).length,
    byErrorType: {} as Record<string, number>,
  };

  allErrors.forEach(error => {
    const type = error.errorType || 'Other';
    stats.byErrorType[type] = (stats.byErrorType[type] || 0) + 1;
  });

  return stats;
}

/**
 * Delete a document sync error by ID
 */
export async function deleteDocumentSyncError(id: string): Promise<void> {
  const db = await getDatabase();
  await db
    .delete(documentSyncErrors)
    .where(eq(documentSyncErrors.id, id));
}

/**
 * Delete all document sync errors (use with caution)
 */
export async function deleteAllDocumentSyncErrors(): Promise<number> {
  const db = await getDatabase();
  const result = await db.delete(documentSyncErrors);
  return result.rowCount || 0;
}

/**
 * Delete all resolved document sync errors
 */
export async function deleteResolvedDocumentSyncErrors(): Promise<number> {
  const db = await getDatabase();
  const result = await db
    .delete(documentSyncErrors)
    .where(eq(documentSyncErrors.resolved, true));
  return result.rowCount || 0;
}

