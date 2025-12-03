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
    await invoiceService.updateStatus(id, status);
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  }, 'Failed to update invoice status');
}

/**
 * Get all invoices
 */
export async function getInvoicesAction(): Promise<ActionResult<StoredInvoice[]>> {
  return withActionHandler(
    () => invoiceService.getAllInvoices(),
    'Failed to fetch invoices'
  );
}

/**
 * Flag invoice for review
 */
export async function flagInvoiceForReviewAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
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
  return withActionHandler(async () => {
    await invoiceService.updateCaseNumber(id, caseNumber);
    revalidatePath(`/invoices/${id}`);
    revalidatePath('/approvals');
    return { success: true };
  }, 'Failed to update case number');
}

