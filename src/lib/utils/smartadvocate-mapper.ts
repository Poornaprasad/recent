/**
 * Utility functions to map SmartAdvocate document fields to invoice fields
 */

import type { SmartAdvocateDocument } from '../crm/smartadvocate/types';
import type { StoredInvoice } from '../domain/types';

/**
 * Parse date string from SmartAdvocate API
 * Handles various date formats from the API
 */
function parseSADate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  try {
    return new Date(dateStr);
  } catch {
    return undefined;
  }
}

/**
 * Map SmartAdvocate document to invoice SmartAdvocate metadata fields
 */
export function mapSmartAdvocateDocumentToInvoice(
  doc: SmartAdvocateDocument
): Partial<Pick<StoredInvoice, 
  | 'saCaseId'
  | 'saDocumentName'
  | 'saFromUniqueContactId'
  | 'saToContactName'
  | 'saFromContactName'
  | 'saDocType'
  | 'saTemplateId'
  | 'saAttachFlag'
  | 'saCreatedUserId'
  | 'saCreatedDate'
  | 'saModifiedUserId'
  | 'saModifiedDate'
  | 'saCategoryId'
  | 'saCategoryName'
  | 'saSubCategoryId'
  | 'saSubCategoryName'
  | 'saSubSubCategoryId'
  | 'saSubSubSubCategoryId'
  | 'saMedProvUniqueContactId'
  | 'saIsReviewed'
  | 'saToUniqueContactId'
  | 'saDocumentDate'
  | 'saPriority'
  | 'saPriorityName'
  | 'saDocumentDirection'
  | 'saDirectionName'
  | 'saDocumentOrigin'
  | 'saOriginName'
  | 'saIsSharedInPortal'
  | 'saIsSharedWithEveryoneInPortal'
  | 'saCaseDocumentId'
  | 'saDeliveryMethodId'
  | 'saDeliveryName'
  | 'saMetadata'
>> {
  // Extract known fields
  const knownFields: Record<string, unknown> = {
    saCaseId: doc.caseID,
    saDocumentName: doc.documentName,
    saFromUniqueContactId: doc.fromUniqueContactID,
    saToContactName: doc.toContactName,
    saFromContactName: doc.fromContactName,
    saDocType: doc.docType,
    saTemplateId: doc.templateID,
    saAttachFlag: doc.attachFlag,
    saCreatedUserId: doc.createdUserID,
    saCreatedDate: parseSADate(doc.createdDate),
    saModifiedUserId: doc.modifiedUserID,
    saModifiedDate: parseSADate(doc.modifiedDate),
    saCategoryId: doc.categoryID,
    saCategoryName: doc.categoryName,
    saSubCategoryId: doc.subCategoryID,
    saSubCategoryName: doc.subCategoryName,
    saSubSubCategoryId: doc.subSubCategoryID,
    saSubSubSubCategoryId: doc.subSubSubCategoryID,
    saMedProvUniqueContactId: doc.medProvUniqueContactID,
    saIsReviewed: doc.isReviewed,
    saToUniqueContactId: doc.toUniqueContactID,
    saDocumentDate: parseSADate(doc.documentDate),
    saPriority: doc.priority,
    saPriorityName: doc.priorityName,
    saDocumentDirection: doc.documentDirection,
    saDirectionName: doc.directionName,
    saDocumentOrigin: doc.documentOrigin,
    saOriginName: doc.originName,
    saIsSharedInPortal: doc.isSharedInPortal,
    saIsSharedWithEveryoneInPortal: doc.isSharedWithEveryoneInPortal,
    saCaseDocumentId: doc.caseDocumentID,
  };

  // Extract deliveryMethodId and deliveryName from the document
  // These might be in the document object directly or in metadata
  const deliveryMethodId = (doc as any).deliveryMethodId;
  const deliveryName = (doc as any).deliveryName;

  // Collect any additional fields not in our schema into metadata
  const metadataFields: Record<string, unknown> = {};
  const knownFieldNames = new Set([
    'documentID', 'caseID', 'caseNumber', 'documentName',
    'fromUniqueContactID', 'toContactName', 'fromContactName',
    'docType', 'templateID', 'attachFlag', 'description',
    'createdUserID', 'createdDate', 'modifiedUserID', 'modifiedDate',
    'categoryID', 'categoryName', 'subCategoryID', 'subCategoryName',
    'subSubCategoryID', 'subSubSubCategoryID', 'medProvUniqueContactID',
    'comments', 'isReviewed', 'toUniqueContactID', 'documentDate',
    'priority', 'priorityName', 'documentDirection', 'directionName',
    'documentOrigin', 'originName', 'isSharedInPortal',
    'isSharedWithEveryoneInPortal', 'caseDocumentID', 'deliveryMethodId', 'deliveryName'
  ]);

  // Store any unknown fields in metadata
  for (const [key, value] of Object.entries(doc)) {
    if (!knownFieldNames.has(key) && value !== undefined && value !== null) {
      metadataFields[key] = value;
    }
  }

  return {
    ...knownFields,
    saDeliveryMethodId: deliveryMethodId,
    saDeliveryName: deliveryName,
    saMetadata: Object.keys(metadataFields).length > 0 ? metadataFields : undefined,
  } as any;
}

