/**
 * Invoice server actions
 * Next.js server actions for invoice operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { invoiceService } from '../services/invoice.service';
import { getInvoiceDataUri } from '../storage/file-utils';
import type { StoredInvoice } from '../domain/types';

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
export async function getInvoiceByIdAction(id: string): Promise<{ data?: StoredInvoice; error?: string }> {
  try {
    const invoice = await invoiceService.getInvoiceById(id);
    if (!invoice) {
      return { error: 'Invoice not found' };
    }
    return { data: invoice };
  } catch (error) {
    console.error('Error fetching invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoice.';
    return { error: errorMessage };
  }
}

/**
 * Get invoice data URI (file path to data URI conversion)
 */
export async function getInvoiceDataUriAction(uri: string): Promise<{ dataUri?: string; error?: string }> {
  try {
    const dataUri = await getInvoiceDataUri(uri);
    return { dataUri };
  } catch (error) {
    console.error('Error getting invoice data URI:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get invoice file.';
    return { error: errorMessage };
  }
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatusAction(
  id: string, 
  status: 'Pending' | 'Draft'
): Promise<{ success: boolean, error?: string}> {
  try {
    await invoiceService.updateStatus(id, status);
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating invoice status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update invoice status.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get all invoices
 */
export async function getInvoicesAction(): Promise<{ data?: StoredInvoice[]; error?: string }> {
  try {
    const invoices = await invoiceService.getAllInvoices();
    return { data: invoices };
  } catch (error) {
    console.error('Error fetching invoices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoices.';
    return { error: errorMessage };
  }
}

/**
 * Flag invoice for review
 */
export async function flagInvoiceForReviewAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await invoiceService.updateStatus(id, 'Review');
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Error flagging invoice for review:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to flag invoice for review.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Add comment to invoice
 */
export async function addInvoiceCommentAction(
  id: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await invoiceService.addComment(id, comment);
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Error adding comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add comment.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Update invoice case number
 */
export async function updateInvoiceCaseNumberAction(
  id: string,
  caseNumber: string | undefined
): Promise<{ success: boolean; error?: string }> {
  try {
    await invoiceService.updateCaseNumber(id, caseNumber);
    revalidatePath(`/invoices/${id}`);
    revalidatePath('/approvals');
    return { success: true };
  } catch (error) {
    console.error('Error updating case number:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update case number.';
    return { success: false, error: errorMessage };
  }
}

