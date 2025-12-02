/**
 * Vendor repository
 * Data access layer for vendors
 */

import 'server-only';

import { eq, desc, asc } from 'drizzle-orm';
import { getDb, initDb } from '../db';
import { vendors, vendorTypes } from '../db/schema';
import type { Vendor, VendorType } from '../domain/types';

/**
 * Get all vendors
 */
export async function findAllVendors(): Promise<Vendor[]> {
  await initDb();
  const db = getDb();
  
  const rows = await db
    .select()
    .from(vendors)
    .orderBy(desc(vendors.createdAt));
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    vendorType: row.vendorType || undefined,
    requires1099: (row.requires1099 || (row as any).requires_1099) ? true : undefined,
    status: row.status as Vendor['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Get vendor by ID
 */
export async function findVendorById(id: string): Promise<Vendor | undefined> {
  await initDb();
  const db = getDb();
  
  const row = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, id))
    .limit(1)
    .then(rows => rows[0]);
  
  if (!row) return undefined;
  
  return {
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    vendorType: row.vendorType || undefined,
    requires1099: (row.requires1099 || (row as any).requires_1099) ? true : undefined,
    status: row.status as Vendor['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Find vendor by name (case-insensitive)
 */
export async function findVendorByName(name: string): Promise<Vendor | undefined> {
  await initDb();
  const db = getDb();
  
  const allVendors = await findAllVendors();
  return allVendors.find(v => v.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get vendors by type
 */
export async function findVendorsByType(vendorType: string): Promise<Vendor[]> {
  await initDb();
  const db = getDb();
  
  const rows = await db
    .select()
    .from(vendors)
    .where(eq(vendors.vendorType, vendorType))
    .orderBy(desc(vendors.createdAt));
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    vendorType: row.vendorType || undefined,
    requires1099: (row.requires1099 || (row as any).requires_1099) ? true : undefined,
    status: row.status as Vendor['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Get historical vendor types for a vendor name
 * Returns array of unique types used by this vendor
 */
export async function getVendorTypesForName(vendorName: string): Promise<string[]> {
  await initDb();
  const db = getDb();
  
  const rows = await db
    .select({ vendorType: vendors.vendorType })
    .from(vendors)
    .where(eq(vendors.name, vendorName));
  
  const types = rows
    .map(row => row.vendorType)
    .filter((type): type is string => type !== null && type !== undefined);
  
  return [...new Set(types)]; // Return unique types
}

/**
 * Create or update a vendor (upsert)
 */
export async function upsertVendor(vendor: Vendor): Promise<void> {
  await initDb();
  const db = getDb();
  
  const row = {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email || null,
    phone: vendor.phone || null,
    address: vendor.address || null,
    vendorType: vendor.vendorType || null,
    requires1099: vendor.requires1099 ? true : false,
    status: vendor.status,
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  };
  
  await db
    .insert(vendors)
    .values(row)
    .onConflictDoUpdate({
      target: vendors.id,
      set: row,
    });
}

/**
 * Delete vendor
 */
export async function deleteVendor(id: string): Promise<void> {
  await initDb();
  const db = getDb();
  
  await db
    .delete(vendors)
    .where(eq(vendors.id, id));
}

/**
 * Get all vendor types
 */
export async function findAllVendorTypes(): Promise<VendorType[]> {
  await initDb();
  const db = getDb();
  
  const rows = await db
    .select()
    .from(vendorTypes)
    .where(eq(vendorTypes.isActive, true))
    .orderBy(vendorTypes.name);
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    isActive: (row.isActive || (row as any).is_active) ? true : false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Create vendor type
 */
export async function createVendorType(vendorType: Omit<VendorType, 'id' | 'createdAt' | 'updatedAt'>): Promise<VendorType> {
  await initDb();
  const db = getDb();
  
  const id = `vt-${Date.now()}`;
  const row = {
    id,
    name: vendorType.name,
    description: vendorType.description || null,
    isActive: vendorType.isActive ? true : false,
    createdAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  };
  
  await db.insert(vendorTypes).values(row);
  
  return {
    id,
    name: vendorType.name,
    description: vendorType.description,
    isActive: vendorType.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Upsert vendor type (create or update)
 */
export async function upsertVendorType(vendorType: VendorType): Promise<VendorType> {
  await initDb();
  const db = getDb();
  
  const row = {
    id: vendorType.id,
    name: vendorType.name,
    description: vendorType.description || null,
    isActive: vendorType.isActive,
    createdAt: vendorType.createdAt,
    updatedAt: vendorType.updatedAt,
  };
  
  await db
    .insert(vendorTypes)
    .values(row)
    .onConflictDoUpdate({
      target: vendorTypes.name,
      set: {
        description: row.description,
        isActive: row.isActive,
        updatedAt: row.updatedAt,
      },
    });
  
  return vendorType;
}

