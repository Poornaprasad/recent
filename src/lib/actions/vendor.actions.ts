/**
 * Vendor server actions
 * Next.js server actions for vendor operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { vendorService } from '../services/vendor.service';
import type { Vendor, VendorType } from '../domain/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

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
export async function saveVendorAction(vendor: Vendor): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await vendorService.saveVendor(vendor);
    revalidatePath('/vendors');
    return { success: true };
  }, 'Failed to save vendor');
}

/**
 * Delete vendor
 */
export async function deleteVendorAction(id: string): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await vendorService.removeVendor(id);
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





