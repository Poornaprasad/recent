/**
 * Invoice server actions
 * Next.js server actions for invoice operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { invoiceService } from '../services/invoice.service';
import { getInvoiceDataUri } from '../storage/file-utils';
import type { StoredInvoice } from '../domain/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import { getDb, initDb } from '../db';
import { invoices } from '../db/schema';
import { eq } from 'drizzle-orm';
import { serializeMeta } from '../repositories/mappers/invoice.mapper';

/**
 * Process a new invoice upload
 */
export async function processInvoiceAction(
  input: { invoiceDataUri: string }
): Promise<{ data?: StoredInvoice; error?: string }> {
  const result = await invoiceService.processInvoice(input);

  if (result.data) {
    revalidatePath('/invoices');
    revalidatePath('/approvals');
    revalidatePath('/dashboard');
  }

  return result;
}

/**
 * Get invoice by ID
 */
export async function getInvoiceByIdAction(id: string): Promise<ActionResult<StoredInvoice>> {
  return withActionHandler(async () => {
    const invoice = await invoiceService.getInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice;
  }, 'Failed to fetch invoice');
}

/**
 * Get invoice data URI (file path to data URI conversion)
 */
export async function getInvoiceDataUriAction(uri: string): Promise<{ dataUri?: string; error?: string }> {
  return withActionHandler(
    () => getInvoiceDataUri(uri).then(dataUri => ({ dataUri })),
    'Failed to get invoice file'
  );
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatusAction(
  id: string,
  status: 'Pending' | 'Draft'
): Promise<{ success: boolean, error?: string}> {
  return withActionHandler(async () => {
    const result = await invoiceService.updateStatus(id, status);
    if (!result.success) {
      return result;
    }
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    revalidatePath('/w9-requests');
    return { success: true };
  }, 'Failed to update invoice status');
}

/**
 * Get all invoices
 * @param userPermissions Optional user permissions for state-based filtering
 */
export async function getInvoicesAction(
  userPermissions?: { role: string; assignedStates?: string[] }
): Promise<ActionResult<StoredInvoice[]>> {
  return withActionHandler(
    () => invoiceService.getAllInvoices(userPermissions),
    'Failed to fetch invoices'
  );
}

/**
 * Flag invoice for review
 * Cannot flag invoices that require escalation (they are handled via role-based access control)
 */
export async function flagInvoiceForReviewAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    // First check if invoice requires escalation
    const invoice = await invoiceService.getInvoiceById(id);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }
    
    if (invoice.requiresEscalation === true) {
      return { 
        success: false, 
        error: 'Cannot flag escalated invoices for review. Escalated invoices require role-based approval and are handled separately.' 
      };
    }
    
    await invoiceService.updateStatus(id, 'Review');
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  }, 'Failed to flag invoice for review');
}

/**
 * Add comment to invoice
 */
export async function addInvoiceCommentAction(
  id: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await invoiceService.addComment(id, comment);
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  }, 'Failed to add comment');
}

/**
 * Update invoice case number
 */
export async function updateInvoiceCaseNumberAction(
  id: string,
  caseNumber: string | undefined
): Promise<{ success: boolean; error?: string }> {
  const result = await withActionHandler(async () => {
    await invoiceService.updateCaseNumber(id, caseNumber);
    revalidatePath(`/invoices/${id}`);
    revalidatePath('/approvals');
    return { success: true };
  }, 'Failed to update case number');

  // Unwrap the result to match the expected return type
  if (result.error) {
    return { success: false, error: result.error };
  }
  return result.data || { success: false, error: 'Unknown error' };
}

// Field name to database column mapping
const fieldToColumnMap: Record<string, { valueCol: string; metaCol: string | null; isNumeric?: boolean }> = {
  invoiceNumber: { valueCol: 'invoiceNumber', metaCol: 'invoiceNumberMeta' },
  invoiceDate: { valueCol: 'invoiceDate', metaCol: 'invoiceDateMeta' },
  vendorName: { valueCol: 'vendorName', metaCol: 'vendorNameMeta' },
  vendorAddress: { valueCol: 'vendorAddress', metaCol: 'vendorAddressMeta' },
  customerName: { valueCol: 'customerName', metaCol: 'customerNameMeta' },
  totalAmount: { valueCol: 'totalAmount', metaCol: 'totalAmountMeta', isNumeric: true },
  paymentTerms: { valueCol: 'paymentTerms', metaCol: 'paymentTermsMeta' },
  amount: { valueCol: 'amount', metaCol: 'amountMeta', isNumeric: true },
  clientName: { valueCol: 'clientName', metaCol: 'clientNameMeta' },
  description: { valueCol: 'description', metaCol: 'descriptionMeta' },
  dueDate: { valueCol: 'dueDate', metaCol: 'dueDateMeta' },
};

/**
 * Update a single invoice field
 * Persists the edited value and metadata to the database
 */
export async function updateInvoiceFieldAction(
  invoiceId: string,
  fieldName: string,
  fieldValue: string,
  isEdited: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const result = await withActionHandler(async () => {
    await initDb();
    const db = getDb();

    const mapping = fieldToColumnMap[fieldName];
    if (!mapping) {
      throw new Error(`Unknown field: ${fieldName}`);
    }

    // Prepare the update data
    const updateData: Record<string, any> = {
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };

    // Set the value column
    if (mapping.isNumeric) {
      const numValue = parseFloat(fieldValue.replace(/[^0-9.-]/g, ''));
      updateData[mapping.valueCol] = isNaN(numValue) ? null : numValue;
    } else {
      updateData[mapping.valueCol] = fieldValue || null;
    }

    // Set the metadata column (mark as user-edited, remove confidence)
    if (mapping.metaCol) {
      // Build metadata - confidence is intentionally omitted for user-edited fields
      const meta: { value: string; reasoning?: string } = { value: fieldValue };
      if (isEdited) {
        meta.reasoning = 'User edited';
      }
      updateData[mapping.metaCol] = serializeMeta(meta);
    }

    await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId));

    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true };
  }, 'Failed to update invoice field');

  // Unwrap the result to match the expected return type
  if (result.error) {
    return { success: false, error: result.error };
  }
  return result.data || { success: false, error: 'Unknown error' };
}

/**
 * Update invoice with disbursement response
 */
export async function updateInvoiceDisbursementResponseAction(
  invoiceId: string,
  disbursementResponse: any
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await initDb();
    const db = getDb();

    const updateData: Record<string, any> = {
      disbursementResponse: typeof disbursementResponse === 'string' 
        ? disbursementResponse 
        : JSON.stringify(disbursementResponse),
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };

    await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId));

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    return { success: true };
  }, 'Failed to update disbursement response');
}

