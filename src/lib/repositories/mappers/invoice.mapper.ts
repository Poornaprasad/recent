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
function serializeMeta(field: any): string | null {
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
    state: row.state as 'CA' | 'NY' | undefined,
    paymentType: row.paymentType as 'Receipt' | 'Invoice' | 'Non-Financial' | 'Other' | undefined,
    approvalStatus: row.approvalStatus as 'Pending' | 'Approved' | 'Rejected' | 'Requires_Approval' | undefined,
    approvedBy: row.approvedBy || undefined,
    approvedAt: row.approvedAt ? new Date((row.approvedAt as Date).getTime() * 1000) : undefined,
    createdBy: row.createdBy || undefined,
    assignedTo: row.assignedTo || undefined,

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
    state: invoice.state,
    paymentType: invoice.paymentType,
    approvalStatus: invoice.approvalStatus,
    approvedBy: invoice.approvedBy,
    approvedAt: invoice.approvedAt ? Math.floor(invoice.approvedAt.getTime() / 1000) as any : undefined,
    createdBy: invoice.createdBy,
    assignedTo: invoice.assignedTo,

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
    lineItems: invoice.lineItems ? JSON.stringify(extractValue(invoice.lineItems)) : null,
    lineItemsMeta: serializeMeta(invoice.lineItems),
  };
}
