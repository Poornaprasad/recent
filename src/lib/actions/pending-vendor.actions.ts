/**
 * Pending vendor server actions
 * Next.js server actions for pending vendor operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { pendingVendorService } from '../services/pending-vendor.service';
import type { PendingVendor } from '../domain/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import { auditService } from '../core/audit/audit.service';
import { AuditAction, AuditResource, AuditCategory, AuditSeverity } from '../core/audit/audit.types';
import { getRequestMetadata, getCurrentUserId } from '../utils/request-context';

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
  },
  userId?: string
): Promise<{ success: boolean; vendorId?: string; error?: string }> {
  return withActionHandler(async () => {
    // Get pending vendor before completion for audit log
    const pendingVendor = await pendingVendorService.getPendingVendorById(pendingVendorId);
    
    const result = await pendingVendorService.completeVendorSetup(pendingVendorId, vendorData);
    
    // Audit log: Pending vendor completed
    if (result.success && pendingVendor) {
      try {
        const auditUserId = userId || await getCurrentUserId() || 'system';
        const metadata = await getRequestMetadata();
        await auditService.log({
          userId: auditUserId,
          action: AuditAction.PENDING_VENDOR_COMPLETED,
          resource: AuditResource.PENDING_VENDOR,
          resourceId: pendingVendorId,
          category: AuditCategory.VENDOR_MANAGEMENT,
          severity: AuditSeverity.INFO,
          details: {
            description: `Pending vendor setup completed`,
            vendorName: pendingVendor.name,
            vendorId: result.vendorId,
          },
          metadata,
        });
      } catch (error) {
        // Don't fail the operation if audit logging fails
        console.error('Failed to log pending vendor completion:', error);
      }
    }
    
    revalidatePath('/w9-requests');
    revalidatePath('/vendors');
    revalidatePath('/invoices');
    return result;
  }, 'Failed to complete vendor setup');
}

/**
 * Reject pending vendor
 */
export async function rejectPendingVendorAction(
  id: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    // Get pending vendor before rejection for audit log
    const pendingVendor = await pendingVendorService.getPendingVendorById(id);
    
    await pendingVendorService.rejectPendingVendor(id);
    
    // Audit log: Pending vendor rejected
    if (pendingVendor) {
      try {
        const auditUserId = userId || await getCurrentUserId() || 'system';
        const metadata = await getRequestMetadata();
        await auditService.log({
          userId: auditUserId,
          action: AuditAction.PENDING_VENDOR_REJECTED,
          resource: AuditResource.PENDING_VENDOR,
          resourceId: id,
          category: AuditCategory.VENDOR_MANAGEMENT,
          severity: AuditSeverity.INFO,
          details: {
            description: `Pending vendor rejected`,
            vendorName: pendingVendor.name,
          },
          metadata,
        });
      } catch (error) {
        // Don't fail the operation if audit logging fails
        console.error('Failed to log pending vendor rejection:', error);
      }
    }
    
    revalidatePath('/w9-requests');
    return { success: true };
  }, 'Failed to reject pending vendor');
}





