/**
 * Vendor server actions
 * Next.js server actions for vendor operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { vendorService } from '../services/vendor.service';
import type { Vendor, VendorType } from '../domain/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import { auditService } from '../core/audit/audit.service';
import { AuditAction, AuditResource, AuditCategory, AuditSeverity } from '../core/audit/audit.types';

/**
 * Get all vendors
 */
export async function getVendorsAction(): Promise<ActionResult<Vendor[]>> {
  return withActionHandler(
    () => vendorService.getAllVendors(),
    'Failed to fetch vendors'
  );
}

/**
 * Get vendor by ID
 */
export async function getVendorByIdAction(id: string): Promise<ActionResult<Vendor>> {
  return withActionHandler(async () => {
    const vendor = await vendorService.getVendorById(id);
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    return vendor;
  }, 'Failed to fetch vendor');
}

/**
 * Get vendor by name
 */
export async function getVendorByNameAction(name: string): Promise<ActionResult<Vendor>> {
  return withActionHandler(
    () => vendorService.getVendorByName(name),
    'Failed to fetch vendor'
  );
}

/**
 * Get suggested vendor types for a vendor name
 */
export async function getSuggestedVendorTypesAction(vendorName: string): Promise<ActionResult<string[]>> {
  return withActionHandler(
    () => vendorService.getSuggestedVendorTypes(vendorName),
    'Failed to fetch suggested types'
  );
}

/**
 * Save vendor (create or update)
 */
export async function saveVendorAction(
  vendor: Vendor,
  performedByUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    // Check if this is a new vendor or update
    const existingVendor = await vendorService.getVendorById(vendor.id);
    const isNew = !existingVendor;

    await vendorService.saveVendor(vendor);

    // Audit logging
    if (isNew) {
      await auditService.logVendorCreated(performedByUserId || 'system', vendor.id, {
        vendorName: vendor.name,
        vendorType: vendor.vendorType || undefined,
        email: vendor.email || undefined,
      });
    } else {
      // Determine changed fields
      const changedFields: string[] = [];
      const previousValue: Record<string, any> = {};
      const newValue: Record<string, any> = {};

      if (existingVendor.name !== vendor.name) {
        changedFields.push('name');
        previousValue.name = existingVendor.name;
        newValue.name = vendor.name;
      }
      if (existingVendor.email !== vendor.email) {
        changedFields.push('email');
        previousValue.email = existingVendor.email;
        newValue.email = vendor.email;
      }
      if (existingVendor.vendorType !== vendor.vendorType) {
        changedFields.push('vendorType');
        previousValue.vendorType = existingVendor.vendorType;
        newValue.vendorType = vendor.vendorType;
      }

      if (changedFields.length > 0) {
        await auditService.logVendorUpdated(performedByUserId || 'system', vendor.id, {
          vendorName: vendor.name,
          changedFields,
          previousValue,
          newValue,
        });
      }
    }

    revalidatePath('/vendors');
    return { success: true };
  }, 'Failed to save vendor');
}

/**
 * Delete vendor
 */
export async function deleteVendorAction(
  id: string,
  performedByUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    // Get vendor info before deleting for audit log
    const vendor = await vendorService.getVendorById(id);

    await vendorService.removeVendor(id);

    // Audit log vendor deletion
    if (vendor) {
      await auditService.log({
        userId: performedByUserId || 'system',
        action: AuditAction.VENDOR_DELETED,
        resource: AuditResource.VENDOR,
        resourceId: id,
        category: AuditCategory.VENDOR_MANAGEMENT,
        severity: AuditSeverity.WARNING,
        details: {
          description: `Vendor deleted: ${vendor.name}`,
          vendorName: vendor.name,
          vendorType: vendor.vendorType,
          email: vendor.email,
        },
      });
    }

    revalidatePath('/vendors');
    return { success: true };
  }, 'Failed to delete vendor');
}

/**
 * Get all vendor types
 */
export async function getVendorTypesAction(): Promise<ActionResult<VendorType[]>> {
  return withActionHandler(
    () => vendorService.getAllVendorTypes(),
    'Failed to fetch vendor types'
  );
}

/**
 * Create vendor type
 */
export async function createVendorTypeAction(
  vendorType: Omit<VendorType, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ActionResult<VendorType>> {
  return withActionHandler(async () => {
    const created = await vendorService.createVendorType(vendorType);
    revalidatePath('/vendors');
    return created;
  }, 'Failed to create vendor type');
}

/**
 * Check if vendor exists and requires 1099
 */
export async function checkVendorExistsAction(vendorName: string): Promise<{ exists: boolean; requires1099?: boolean; error?: string }> {
  return withActionHandler(
    () => vendorService.checkVendorExists(vendorName),
    'Failed to check vendor'
  );
}

/**
 * Sync vendor types from CRM
 * TODO: Implement CRM integration
 */
export async function syncVendorTypesFromCrmAction(): Promise<{
  success: boolean;
  message?: string;
  synced?: number;
  errors?: string[]
}> {
  return withActionHandler(async () => {
    // TODO: Implement actual CRM sync logic
    return {
      success: false,
      message: 'CRM sync is not yet implemented. Please add vendor types manually.',
      errors: ['CRM integration not configured'],
    };
  }, 'Failed to sync vendor types from CRM');
}

/**
 * Get vendor invoices grouped for 1099 requests
 */
export async function getVendorInvoicesFor1099Action(): Promise<ActionResult<Array<{
  vendorName: string;
  vendor?: Vendor;
  totalAmount: number;
  isBelowThreshold: boolean;
  invoices: Array<{
    invoice: import('../domain/types').StoredInvoice;
    caseNumber?: string;
    amount: number;
  }>;
  form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
  w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
  canProcessInvoices: boolean;
}>>> {
  return withActionHandler(
    () => vendorService.getVendorInvoicesFor1099(),
    'Failed to fetch vendor invoices for 1099'
  );
}

/**
 * Update vendor 1099/W9 status
 */
export async function updateVendor1099StatusAction(
  vendorId: string,
  status: {
    form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
    w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
  },
  performedByUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    const vendor = await vendorService.getVendorById(vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const previousW9Status = vendor.w9Status;
    const previous1099Status = vendor.form1099Status;

    const updatedVendor: Vendor = {
      ...vendor,
      form1099Status: status.form1099Status ?? vendor.form1099Status,
      w9Status: status.w9Status ?? vendor.w9Status,
      form1099ReceivedDate: status.form1099Status === 'Received' ? new Date() : vendor.form1099ReceivedDate,
      w9ReceivedDate: status.w9Status === 'Received' ? new Date() : vendor.w9ReceivedDate,
      updatedAt: new Date(),
    };

    await vendorService.saveVendor(updatedVendor);

    // Audit log W9 status change
    if (status.w9Status && status.w9Status !== previousW9Status) {
      await auditService.logVendorW9StatusChanged(
        performedByUserId || 'system',
        vendorId,
        {
          vendorName: vendor.name,
          previousStatus: previousW9Status || undefined,
          newStatus: status.w9Status,
        }
      );
    }

    // Audit log 1099 status change
    if (status.form1099Status && status.form1099Status !== previous1099Status) {
      await auditService.logVendor1099StatusChanged(
        performedByUserId || 'system',
        vendorId,
        {
          vendorName: vendor.name,
          previousStatus: previous1099Status || undefined,
          newStatus: status.form1099Status,
        }
      );
    }

    revalidatePath('/w9-requests');
    revalidatePath('/vendors');
    return { success: true };
  }, 'Failed to update vendor 1099 status');
}





