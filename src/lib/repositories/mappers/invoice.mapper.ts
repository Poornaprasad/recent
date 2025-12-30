/**
 * Invoice mapper utilities
 * Maps between database rows and domain types
 */

import type { Invoice } from '../../db/schema';
import type { StoredInvoice, ExtractedField } from '../../domain/types';
import { parseInvoiceAmount } from '../../utils/invoice-utils';

/**
 * Parse metadata JSON string
 */
function parseMeta(meta: string | null): Record<string, any> {
  if (!meta) return {};
  try {
    const parsed = JSON.parse(meta);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to parse metadata:', meta, error);
    return {};
  }
}

/**
 * Serialize metadata to JSON string
 */
export function serializeMeta(field: any): string | null {
  if (!field || typeof field !== 'object') return null;
  const { value, ...meta } = field;
  if (Object.keys(meta).length === 0) return null;
  try {
    return JSON.stringify(meta);
  } catch (error) {
    console.warn('Failed to serialize metadata:', meta, error);
    return null;
  }
}

/**
 * Create an ExtractedField with metadata
 */
function createField<T>(value: T | null | undefined, meta: string | null): ExtractedField<T> | null {
  if (value === null || value === undefined) return null;
  return {
    value,
    ...parseMeta(meta),
  } as ExtractedField<T>;
}

/**
 * Map database row to StoredInvoice domain object
 */
export function mapDbRowToInvoice(row: Invoice): StoredInvoice {
  return {
    id: row.id,
    status: row.status as StoredInvoice['status'],
    invoiceDataUri: row.invoiceDataUri,
    documentType: row.documentType as StoredInvoice['documentType'] | undefined,
    isDuplicate: row.isDuplicate ? true : undefined,
    duplicateReason: row.duplicateReason || undefined,
    isRecurring: row.isRecurring ? true : undefined,
    recurringPattern: row.recurringPattern || undefined,
    hasAmountAnomaly: row.hasAmountAnomaly ? true : undefined,
    amountAnomalyReason: row.amountAnomalyReason || undefined,
    expectedAmount: row.expectedAmount !== null && row.expectedAmount !== undefined ? Number(row.expectedAmount) : undefined,
    amountDeviationPercent: row.amountDeviationPercent !== null && row.amountDeviationPercent !== undefined ? Number(row.amountDeviationPercent) : undefined,
    isHighValue: row.isHighValue ? true : undefined,
    highValueReason: row.highValueReason || undefined,
    requiresEscalation: row.requiresEscalation ? true : undefined,
    escalationLevel: row.escalationLevel as 'standard' | 'high' | 'critical' | undefined,
    comment: row.comment || undefined,
    caseNumber: row.caseNumber || undefined,
    plaintiffName: row.plaintiffName || undefined,
    state: row.state as 'CA' | 'NY' | undefined,
    paymentType: row.paymentType as 'Receipt' | 'Invoice' | 'Non-Financial' | 'Other' | undefined,
    approvalStatus: row.approvalStatus as 'Pending' | 'Approved' | 'Rejected' | 'Requires_Approval' | undefined,
    approvedBy: row.approvedBy || undefined,
    approvedAt: row.approvedAt instanceof Date ? row.approvedAt : undefined,
    createdBy: row.createdBy || undefined,
    assignedTo: row.assignedTo || undefined,
    disbursementResponse: row.disbursementResponse ? (() => {
      try {
        return JSON.parse(row.disbursementResponse);
      } catch {
        return row.disbursementResponse;
      }
    })() : undefined,
    crmStatus: row.crmStatus as StoredInvoice['crmStatus'] | undefined,
    documentHash: row.documentHash || undefined,
    documentID: row.documentID !== null && row.documentID !== undefined ? Number(row.documentID) : undefined,

    // SmartAdvocate metadata fields
    saCaseId: row.saCaseId !== null && row.saCaseId !== undefined ? Number(row.saCaseId) : undefined,
    saDocumentName: row.saDocumentName || undefined,
    saFromUniqueContactId: row.saFromUniqueContactId !== null && row.saFromUniqueContactId !== undefined ? Number(row.saFromUniqueContactId) : undefined,
    saToContactName: row.saToContactName || undefined,
    saFromContactName: row.saFromContactName || undefined,
    saDocType: row.saDocType || undefined,
    saTemplateId: row.saTemplateId !== null && row.saTemplateId !== undefined ? Number(row.saTemplateId) : undefined,
    saAttachFlag: row.saAttachFlag ? true : undefined,
    saCreatedUserId: row.saCreatedUserId !== null && row.saCreatedUserId !== undefined ? Number(row.saCreatedUserId) : undefined,
    saCreatedDate: row.saCreatedDate instanceof Date ? row.saCreatedDate : undefined,
    saModifiedUserId: row.saModifiedUserId !== null && row.saModifiedUserId !== undefined ? Number(row.saModifiedUserId) : undefined,
    saModifiedDate: row.saModifiedDate instanceof Date ? row.saModifiedDate : undefined,
    saCategoryId: row.saCategoryId !== null && row.saCategoryId !== undefined ? Number(row.saCategoryId) : undefined,
    saCategoryName: row.saCategoryName || undefined,
    saSubCategoryId: row.saSubCategoryId !== null && row.saSubCategoryId !== undefined ? Number(row.saSubCategoryId) : undefined,
    saSubCategoryName: row.saSubCategoryName || undefined,
    saSubSubCategoryId: row.saSubSubCategoryId !== null && row.saSubSubCategoryId !== undefined ? Number(row.saSubSubCategoryId) : undefined,
    saSubSubSubCategoryId: row.saSubSubSubCategoryId !== null && row.saSubSubSubCategoryId !== undefined ? Number(row.saSubSubSubCategoryId) : undefined,
    saMedProvUniqueContactId: row.saMedProvUniqueContactId !== null && row.saMedProvUniqueContactId !== undefined ? Number(row.saMedProvUniqueContactId) : undefined,
    saIsReviewed: row.saIsReviewed ? true : undefined,
    saToUniqueContactId: row.saToUniqueContactId !== null && row.saToUniqueContactId !== undefined ? Number(row.saToUniqueContactId) : undefined,
    saDocumentDate: row.saDocumentDate instanceof Date ? row.saDocumentDate : undefined,
    saPriority: row.saPriority !== null && row.saPriority !== undefined ? Number(row.saPriority) : undefined,
    saPriorityName: row.saPriorityName || undefined,
    saDocumentDirection: row.saDocumentDirection !== null && row.saDocumentDirection !== undefined ? Number(row.saDocumentDirection) : undefined,
    saDirectionName: row.saDirectionName || undefined,
    saDocumentOrigin: row.saDocumentOrigin !== null && row.saDocumentOrigin !== undefined ? Number(row.saDocumentOrigin) : undefined,
    saOriginName: row.saOriginName || undefined,
    saIsSharedInPortal: row.saIsSharedInPortal ? true : undefined,
    saIsSharedWithEveryoneInPortal: row.saIsSharedWithEveryoneInPortal ? true : undefined,
    saCaseDocumentId: row.saCaseDocumentId !== null && row.saCaseDocumentId !== undefined ? Number(row.saCaseDocumentId) : undefined,
    saDeliveryMethodId: row.saDeliveryMethodId !== null && row.saDeliveryMethodId !== undefined ? Number(row.saDeliveryMethodId) : undefined,
    saDeliveryName: row.saDeliveryName || undefined,
    saMetadata: row.saMetadata ? (() => {
      try {
        return JSON.parse(row.saMetadata);
      } catch {
        return row.saMetadata;
      }
    })() : undefined,

    // Extracted fields with metadata
    invoiceNumber: createField(row.invoiceNumber, row.invoiceNumberMeta),
    invoiceDate: createField(row.invoiceDate, row.invoiceDateMeta),
    vendorName: createField(row.vendorName, row.vendorNameMeta),
    vendorAddress: createField(row.vendorAddress, row.vendorAddressMeta),
    customerName: createField(row.customerName, row.customerNameMeta),
    clientName: createField(row.clientName, row.clientNameMeta),
    totalAmount: createField(row.totalAmount, row.totalAmountMeta),
    amount: createField(row.amount, row.amountMeta),
    paymentTerms: createField(row.paymentTerms, row.paymentTermsMeta),
    description: createField(row.description, row.descriptionMeta),
    dueDate: createField(row.dueDate, row.dueDateMeta),
    lineItems: row.lineItems ? createField(
      typeof row.lineItems === 'string' ? JSON.parse(row.lineItems) : row.lineItems,
      row.lineItemsMeta
    ) : null,
  };
}

/**
 * Map StoredInvoice domain object to database row
 */
export function mapInvoiceToDbRow(invoice: Partial<StoredInvoice>): Partial<Invoice> {
  const extractValue = (field: any) => field?.value ?? null;
  
  // Special extractor for totalAmount that parses string values to numbers
  // The database expects a real (number) type, so we parse string values like "$5.44 USD" to numbers
  const extractTotalAmount = (field: any): number | null => {
    if (!field || field.value === null || field.value === undefined) {
      return null;
    }
    // Parse the value - handles both string (e.g., "$5.44 USD") and number types
    return parseInvoiceAmount(field.value);
  };

  return {
    id: invoice.id,
    status: invoice.status,
    invoiceDataUri: invoice.invoiceDataUri,
    documentType: invoice.documentType,
    isDuplicate: invoice.isDuplicate ? 1 : 0,
    duplicateReason: invoice.duplicateReason,
    isRecurring: invoice.isRecurring ? 1 : 0,
    recurringPattern: invoice.recurringPattern,
    hasAmountAnomaly: invoice.hasAmountAnomaly ? 1 : 0,
    amountAnomalyReason: invoice.amountAnomalyReason,
    expectedAmount: invoice.expectedAmount,
    amountDeviationPercent: invoice.amountDeviationPercent,
    isHighValue: invoice.isHighValue ? 1 : 0,
    highValueReason: invoice.highValueReason,
    requiresEscalation: invoice.requiresEscalation ? 1 : 0,
    escalationLevel: invoice.escalationLevel,
    comment: invoice.comment,
    caseNumber: invoice.caseNumber,
    plaintiffName: invoice.plaintiffName,
    state: invoice.state,
    paymentType: invoice.paymentType,
    approvalStatus: invoice.approvalStatus,
    approvedBy: invoice.approvedBy,
    approvedAt: invoice.approvedAt instanceof Date && !isNaN(invoice.approvedAt.getTime()) ? invoice.approvedAt : undefined,
    createdBy: invoice.createdBy,
    assignedTo: invoice.assignedTo,
    disbursementResponse: invoice.disbursementResponse ? (typeof invoice.disbursementResponse === 'string' 
      ? invoice.disbursementResponse 
      : JSON.stringify(invoice.disbursementResponse)) : undefined,
    crmStatus: invoice.crmStatus,
    documentHash: invoice.documentHash,
    documentID: invoice.documentID,

    // SmartAdvocate metadata fields
    saCaseId: invoice.saCaseId,
    saDocumentName: invoice.saDocumentName,
    saFromUniqueContactId: invoice.saFromUniqueContactId,
    saToContactName: invoice.saToContactName,
    saFromContactName: invoice.saFromContactName,
    saDocType: invoice.saDocType,
    saTemplateId: invoice.saTemplateId,
    saAttachFlag: invoice.saAttachFlag ? 1 : 0,
    saCreatedUserId: invoice.saCreatedUserId,
    saCreatedDate: invoice.saCreatedDate instanceof Date && !isNaN(invoice.saCreatedDate.getTime()) ? invoice.saCreatedDate : undefined,
    saModifiedUserId: invoice.saModifiedUserId,
    saModifiedDate: invoice.saModifiedDate instanceof Date && !isNaN(invoice.saModifiedDate.getTime()) ? invoice.saModifiedDate : undefined,
    saCategoryId: invoice.saCategoryId,
    saCategoryName: invoice.saCategoryName,
    saSubCategoryId: invoice.saSubCategoryId,
    saSubCategoryName: invoice.saSubCategoryName,
    saSubSubCategoryId: invoice.saSubSubCategoryId,
    saSubSubSubCategoryId: invoice.saSubSubSubCategoryId,
    saMedProvUniqueContactId: invoice.saMedProvUniqueContactId,
    saIsReviewed: invoice.saIsReviewed ? 1 : 0,
    saToUniqueContactId: invoice.saToUniqueContactId,
    saDocumentDate: invoice.saDocumentDate instanceof Date && !isNaN(invoice.saDocumentDate.getTime()) ? invoice.saDocumentDate : undefined,
    saPriority: invoice.saPriority,
    saPriorityName: invoice.saPriorityName,
    saDocumentDirection: invoice.saDocumentDirection,
    saDirectionName: invoice.saDirectionName,
    saDocumentOrigin: invoice.saDocumentOrigin,
    saOriginName: invoice.saOriginName,
    saIsSharedInPortal: invoice.saIsSharedInPortal ? 1 : 0,
    saIsSharedWithEveryoneInPortal: invoice.saIsSharedWithEveryoneInPortal ? 1 : 0,
    saCaseDocumentId: invoice.saCaseDocumentId,
    saDeliveryMethodId: invoice.saDeliveryMethodId,
    saDeliveryName: invoice.saDeliveryName,
    saMetadata: invoice.saMetadata ? (typeof invoice.saMetadata === 'string' 
      ? invoice.saMetadata 
      : JSON.stringify(invoice.saMetadata)) : undefined,

    // Extract values and metadata
    invoiceNumber: extractValue(invoice.invoiceNumber),
    invoiceNumberMeta: serializeMeta(invoice.invoiceNumber),
    invoiceDate: extractValue(invoice.invoiceDate),
    invoiceDateMeta: serializeMeta(invoice.invoiceDate),
    vendorName: extractValue(invoice.vendorName),
    vendorNameMeta: serializeMeta(invoice.vendorName),
    vendorAddress: extractValue(invoice.vendorAddress),
    vendorAddressMeta: serializeMeta(invoice.vendorAddress),
    customerName: extractValue(invoice.customerName),
    customerNameMeta: serializeMeta(invoice.customerName),
    clientName: extractValue(invoice.clientName),
    clientNameMeta: serializeMeta(invoice.clientName),
    totalAmount: extractTotalAmount(invoice.totalAmount),
    amount: extractTotalAmount(invoice.amount),
    totalAmountMeta: serializeMeta(invoice.totalAmount),
    paymentTerms: extractValue(invoice.paymentTerms),
    paymentTermsMeta: serializeMeta(invoice.paymentTerms),
    description: extractValue(invoice.description),
    descriptionMeta: serializeMeta(invoice.description),
    dueDate: extractValue(invoice.dueDate),
    dueDateMeta: serializeMeta(invoice.dueDate),
    lineItems: invoice.lineItems ? JSON.stringify(extractValue(invoice.lineItems)) : null,
    lineItemsMeta: serializeMeta(invoice.lineItems),
  };
}
