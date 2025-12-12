/**
 * Invoice repository
 * Data access layer for invoices
 */

import 'server-only';

import { eq, desc, and } from 'drizzle-orm';
import { getDatabase } from '../db/context';
import { invoices, type Invoice } from '../db/schema';
import { sanitizeId } from '../utils/id-utils';
import type { StoredInvoice } from '../domain/types';
import { mapDbRowToInvoice, mapInvoiceToDbRow } from './mappers/invoice.mapper';

/**
 * Get all invoices sorted by date (newest first)
 */
export async function findAllInvoices(): Promise<StoredInvoice[]> {
  const db = await getDatabase();

  const rows = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.invoiceDate));

  return rows.map(mapDbRowToInvoice);
}

/**
 * Get invoice by ID
 * Also tries to match by invoice number if ID doesn't match
 */
export async function findInvoiceById(id: string): Promise<StoredInvoice | undefined> {
  const db = await getDatabase();

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

  return mapDbRowToInvoice(row);
}

/**
 * Create or update an invoice (upsert)
 */
export async function upsertInvoice(invoice: StoredInvoice): Promise<void> {
  const db = await getDatabase();

  const row = mapInvoiceToDbRow(invoice) as Invoice;

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
  const db = await getDatabase();

  // When approving (status = 'Pending'), also update approvalStatus to 'Approved'
  const updateData: any = {
    status,
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  };

  // If approving (changing from Review to Pending), set approvalStatus to Approved
  if (status === 'Pending') {
    updateData.approvalStatus = 'Approved';
    updateData.approvedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  } else if (status === 'Draft') {
    // If rejecting, set approvalStatus to Rejected
    updateData.approvalStatus = 'Rejected';
  }

  await db
    .update(invoices)
    .set(updateData)
    .where(eq(invoices.id, id));
}

/**
 * Check for duplicate invoices based on invoice number, vendor name, and date
 */
export async function checkForDuplicateInvoice(
  invoiceNumber: string | null | undefined,
  vendorName: string | null | undefined,
  invoiceDate: string | null | undefined,
  excludeId?: string
): Promise<StoredInvoice | null> {
  const db = await getDatabase();

  // Need at least invoice number or vendor + date to check duplicates
  if (!invoiceNumber && (!vendorName || !invoiceDate)) {
    return null;
  }

  const conditions = [];

  if (invoiceNumber) {
    conditions.push(eq(invoices.invoiceNumber, invoiceNumber));
  }

  if (vendorName) {
    conditions.push(eq(invoices.vendorName, vendorName));
  }

  if (invoiceDate) {
    conditions.push(eq(invoices.invoiceDate, invoiceDate));
  }

  let query = db
    .select()
    .from(invoices)
    .where(and(...conditions))
    .limit(1);

  const rows = await query;
  const row = rows[0];

  if (!row) return null;

  // If we're checking for a specific invoice update, exclude it from duplicate check
  if (excludeId && row.id === excludeId) {
    return null;
  }

  return mapDbRowToInvoice(row);
}
