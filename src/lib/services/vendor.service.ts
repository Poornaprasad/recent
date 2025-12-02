/**
 * Vendor service
 * Business logic layer for vendor operations
 */

import 'server-only';

import {
  findAllVendors,
  findVendorById,
  findVendorByName,
  findVendorsByType,
  getVendorTypesForName,
  upsertVendor,
  deleteVendor,
  findAllVendorTypes,
  createVendorType,
} from '../repositories/vendor.repository';
import type { Vendor, VendorType } from '../domain/types';

export class VendorService {
  /**
   * Get all vendors
   */
  async getAllVendors(): Promise<Vendor[]> {
    return await findAllVendors();
  }

  /**
   * Get vendor by ID
   */
  async getVendorById(id: string): Promise<Vendor | undefined> {
    return await findVendorById(id);
  }

  /**
   * Get vendor by name
   */
  async getVendorByName(name: string): Promise<Vendor | undefined> {
    return await findVendorByName(name);
  }

  /**
   * Get vendors by type
   */
  async getVendorsByType(vendorType: string): Promise<Vendor[]> {
    return await findVendorsByType(vendorType);
  }

  /**
   * Get suggested vendor types for a vendor name
   * Returns array of types that have been used for this vendor in the past
   */
  async getSuggestedVendorTypes(vendorName: string): Promise<string[]> {
    return await getVendorTypesForName(vendorName);
  }

  /**
   * Create or update vendor
   */
  async saveVendor(vendor: Vendor): Promise<void> {
    await upsertVendor(vendor);
  }

  /**
   * Delete vendor
   */
  async removeVendor(id: string): Promise<void> {
    await deleteVendor(id);
  }

  /**
   * Check if vendor exists, if not, flag for 1099 request
   */
  async checkVendorExists(vendorName: string): Promise<{ exists: boolean; requires1099?: boolean }> {
    const vendor = await findVendorByName(vendorName);
    if (!vendor) {
      return { exists: false, requires1099: true };
    }
    return { exists: true, requires1099: vendor.requires1099 };
  }

  /**
   * Get all vendor types
   */
  async getAllVendorTypes(): Promise<VendorType[]> {
    return await findAllVendorTypes();
  }

  /**
   * Create new vendor type
   */
  async createVendorType(vendorType: Omit<VendorType, 'id' | 'createdAt' | 'updatedAt'>): Promise<VendorType> {
    return await createVendorType(vendorType);
  }
}

// Export singleton instance
export const vendorService = new VendorService();





