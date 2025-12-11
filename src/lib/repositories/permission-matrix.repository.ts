/**
 * Permission Matrix Repository
 * Data access layer for permission matrix management
 */

import 'server-only';

import { getDb } from '../db';
import { permissionMatrix } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { PermissionMatrix, NewPermissionMatrix } from '../db/schema';
import { randomUUID } from 'crypto';

/**
 * Get all permission mappings for a role
 */
export async function getPermissionsByRole(role: string): Promise<PermissionMatrix[]> {
  const db = getDb();
  return await db.select().from(permissionMatrix).where(eq(permissionMatrix.role, role));
}

/**
 * Get all permission mappings
 */
export async function getAllPermissionMappings(): Promise<PermissionMatrix[]> {
  const db = getDb();
  return await db.select().from(permissionMatrix);
}

/**
 * Get a specific permission mapping
 */
export async function getPermissionMapping(role: string, permission: string): Promise<PermissionMatrix | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(permissionMatrix)
    .where(and(eq(permissionMatrix.role, role), eq(permissionMatrix.permission, permission)));
  return result[0] || null;
}

/**
 * Create or update a permission mapping
 */
export async function upsertPermissionMapping(
  data: Omit<NewPermissionMatrix, 'id' | 'createdAt' | 'updatedAt'>,
  userId?: string
): Promise<PermissionMatrix> {
  const db = getDb();
  
  // Check if mapping already exists
  const existing = await getPermissionMapping(data.role, data.permission);
  
  if (existing) {
    // Update existing
    const result = await db
      .update(permissionMatrix)
      .set({
        isGranted: data.isGranted,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(permissionMatrix.id, existing.id))
      .returning();
    return result[0];
  } else {
    // Create new
    const newMapping: NewPermissionMatrix = {
      id: randomUUID(),
      ...data,
      createdBy: userId,
      updatedBy: userId,
    };
    const result = await db.insert(permissionMatrix).values(newMapping).returning();
    return result[0];
  }
}

/**
 * Delete a permission mapping
 */
export async function deletePermissionMapping(role: string, permission: string): Promise<void> {
  const db = getDb();
  await db
    .delete(permissionMatrix)
    .where(and(eq(permissionMatrix.role, role), eq(permissionMatrix.permission, permission)));
}

/**
 * Initialize default permission matrix (used for seeding)
 */
export async function initializeDefaultPermissions(): Promise<void> {
  const db = getDb();
  
  // Check if permissions already exist
  const existing = await getAllPermissionMappings();
  if (existing.length > 0) {
    return; // Already initialized
  }

  // Default permissions for each role
  const defaultPermissions = [
    // Admin - all permissions
    { role: 'admin', permission: 'view_invoices', isGranted: true },
    { role: 'admin', permission: 'edit_invoices', isGranted: true },
    { role: 'admin', permission: 'delete_invoices', isGranted: true },
    { role: 'admin', permission: 'approve_invoices', isGranted: true },
    { role: 'admin', permission: 'view_users', isGranted: true },
    { role: 'admin', permission: 'edit_users', isGranted: true },
    { role: 'admin', permission: 'delete_users', isGranted: true },
    { role: 'admin', permission: 'view_settings', isGranted: true },
    { role: 'admin', permission: 'edit_settings', isGranted: true },
    { role: 'admin', permission: 'view_audit_logs', isGranted: true },
    { role: 'admin', permission: 'export_data', isGranted: true },
    { role: 'admin', permission: 'view_dashboard', isGranted: true },
    { role: 'admin', permission: 'view_all_dashboards', isGranted: true },
    
    // Director
    { role: 'director', permission: 'view_invoices', isGranted: true },
    { role: 'director', permission: 'edit_invoices', isGranted: true },
    { role: 'director', permission: 'approve_invoices', isGranted: true },
    { role: 'director', permission: 'view_users', isGranted: true },
    { role: 'director', permission: 'view_settings', isGranted: true },
    { role: 'director', permission: 'edit_settings', isGranted: true },
    { role: 'director', permission: 'view_audit_logs', isGranted: true },
    { role: 'director', permission: 'export_data', isGranted: true },
    { role: 'director', permission: 'view_dashboard', isGranted: true },
    { role: 'director', permission: 'view_all_dashboards', isGranted: true },
    
    // Manager
    { role: 'manager', permission: 'view_invoices', isGranted: true },
    { role: 'manager', permission: 'edit_invoices', isGranted: true },
    { role: 'manager', permission: 'approve_invoices', isGranted: true },
    { role: 'manager', permission: 'view_dashboard', isGranted: true },
    { role: 'manager', permission: 'view_all_dashboards', isGranted: true },
    
    // Senior Accountant
    { role: 'senior_accountant', permission: 'view_invoices', isGranted: true },
    { role: 'senior_accountant', permission: 'edit_invoices', isGranted: true },
    { role: 'senior_accountant', permission: 'view_dashboard', isGranted: true },
    
    // NY Accountant
    { role: 'ny_accountant', permission: 'view_invoices', isGranted: true },
    { role: 'ny_accountant', permission: 'edit_invoices', isGranted: true },
    { role: 'ny_accountant', permission: 'view_dashboard', isGranted: true },
    
    // CA Accountant
    { role: 'ca_accountant', permission: 'view_invoices', isGranted: true },
    { role: 'ca_accountant', permission: 'edit_invoices', isGranted: true },
    { role: 'ca_accountant', permission: 'view_dashboard', isGranted: true },
  ];

  // Insert all default permissions
  for (const perm of defaultPermissions) {
    await upsertPermissionMapping(perm);
  }
}
