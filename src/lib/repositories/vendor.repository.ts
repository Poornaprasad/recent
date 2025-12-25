/**
 * Vendor repository
 * Data access layer for vendors
 */

import 'server-only';

import { eq, desc } from 'drizzle-orm';
import { getDatabase } from '../db/context';
import { vendors, vendorTypes, type Vendor as DbVendor, type VendorType as DbVendorType } from '../db/schema';
import type { Vendor, VendorType } from '../domain/types';
import { mapDbRowToVendor, mapVendorToDbRow } from './mappers/vendor.mapper';

/**
 * Get all vendors
 */
export async function findAllVendors(): Promise<Vendor[]> {
  const db = await getDatabase();

  const rows = await db
    .select()
    .from(vendors)
    .orderBy(desc(vendors.createdAt));

  return rows.map(mapDbRowToVendor);
}

/**
 * Get vendor by ID
 */
export async function findVendorById(id: string): Promise<Vendor | undefined> {
  const db = await getDatabase();

  const row = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, id))
    .limit(1)
    .then(rows => rows[0]);

  if (!row) return undefined;

  return mapDbRowToVendor(row);
}

/**
 * Find vendor by name (case-insensitive)
 */
export async function findVendorByName(name: string): Promise<Vendor | undefined> {
  const allVendors = await findAllVendors();
  return allVendors.find(v => v.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get vendors by type
 */
export async function findVendorsByType(vendorType: string): Promise<Vendor[]> {
  const db = await getDatabase();

  const rows = await db
    .select()
    .from(vendors)
    .where(eq(vendors.vendorType, vendorType))
    .orderBy(desc(vendors.createdAt));

  return rows.map(mapDbRowToVendor);
}

/**
 * Get historical vendor types for a vendor name
 * Returns array of unique types used by this vendor
 */
export async function getVendorTypesForName(vendorName: string): Promise<string[]> {
  const db = await getDatabase();

  const rows = await db
    .select({ vendorType: vendors.vendorType })
    .from(vendors)
    .where(eq(vendors.name, vendorName));

  const types = rows
    .map(row => row.vendorType)
    .filter((type): type is string => type !== null && type !== undefined);

  return [...new Set(types)];
}

/**
 * Create or update a vendor (upsert)
 */
export async function upsertVendor(vendor: Vendor): Promise<void> {
  const db = await getDatabase();

  const row = {
    ...mapVendorToDbRow(vendor),
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  } as DbVendor;

  // For insert, include createdAt if provided
  const insertRow = {
    ...row,
    createdAt: vendor.createdAt || new Date(Math.floor(Date.now() / 1000) * 1000),
  };

  // For update, exclude id and createdAt (don't change these)
  const { id, createdAt, ...updateRow } = insertRow;

  try {
    await db
      .insert(vendors)
      .values(insertRow)
      .onConflictDoUpdate({
        target: vendors.id,
        set: updateRow,
      });
  } catch (error) {
    console.error('Error upserting vendor:', error);
    console.error('Vendor data:', JSON.stringify(vendor, null, 2));
    console.error('Insert row:', JSON.stringify(insertRow, null, 2));
    console.error('Update row:', JSON.stringify(updateRow, null, 2));
    throw error;
  }
}

/**
 * Delete vendor
 */
export async function deleteVendor(id: string): Promise<void> {
  const db = await getDatabase();

  await db
    .delete(vendors)
    .where(eq(vendors.id, id));
}

/**
 * Get all vendor types
 */
export async function findAllVendorTypes(): Promise<VendorType[]> {
  const db = await getDatabase();

  const rows = await db
    .select()
    .from(vendorTypes)
    .where(eq(vendorTypes.isActive, true))
    .orderBy(vendorTypes.name);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    isActive: row.isActive ? true : false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Create vendor type
 */
export async function createVendorType(vendorType: Omit<VendorType, 'id' | 'createdAt' | 'updatedAt'>): Promise<VendorType> {
  const db = await getDatabase();

  const id = `vt-${Date.now()}`;
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);

  const row: DbVendorType = {
    id,
    name: vendorType.name,
    description: vendorType.description || null,
    isActive: vendorType.isActive ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(vendorTypes).values(row);

  return {
    id,
    name: vendorType.name,
    description: vendorType.description,
    isActive: vendorType.isActive,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Upsert vendor type (create or update)
 */
export async function upsertVendorType(vendorType: VendorType): Promise<VendorType> {
  const db = await getDatabase();

  const row: DbVendorType = {
    id: vendorType.id,
    name: vendorType.name,
    description: vendorType.description || null,
    isActive: vendorType.isActive ? 1 : 0,
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
