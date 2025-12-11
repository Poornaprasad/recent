/**
 * Permission Matrix Service
 * Business logic for permission matrix management
 */

import 'server-only';

import * as permissionMatrixRepository from '../repositories/permission-matrix.repository';
import type { PermissionMatrix } from '../db/schema';
import { UserRole } from '../core/auth/rbac.types';

export interface UpdatePermissionInput {
  role: string;
  permission: string;
  isGranted: boolean;
}

/**
 * Get all permission mappings for a role
 */
export async function getPermissionsByRole(role: string): Promise<PermissionMatrix[]> {
  return await permissionMatrixRepository.getPermissionsByRole(role);
}

/**
 * Get all permission mappings
 */
export async function getAllPermissionMappings(): Promise<PermissionMatrix[]> {
  return await permissionMatrixRepository.getAllPermissionMappings();
}

/**
 * Get permissions for a role as an array of permission names
 */
export async function getPermissionNamesByRole(role: string): Promise<string[]> {
  const mappings = await getPermissionsByRole(role);
  return mappings.filter(m => m.isGranted).map(m => m.permission);
}

/**
 * Update a permission mapping
 */
export async function updatePermission(
  input: UpdatePermissionInput,
  userId: string
): Promise<PermissionMatrix> {
  return await permissionMatrixRepository.upsertPermissionMapping(
    {
      role: input.role,
      permission: input.permission,
      isGranted: input.isGranted,
    },
    userId
  );
}

/**
 * Initialize default permissions (for seeding)
 */
export async function initializeDefaultPermissions(): Promise<void> {
  return await permissionMatrixRepository.initializeDefaultPermissions();
}

/**
 * Check if user can edit permission matrix (only Admin and Director)
 */
export function canEditPermissionMatrix(userRole: string): boolean {
  return userRole === UserRole.ADMIN || userRole === UserRole.DIRECTOR;
}
