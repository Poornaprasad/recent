/**
 * Pending vendor server actions
 * Next.js server actions for pending vendor operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { pendingVendorService } from '../services/pending-vendor.service';
import type { PendingVendor } from '../domain/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

/**
 * Get all pending vendors
 */
export async function getPendingVendorsAction(): Promise<ActionResult<PendingVendor[]>> {
  return withActionHandler(
    () => pendingVendorService.getAllPendingVendors(),
    'Failed to fetch pending vendors'
  );
}

/**
 * Get pending vendor by ID
 */
export async function getPendingVendorByIdAction(id: string): Promise<ActionResult<PendingVendor>> {
  return withActionHandler(async () => {
    const vendor = await pendingVendorService.getPendingVendorById(id);
    if (!vendor) {
      throw new Error('Pending vendor not found');
    }
    return vendor;
  }, 'Failed to fetch pending vendor');
}

/**
 * Get pending vendor by invoice ID
 */
export async function getPendingVendorByInvoiceIdAction(invoiceId: string): Promise<ActionResult<PendingVendor>> {
  return withActionHandler(
    () => pendingVendorService.getPendingVendorByInvoiceId(invoiceId),
    'Failed to fetch pending vendor'
  );
}

/**
 * Complete vendor setup
 */
export async function completeVendorSetupAction(
  pendingVendorId: string,
  vendorData: {
    vendorType?: string;
    email?: string;
    phone?: string;
    address?: string;
    requires1099?: boolean;
  }
): Promise<{ success: boolean; vendorId?: string; error?: string }> {
  return withActionHandler(async () => {
    const result = await pendingVendorService.completeVendorSetup(pendingVendorId, vendorData);
    revalidatePath('/1099-requests');
    revalidatePath('/vendors');
    revalidatePath('/invoices');
    return result;
  }, 'Failed to complete vendor setup');
}

/**
 * Reject pending vendor
 */
export async function rejectPendingVendorAction(id: string): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await pendingVendorService.rejectPendingVendor(id);
    revalidatePath('/1099-requests');
    return { success: true };
  }, 'Failed to reject pending vendor');
}





