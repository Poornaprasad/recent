/**
 * Pending vendor repository
 * Data access layer for pending vendors (vendors detected during invoice processing)
 */

import 'server-only';

import { eq, desc } from 'drizzle-orm';
import { getDb, initDb } from '../db';
import { pendingVendors } from '../db/schema';
import type { PendingVendor } from '../domain/types';

/**
 * Get all pending vendors
 */
export async function findAllPendingVendors(): Promise<PendingVendor[]> {
  await initDb();
  const db = getDb();
  
  const rows = await db
    .select()
    .from(pendingVendors)
    .where(eq(pendingVendors.status, 'Pending'))
    .orderBy(desc(pendingVendors.createdAt));
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    vendorType: row.vendorType || undefined,
    invoiceId: row.invoiceId || undefined,
    status: row.status as PendingVendor['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Get pending vendor by ID
 */
export async function findPendingVendorById(id: string): Promise<PendingVendor | undefined> {
  await initDb();
  const db = getDb();
  
  const row = await db
    .select()
    .from(pendingVendors)
    .where(eq(pendingVendors.id, id))
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
    invoiceId: row.invoiceId || undefined,
    status: row.status as PendingVendor['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get pending vendor by invoice ID
 */
export async function findPendingVendorByInvoiceId(invoiceId: string): Promise<PendingVendor | undefined> {
  await initDb();
  const db = getDb();
  
  const row = await db
    .select()
    .from(pendingVendors)
    .where(eq(pendingVendors.invoiceId, invoiceId))
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
    invoiceId: row.invoiceId || undefined,
    status: row.status as PendingVendor['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Create pending vendor
 */
export async function createPendingVendor(pendingVendor: Omit<PendingVendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<PendingVendor> {
  await initDb();
  const db = getDb();
  
  const id = `pv-${Date.now()}`;
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  
  const row = {
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
export async function updatePendingVendor(id: string, updates: Partial<Omit<PendingVendor, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  await initDb();
  const db = getDb();
  
  const row: any = {
    updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
  };
  
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email || null;
  if (updates.phone !== undefined) row.phone = updates.phone || null;
  if (updates.address !== undefined) row.address = updates.address || null;
  if (updates.vendorType !== undefined) row.vendorType = updates.vendorType || null;
  if (updates.status !== undefined) row.status = updates.status;
  
  await db
    .update(pendingVendors)
    .set(row)
    .where(eq(pendingVendors.id, id));
}

/**
 * Delete pending vendor
 */
export async function deletePendingVendor(id: string): Promise<void> {
  await initDb();
  const db = getDb();
  
  await db
    .delete(pendingVendors)
    .where(eq(pendingVendors.id, id));
}





