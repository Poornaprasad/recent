/**
 * Pending vendor repository
 * Data access layer for pending vendors (vendors detected during invoice processing)
 */

import 'server-only';

import { eq, desc } from 'drizzle-orm';
import { getDatabase } from '../db/context';
import { pendingVendors, type PendingVendor as DbPendingVendor } from '../db/schema';
import type { PendingVendor } from '../domain/types';
import { mapDbRowToPendingVendor, mapPendingVendorToDbRow } from './mappers/pending-vendor.mapper';

/**
 * Get all pending vendors
 */
export async function findAllPendingVendors(): Promise<PendingVendor[]> {
  const db = await getDatabase();

  const rows = await db
    .select()
    .from(pendingVendors)
    .where(eq(pendingVendors.status, 'Pending'))
    .orderBy(desc(pendingVendors.createdAt));

  return rows.map(mapDbRowToPendingVendor);
}

/**
 * Get pending vendor by ID
 */
export async function findPendingVendorById(id: string): Promise<PendingVendor | undefined> {
  const db = await getDatabase();

  const row = await db
    .select()
    .from(pendingVendors)
    .where(eq(pendingVendors.id, id))
    .limit(1)
    .then(rows => rows[0]);

  if (!row) return undefined;

  return mapDbRowToPendingVendor(row);
}

/**
 * Get pending vendor by invoice ID
 */
export async function findPendingVendorByInvoiceId(invoiceId: string): Promise<PendingVendor | undefined> {
  const db = await getDatabase();

  const row = await db
    .select()
    .from(pendingVendors)
    .where(eq(pendingVendors.invoiceId, invoiceId))
    .limit(1)
    .then(rows => rows[0]);

  if (!row) return undefined;

  return mapDbRowToPendingVendor(row);
}

/**
 * Create pending vendor
 */
export async function createPendingVendor(pendingVendor: Omit<PendingVendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<PendingVendor> {
  const db = await getDatabase();

  const id = `pv-${Date.now()}`;
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);

  const row: DbPendingVendor = {
    id,
    name: pendingVendor.name,
    email: pendingVendor.email || null,
    phone: pendingVendor.phone || null,
    address: pendingVendor.address || null,
    vendorType: pendingVendor.vendorType || null,
    invoiceId: pendingVendor.invoiceId || null,
    status: pendingVendor.status,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(pendingVendors).values(row);

  return {
    id,
    name: pendingVendor.name,
    email: pendingVendor.email,
    phone: pendingVendor.phone,
    address: pendingVendor.address,
    vendorType: pendingVendor.vendorType,
    invoiceId: pendingVendor.invoiceId,
    status: pendingVendor.status,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update pending vendor
 */
export async function updatePendingVendor(
  id: string,
  updates: Partial<Omit<PendingVendor, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = await getDatabase();

  const row: Partial<DbPendingVendor> = {
    ...mapPendingVendorToDbRow(updates),
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  };

  await db
    .update(pendingVendors)
    .set(row)
    .where(eq(pendingVendors.id, id));
}

/**
 * Delete pending vendor
 */
export async function deletePendingVendor(id: string): Promise<void> {
  const db = await getDatabase();

  await db
    .delete(pendingVendors)
    .where(eq(pendingVendors.id, id));
}
