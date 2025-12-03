/**
 * Vendor server actions
 * Next.js server actions for vendor operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { vendorService } from '../services/vendor.service';
import type { Vendor, VendorType } from '../domain/types';

/**
 * Get all vendors
 */
export async function getVendorsAction(): Promise<{ data?: Vendor[]; error?: string }> {
  try {
    const vendors = await vendorService.getAllVendors();
    return { data: vendors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vendors.';
    return { error: errorMessage };
  }
}

/**
 * Get vendor by ID
 */
export async function getVendorByIdAction(id: string): Promise<{ data?: Vendor; error?: string }> {
  try {
    const vendor = await vendorService.getVendorById(id);
    if (!vendor) {
      return { error: 'Vendor not found' };
    }
    return { data: vendor };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vendor.';
    return { error: errorMessage };
  }
}

/**
 * Get vendor by name
 */
export async function getVendorByNameAction(name: string): Promise<{ data?: Vendor; error?: string }> {
  try {
    const vendor = await vendorService.getVendorByName(name);
    return { data: vendor };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vendor.';
    return { error: errorMessage };
  }
}

/**
 * Get suggested vendor types for a vendor name
 */
export async function getSuggestedVendorTypesAction(vendorName: string): Promise<{ data?: string[]; error?: string }> {
  try {
    const types = await vendorService.getSuggestedVendorTypes(vendorName);
    return { data: types };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggested types.';
    return { error: errorMessage };
  }
}

/**
 * Save vendor (create or update)
 */
export async function saveVendorAction(vendor: Vendor): Promise<{ success: boolean; error?: string }> {
  try {
    await vendorService.saveVendor(vendor);
    revalidatePath('/vendors');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save vendor.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete vendor
 */
export async function deleteVendorAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await vendorService.removeVendor(id);
    revalidatePath('/vendors');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete vendor.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get all vendor types
 */
export async function getVendorTypesAction(): Promise<{ data?: VendorType[]; error?: string }> {
  try {
    const types = await vendorService.getAllVendorTypes();
    return { data: types };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vendor types.';
    return { error: errorMessage };
  }
}

/**
 * Create vendor type
 */
export async function createVendorTypeAction(
  vendorType: Omit<VendorType, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ data?: VendorType; error?: string }> {
  try {
    const created = await vendorService.createVendorType(vendorType);
    revalidatePath('/vendors');
    return { data: created };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create vendor type.';
    return { error: errorMessage };
  }
}

/**
 * Check if vendor exists and requires 1099
 */
export async function checkVendorExistsAction(vendorName: string): Promise<{ exists: boolean; requires1099?: boolean; error?: string }> {
  try {
    const result = await vendorService.checkVendorExists(vendorName);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check vendor.';
    return { exists: false, error: errorMessage };
  }
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
  try {
    // TODO: Implement actual CRM sync logic
    // This is a placeholder implementation
    return {
      success: false,
      message: 'CRM sync is not yet implemented. Please add vendor types manually.',
      errors: ['CRM integration not configured'],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync vendor types from CRM.';
    return {
      success: false,
      message: errorMessage,
      errors: [errorMessage],
    };
  }
}





