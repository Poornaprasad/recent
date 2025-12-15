/**
 * Vendor mapper utilities
 * Maps between database rows and domain types
 */

import type { Vendor as DbVendor } from '../../db/schema';
import type { Vendor } from '../../domain/types';

/**
 * Map database row to Vendor domain object
 */
export function mapDbRowToVendor(row: DbVendor): Vendor {
  return {
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    vendorType: row.vendorType || undefined,
    requires1099: row.requires1099 ? true : undefined,
    requiresW9: row.requiresW9 ? true : undefined,
    w9Status: row.w9Status as Vendor['w9Status'] | undefined,
    w9ReceivedDate: row.w9ReceivedDate ? new Date(row.w9ReceivedDate as Date) : undefined,
    w9ExpiryDate: row.w9ExpiryDate ? new Date(row.w9ExpiryDate as Date) : undefined,
    form1099Status: row.form1099Status as Vendor['form1099Status'] | undefined,
    form1099ReceivedDate: row.form1099ReceivedDate ? new Date(row.form1099ReceivedDate as Date) : undefined,
    isPaused: row.isPaused ? true : undefined,
    pausedReason: row.pausedReason || undefined,
    pausedUntil: row.pausedUntil ? new Date((row.pausedUntil as Date).getTime() * 1000) : undefined,
    status: row.status as 'Active' | 'Inactive',
  };
}

/**
 * Map Vendor domain object to database row
 */
export function mapVendorToDbRow(vendor: Partial<Vendor>): Partial<DbVendor> {
  return {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    vendorType: vendor.vendorType,
    requires1099: vendor.requires1099 ? 1 : 0,
    requiresW9: vendor.requiresW9 ? 1 : 0,
    w9Status: vendor.w9Status,
    w9ReceivedDate: vendor.w9ReceivedDate ? vendor.w9ReceivedDate as any : undefined,
    w9ExpiryDate: vendor.w9ExpiryDate ? vendor.w9ExpiryDate as any : undefined,
    form1099Status: vendor.form1099Status,
    form1099ReceivedDate: vendor.form1099ReceivedDate ? vendor.form1099ReceivedDate as any : undefined,
    isPaused: vendor.isPaused ? 1 : 0,
    pausedReason: vendor.pausedReason,
    pausedUntil: vendor.pausedUntil ? Math.floor(vendor.pausedUntil.getTime() / 1000) as any : undefined,
    status: vendor.status,
  };
}
