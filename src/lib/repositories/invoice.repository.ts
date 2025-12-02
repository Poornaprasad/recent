/**
 * Invoice repository
 * Data access layer for invoices
 */

import 'server-only';

import { eq, desc, and } from 'drizzle-orm';
import { getDb, initDb } from '../db';
import { invoices } from '../db/schema';
import { sanitizeId } from '../utils/id-utils';
import type { StoredInvoice } from '../domain/types';

// Helper to convert database row to StoredInvoice
function dbRowToInvoice(row: any): StoredInvoice {
  const parseMeta = (meta: string | null) => {
    if (!meta) return {};
    try {
      const parsed = JSON.parse(meta);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return {};
    } catch (error) {
      console.warn('Failed to parse metadata:', meta, error);
      return {};
    }
  };

  const invoice: Partial<StoredInvoice> = {
    id: row.id,
    status: row.status as StoredInvoice['status'],
    invoiceDataUri: row.invoiceDataUri || row.invoice_data_uri,
    documentType: (row.documentType || row.document_type) as 'Invoice' | 'Receipt' | 'Reimbursement' | 'Office Credit Card Bill' | undefined,
    isDuplicate: row.isDuplicate || row.is_duplicate ? true : undefined,
    duplicateReason: row.duplicateReason || row.duplicate_reason || undefined,
    isRecurring: row.isRecurring || row.is_recurring ? true : undefined,
    recurringPattern: row.recurringPattern || row.recurring_pattern || undefined,
    hasAmountAnomaly: row.hasAmountAnomaly || row.has_amount_anomaly ? true : undefined,
    amountAnomalyReason: row.amountAnomalyReason || row.amount_anomaly_reason || undefined,
    expectedAmount: row.expectedAmount !== undefined && row.expectedAmount !== null 
      ? Number(row.expectedAmount) 
      : row.expected_amount !== undefined && row.expected_amount !== null
      ? Number(row.expected_amount)
      : undefined,
    amountDeviationPercent: row.amountDeviationPercent !== undefined && row.amountDeviationPercent !== null
      ? Number(row.amountDeviationPercent)
      : row.amount_deviation_percent !== undefined && row.amount_deviation_percent !== null
      ? Number(row.amount_deviation_percent)
      : undefined,
    isHighValue: row.isHighValue || row.is_high_value ? true : undefined,
    highValueReason: row.highValueReason || row.high_value_reason || undefined,
    requiresEscalation: row.requiresEscalation || row.requires_escalation ? true : undefined,
    escalationLevel: (row.escalationLevel || row.escalation_level) as 'standard' | 'high' | 'critical' | undefined,
    comment: row.comment || undefined,
    caseNumber: row.caseNumber || row.case_number || undefined,
    state: (row.state as 'CA' | 'NY' | undefined) || undefined,
    paymentType: (row.paymentType || row.payment_type) as 'Receipt' | 'Invoice' | 'Non-Financial' | 'Other' | undefined || undefined,
    approvalStatus: (row.approvalStatus || row.approval_status) as 'Pending' | 'Approved' | 'Rejected' | 'Requires_Approval' | undefined || undefined,
    approvedBy: row.approvedBy || row.approved_by || undefined,
    approvedAt: row.approvedAt || row.approved_at ? new Date((row.approvedAt || row.approved_at) * 1000) : undefined,
    createdBy: row.createdBy || row.created_by || undefined,
    assignedTo: row.assignedTo || row.assigned_to || undefined,
  };

  // Add extracted fields with metadata - handle both camelCase and snake_case
  const invoiceNumber = row.invoiceNumber || row.invoice_number;
  if (invoiceNumber) {
    invoice.invoiceNumber = {
      value: invoiceNumber,
      ...parseMeta(row.invoiceNumberMeta || row.invoice_number_meta),
    };
  } else {
    invoice.invoiceNumber = null;
  }

  const invoiceDate = row.invoiceDate || row.invoice_date;
  if (invoiceDate) {
    invoice.invoiceDate = {
      value: invoiceDate,
      ...parseMeta(row.invoiceDateMeta || row.invoice_date_meta),
    };
  } else {
    invoice.invoiceDate = null;
  }

  const vendorName = row.vendorName || row.vendor_name;
  if (vendorName) {
    invoice.vendorName = {
      value: vendorName,
      ...parseMeta(row.vendorNameMeta || row.vendor_name_meta),
    };
  } else {
    invoice.vendorName = null;
  }

  const vendorAddress = row.vendorAddress || row.vendor_address;
  if (vendorAddress) {
    invoice.vendorAddress = {
      value: vendorAddress,
      ...parseMeta(row.vendorAddressMeta || row.vendor_address_meta),
    };
  } else {
    invoice.vendorAddress = null;
  }

  const customerName = row.customerName || row.customer_name;
  if (customerName) {
    invoice.customerName = {
      value: customerName,
      ...parseMeta(row.customerNameMeta || row.customer_name_meta),
    };
  } else {
    invoice.customerName = null;
  }

  const totalAmount = row.totalAmount !== undefined ? row.totalAmount : row.total_amount;
  if (totalAmount !== null && totalAmount !== undefined) {
    invoice.totalAmount = {
      value: totalAmount,
      ...parseMeta(row.totalAmountMeta || row.total_amount_meta),
    };
  } else {
    invoice.totalAmount = null;
  }

  const paymentTerms = row.paymentTerms || row.payment_terms;
  if (paymentTerms) {
    invoice.paymentTerms = {
      value: paymentTerms,
      ...parseMeta(row.paymentTermsMeta || row.payment_terms_meta),
    };
  } else {
    invoice.paymentTerms = null;
  }

  const lineItems = row.lineItems || row.line_items;
  if (lineItems) {
    try {
      const lineItemsValue = typeof lineItems === 'string' ? JSON.parse(lineItems) : lineItems;
      invoice.lineItems = {
        value: lineItemsValue,
        ...parseMeta(row.lineItemsMeta || row.line_items_meta),
      };
    } catch {
      invoice.lineItems = null;
    }
  } else {
    invoice.lineItems = null;
  }

  return invoice as StoredInvoice;
}

// Helper to convert StoredInvoice to database row
function invoiceToDbRow(invoice: StoredInvoice) {
  const serializeMeta = (field: any) => {
    if (!field || typeof field !== 'object') return null;
    const { value, ...meta } = field;
    if (Object.keys(meta).length === 0) return null;
    try {
      return JSON.stringify(meta);
    } catch (error) {
      console.warn('Failed to serialize metadata:', meta, error);
      return null;
    }
  };

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber?.value || null,
    invoiceDate: invoice.invoiceDate?.value || null,
    vendorName: invoice.vendorName?.value || null,
    vendorAddress: invoice.vendorAddress?.value || null,
    customerName: invoice.customerName?.value || null,
    totalAmount: invoice.totalAmount?.value !== undefined ? Number(invoice.totalAmount.value) : null,
    paymentTerms: invoice.paymentTerms?.value || null,
    lineItems: invoice.lineItems?.value ? JSON.stringify(invoice.lineItems.value) : null,
    status: invoice.status,
    documentType: invoice.documentType || null,
    invoiceDataUri: invoice.invoiceDataUri,
    isDuplicate: invoice.isDuplicate ? true : false,
    duplicateReason: invoice.duplicateReason || null,
    isRecurring: invoice.isRecurring ? true : false,
    recurringPattern: invoice.recurringPattern || null,
    hasAmountAnomaly: invoice.hasAmountAnomaly ? true : false,
    amountAnomalyReason: invoice.amountAnomalyReason || null,
    expectedAmount: invoice.expectedAmount !== undefined ? Number(invoice.expectedAmount) : null,
    amountDeviationPercent: invoice.amountDeviationPercent !== undefined ? Number(invoice.amountDeviationPercent) : null,
    isHighValue: invoice.isHighValue ? true : false,
    highValueReason: invoice.highValueReason || null,
    requiresEscalation: invoice.requiresEscalation ? true : false,
    escalationLevel: invoice.escalationLevel || null,
    comment: invoice.comment || null,
    caseNumber: invoice.caseNumber || null,
    state: invoice.state || null,
    paymentType: invoice.paymentType || null,
    approvalStatus: invoice.approvalStatus || null,
    approvedBy: invoice.approvedBy || null,
    approvedAt: invoice.approvedAt ? Math.floor(invoice.approvedAt.getTime() / 1000) : null,
    createdBy: invoice.createdBy || null,
    assignedTo: invoice.assignedTo || null,
    invoiceNumberMeta: serializeMeta(invoice.invoiceNumber),
    invoiceDateMeta: serializeMeta(invoice.invoiceDate),
    vendorNameMeta: serializeMeta(invoice.vendorName),
    vendorAddressMeta: serializeMeta(invoice.vendorAddress),
    customerNameMeta: serializeMeta(invoice.customerName),
    totalAmountMeta: serializeMeta(invoice.totalAmount),
    paymentTermsMeta: serializeMeta(invoice.paymentTerms),
    lineItemsMeta: serializeMeta(invoice.lineItems),
    documentTypeMeta: null,
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  };
}

/**
 * Get all invoices sorted by date (newest first)
 */
export async function findAllInvoices(): Promise<StoredInvoice[]> {
  await initDb();
  const db = getDb();
  
  const rows = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.invoiceDate));
  
  return rows.map(dbRowToInvoice);
}

/**
 * Get invoice by ID
 * Also tries to match by invoice number if ID doesn't match
 */
export async function findInvoiceById(id: string): Promise<StoredInvoice | undefined> {
  await initDb();
  const db = getDb();
  
  // First try exact ID match
  let row = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1)
    .then(rows => rows[0]);
  
  // If not found, try matching by sanitized ID (for backward compatibility with old IDs)
  if (!row) {
    const sanitizedId = sanitizeId(id);
    if (sanitizedId !== id) {
      row = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, sanitizedId))
        .limit(1)
        .then(rows => rows[0]);
    }
  }
  
  // If still not found, try matching by invoice number
  if (!row) {
    row = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, id))
      .limit(1)
      .then(rows => rows[0]);
  }
  
  if (!row) return undefined;
  
  return dbRowToInvoice(row);
}

/**
 * Create or update an invoice (upsert)
 */
export async function upsertInvoice(invoice: StoredInvoice): Promise<void> {
  await initDb();
  const db = getDb();
  
  const row = invoiceToDbRow(invoice);
  
  await db
    .insert(invoices)
    .values(row)
    .onConflictDoUpdate({
      target: invoices.id,
      set: row,
    });
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  id: string,
  status: StoredInvoice['status']
): Promise<void> {
  await initDb();
  const db = getDb();
  
  await db
    .update(invoices)
    .set({
      status,
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    })
    .where(eq(invoices.id, id));
}

/**
 * Check for duplicate invoices
 */
export async function checkForDuplicateInvoice(
  invoiceNumber: string,
  vendorName: string,
  invoiceDate: string
): Promise<{ isDuplicate: boolean; reason?: string }> {
  await initDb();
  const db = getDb();
  
  const existing = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.invoiceNumber, invoiceNumber),
        eq(invoices.vendorName, vendorName)
      )
    )
    .limit(1)
    .then(rows => rows[0]);
  
  if (!existing) {
    return { isDuplicate: false };
  }
  
  // Check if dates are close together (within 30 days) - if so, likely duplicate
  // If dates are far apart (>= 2 months), likely a recurring invoice, not a duplicate
  try {
    const newDate = new Date(invoiceDate);
    const existingDate = new Date(existing.invoiceDate || '');
    const daysDiff = Math.abs((newDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // If dates are within 30 days, it's likely a duplicate
    if (daysDiff <= 30) {
      return {
        isDuplicate: true,
        reason: `A similar invoice was found from ${existing.invoiceDate} (${Math.round(daysDiff)} days ago).`,
      };
    }
    
    // If dates are more than 2 months apart, it's likely a recurring invoice, not a duplicate
    const monthsDiff = Math.abs(
      (newDate.getFullYear() - existingDate.getFullYear()) * 12 +
      (newDate.getMonth() - existingDate.getMonth())
    );
    
    if (monthsDiff >= 2) {
      // Check if existing invoice is marked as recurring
      // The row might have camelCase or snake_case depending on Drizzle's mapping
      const isExistingRecurring = (existing as any).isRecurring || (existing as any).is_recurring;
      if (isExistingRecurring) {
        // This is definitely a recurring invoice, not a duplicate
        return { isDuplicate: false };
      }
      // Even if not marked, if dates are far apart, likely recurring
      return { isDuplicate: false };
    }
    
    // Between 30 days and 2 months - could be either, but err on side of caution
    // Mark as potential duplicate for manual review
    return {
      isDuplicate: true,
      reason: `A similar invoice was found from ${existing.invoiceDate} (${Math.round(daysDiff)} days ago). Please review.`,
    };
  } catch (error) {
    // Date parsing error, assume not duplicate
    return { isDuplicate: false };
  }
}
