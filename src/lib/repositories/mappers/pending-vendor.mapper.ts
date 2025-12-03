/**
 * Pending Vendor mapper utilities
 * Maps between database rows and domain types
 */

import type { PendingVendor as DbPendingVendor } from '../../db/schema';
import type { PendingVendor } from '../../domain/types';

/**
 * Map database row to PendingVendor domain object
 */
export function mapDbRowToPendingVendor(row: DbPendingVendor): PendingVendor {
  return {
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    vendorType: row.vendorType || undefined,
    invoiceId: row.invoiceId || undefined,
    status: row.status as 'Pending' | 'Completed' | 'Rejected',
  };
}

/**
 * Map PendingVendor domain object to database row
 */
export function mapPendingVendorToDbRow(vendor: Partial<PendingVendor>): Partial<DbPendingVendor> {
  return {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    vendorType: vendor.vendorType,
    invoiceId: vendor.invoiceId,
    status: vendor.status,
  };
}
