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
import { findAllInvoices, findInvoicesByVendorName } from '../repositories/invoice.repository';
import { parseInvoiceAmount } from '../utils/invoice-utils';
import type { Vendor, VendorType } from '../domain/types';
import type { StoredInvoice } from '../domain/types';

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

  /**
   * Get vendor invoices grouped by vendor with totals and case details
   * Returns vendors that require 1099 with their invoices, case numbers, and total amounts
   * Includes:
   * 1. Vendors with addresses that are NOT in the vendor list
   * 2. Vendors in the vendor list that require 1099
   * 3. Invoices flagged with vendorRequires1099
   */
  async getVendorInvoicesFor1099(): Promise<Array<{
    vendorName: string;
    vendor?: Vendor;
    totalAmount: number;
    isBelowThreshold: boolean; // true if total < $600
    invoices: Array<{
      invoice: StoredInvoice;
      caseNumber?: string;
      amount: number;
    }>;
    form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
    w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
    canProcessInvoices: boolean; // true if 1099/W9 is received or tracked
  }>> {
    // Get all invoices
    const allInvoices = await findAllInvoices();
    
    // Get all vendors
    const allVendors = await findAllVendors();
    const vendorsRequiring1099 = allVendors.filter(v => v.requires1099);
    
    // Create a map of vendor names (lowercase) to vendor objects for quick lookup
    const vendorMap = new Map<string, Vendor>();
    allVendors.forEach(v => {
      vendorMap.set(v.name.toLowerCase(), v);
    });
    
    // Group invoices by vendor name (case-insensitive)
    const vendorInvoiceMap = new Map<string, StoredInvoice[]>();
    
    // Process all invoices
    for (const invoice of allInvoices) {
      const vendorName = invoice.vendorName?.value;
      if (!vendorName) continue;
      
      const vendorNameLower = vendorName.toLowerCase();
      const vendor = vendorMap.get(vendorNameLower);
      
      // Check if vendor has an address (from invoice or vendor record)
      // Address can be in vendorAddress field (ExtractedField) or address field
      const hasAddress = !!(
        (invoice.vendorAddress?.value && typeof invoice.vendorAddress.value === 'string' && invoice.vendorAddress.value.trim().length > 0) ||
        (vendor?.address && vendor.address.trim().length > 0)
      );
      
      // Include invoice if:
      // 1. Vendor is NOT in vendor list AND has an address (needs 1099 setup)
      // 2. Vendor is in vendor list AND requires 1099
      // 3. Invoice is flagged with vendorRequires1099
      const shouldInclude = 
        (!vendor && hasAddress) || // Not in vendor list but has address
        (vendor && vendor.requires1099) || // In vendor list and requires 1099
        invoice.vendorRequires1099; // Explicitly flagged
      
      if (shouldInclude) {
        if (!vendorInvoiceMap.has(vendorNameLower)) {
          vendorInvoiceMap.set(vendorNameLower, []);
        }
        vendorInvoiceMap.get(vendorNameLower)!.push(invoice);
      }
    }
    
    // Build result array
    const result: Array<{
      vendorName: string;
      vendor?: Vendor;
      totalAmount: number;
      isBelowThreshold: boolean;
      invoices: Array<{
        invoice: StoredInvoice;
        caseNumber?: string;
        amount: number;
      }>;
      form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
      w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
      canProcessInvoices: boolean;
    }> = [];
    
    for (const [vendorNameLower, invoices] of vendorInvoiceMap.entries()) {
      // Find the vendor (if exists in vendor list)
      const vendor = vendorMap.get(vendorNameLower);
      
      // Get the actual vendor name (preserve case from first invoice or vendor)
      const actualVendorName = vendor?.name || invoices[0]?.vendorName?.value || vendorNameLower;
      
      // Calculate total amount
      const totalAmount = invoices.reduce((sum, inv) => {
        const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
        return sum + (amount || 0);
      }, 0);
      
      // Check if below $600 threshold
      const isBelowThreshold = totalAmount < 600;
      
      // Get 1099/W9 status
      // If vendor is not in vendor list, default to 'Required'
      const form1099Status = vendor?.form1099Status || (vendor ? undefined : 'Required');
      const w9Status = vendor?.w9Status;
      
      // Check if can process invoices (1099/W9 received or tracked)
      // If vendor is not in vendor list, cannot process until added
      const canProcessInvoices = vendor ? (
        form1099Status === 'Received' || 
        form1099Status === 'Tracked' ||
        w9Status === 'Received'
      ) : false; // Cannot process if vendor not in list
      
      // Build invoice details with case numbers
      const invoiceDetails = invoices.map(inv => ({
        invoice: inv,
        caseNumber: inv.caseNumber,
        amount: parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value),
      }));
      
      result.push({
        vendorName: actualVendorName,
        vendor,
        totalAmount,
        isBelowThreshold,
        invoices: invoiceDetails,
        form1099Status,
        w9Status,
        canProcessInvoices,
      });
    }
    
    // Sort by vendor name
    result.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    
    return result;
  }
}

// Export singleton instance
export const vendorService = new VendorService();





