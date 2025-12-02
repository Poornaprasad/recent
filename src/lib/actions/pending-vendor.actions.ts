/**
 * Pending vendor server actions
 * Next.js server actions for pending vendor operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { pendingVendorService } from '../services/pending-vendor.service';
import type { PendingVendor } from '../domain/types';

/**
 * Get all pending vendors
 */
export async function getPendingVendorsAction(): Promise<{ data?: PendingVendor[]; error?: string }> {
  try {
    const vendors = await pendingVendorService.getAllPendingVendors();
    return { data: vendors };
  } catch (error) {
    console.error('Error fetching pending vendors:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending vendors.';
    return { error: errorMessage };
  }
}

/**
 * Get pending vendor by ID
 */
export async function getPendingVendorByIdAction(id: string): Promise<{ data?: PendingVendor; error?: string }> {
  try {
    const vendor = await pendingVendorService.getPendingVendorById(id);
    if (!vendor) {
      return { error: 'Pending vendor not found' };
    }
    return { data: vendor };
  } catch (error) {
    console.error('Error fetching pending vendor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending vendor.';
    return { error: errorMessage };
  }
}

/**
 * Get pending vendor by invoice ID
 */
export async function getPendingVendorByInvoiceIdAction(invoiceId: string): Promise<{ data?: PendingVendor; error?: string }> {
  try {
    const vendor = await pendingVendorService.getPendingVendorByInvoiceId(invoiceId);
    return { data: vendor };
  } catch (error) {
    console.error('Error fetching pending vendor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending vendor.';
    return { error: errorMessage };
  }
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
  try {
    const result = await pendingVendorService.completeVendorSetup(pendingVendorId, vendorData);
    revalidatePath('/1099-requests');
    revalidatePath('/vendors');
    revalidatePath('/invoices');
    return result;
  } catch (error) {
    console.error('Error completing vendor setup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete vendor setup.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Reject pending vendor
 */
export async function rejectPendingVendorAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await pendingVendorService.rejectPendingVendor(id);
    revalidatePath('/1099-requests');
    return { success: true };
  } catch (error) {
    console.error('Error rejecting pending vendor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject pending vendor.';
    return { success: false, error: errorMessage };
  }
}





