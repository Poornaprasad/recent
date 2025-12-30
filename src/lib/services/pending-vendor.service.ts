/**
 * Pending vendor service
 * Business logic layer for pending vendor operations
 */

import 'server-only';

import { logger } from '../core/logging/logger.service';
import {
  findAllPendingVendors,
  findPendingVendorById,
  findPendingVendorByInvoiceId,
  createPendingVendor,
  updatePendingVendor,
  deletePendingVendor,
} from '../repositories/pending-vendor.repository';
import { upsertVendor } from '../repositories/vendor.repository';
import type { PendingVendor, Vendor } from '../domain/types';

export class PendingVendorService {
  /**
   * Get all pending vendors
   */
  async getAllPendingVendors(): Promise<PendingVendor[]> {
    return await findAllPendingVendors();
  }

  /**
   * Get pending vendor by ID
   */
  async getPendingVendorById(id: string): Promise<PendingVendor | undefined> {
    return await findPendingVendorById(id);
  }

  /**
   * Get pending vendor by invoice ID
   */
  async getPendingVendorByInvoiceId(invoiceId: string): Promise<PendingVendor | undefined> {
    return await findPendingVendorByInvoiceId(invoiceId);
  }

  /**
   * Complete vendor setup - convert pending vendor to active vendor
   */
  async completeVendorSetup(
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
      const pendingVendor = await findPendingVendorById(pendingVendorId);
      if (!pendingVendor) {
        return { success: false, error: 'Pending vendor not found' };
      }

      // Create active vendor
      const vendorId = `vendor-${Date.now()}`;
      const now = new Date(Math.floor(Date.now() / 1000) * 1000);
      
      const vendor: Vendor = {
        id: vendorId,
        name: pendingVendor.name,
        email: vendorData.email || pendingVendor.email,
        phone: vendorData.phone || pendingVendor.phone,
        address: vendorData.address || pendingVendor.address,
        vendorType: vendorData.vendorType || pendingVendor.vendorType,
        requires1099: vendorData.requires1099 !== undefined ? vendorData.requires1099 : true,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      };

      await upsertVendor(vendor);

      // Mark pending vendor as completed
      await updatePendingVendor(pendingVendorId, { status: 'Completed' });

      return { success: true, vendorId };
    } catch (error) {
      logger.error('Error completing vendor setup', { pendingVendorId }, error instanceof Error ? error : undefined);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete vendor setup';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Reject pending vendor
   */
  async rejectPendingVendor(id: string): Promise<void> {
    await updatePendingVendor(id, { status: 'Rejected' });
  }

  /**
   * Update pending vendor
   */
  async updatePendingVendor(id: string, updates: Partial<Omit<PendingVendor, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await updatePendingVendor(id, updates);
  }
}

// Export singleton instance
export const pendingVendorService = new PendingVendorService();





