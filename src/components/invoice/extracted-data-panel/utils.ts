/**
 * Utility functions for ExtractedDataPanel
 */

// Fields excluded from the extracted fields list
export const EXCLUDED_FIELDS = [
  'id', 'invoiceDataUri', 'status', 'isDuplicate', 'duplicateReason',
  'lineItems', 'documentType', 'isHighValue', 'highValueReason',
  'requiresEscalation', 'escalationLevel', 'escalationReason',
  'hasMultipleVendors', 'accuracyScore', 'requiresSpecialHandling',
  'specialHandlingReason', 'comment', 'caseNumber', 'plaintiffName',
  'state', 'paymentType', 'approvalStatus', 'approvedBy', 'approvedAt',
  'createdBy', 'assignedTo', 'disbursementResponse', 'crmStatus',
  'isRecurring', 'recurringPattern', 'hasAmountAnomaly',
  'amountAnomalyReason', 'expectedAmount', 'amountDeviationPercent',
  'vendorRequires1099', 'documentHash', 'documentID',
  'saCaseId', 'saDocumentName', 'saFromUniqueContactId', 'saToContactName',
  'saFromContactName', 'saDocType', 'saTemplateId', 'saAttachFlag',
  'saCreatedUserId', 'saCreatedDate', 'saModifiedUserId', 'saModifiedDate',
  'saCategoryId', 'saCategoryName', 'saSubCategoryId', 'saSubCategoryName',
  'saSubSubCategoryId', 'saSubSubSubCategoryId', 'saMedProvUniqueContactId',
  'saIsReviewed', 'saToUniqueContactId', 'saDocumentDate', 'saPriority',
  'saPriorityName', 'saDocumentDirection', 'saDirectionName',
  'saDocumentOrigin', 'saOriginName', 'saIsSharedInPortal',
  'saIsSharedWithEveryoneInPortal', 'saCaseDocumentId', 'saDeliveryMethodId',
  'saDeliveryName', 'saMetadata', 'createdAt', 'updatedAt',
];

/**
 * Convert field names to title case with proper spacing
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
}

/**
 * Get default disbursement status ID based on document type
 */
export function getDefaultStatusId(docType: string | undefined): string {
  if (!docType) return '';
  const type = docType.toLowerCase();
  if (type === 'invoice') return '1'; // Issue Check
  if (type === 'receipt') return '3'; // Paid
  return '';
}

/**
 * Validate bounding box structure
 */
export function isValidBbox(bbox: any): boolean {
  if (!bbox || !Array.isArray(bbox) || bbox.length < 4) {
    return false;
  }
  return bbox.every((p: any) =>
    typeof p === 'object' &&
    p !== null &&
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    !isNaN(p.x) &&
    !isNaN(p.y)
  );
}
