/**
 * Permission Matrix Actions
 * Server actions for permission matrix management
 */

'use server';

import { revalidatePath } from 'next/cache';
import * as permissionMatrixService from '../services/permission-matrix.service';
import type { PermissionMatrix } from '../db/schema';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import { UserRole } from '../core/auth/rbac.types';

/**
 * Get all permission mappings
 */
export async function getAllPermissionMappingsAction(): Promise<ActionResult<PermissionMatrix[]>> {
  return withActionHandler(
    async () => {
      const mappings = await permissionMatrixService.getAllPermissionMappings();
      return mappings;
    },
    'Failed to fetch permission mappings'
  );
}

/**
 * Update a permission mapping
 * Only Admin and Director can update permissions
 */
export async function updatePermissionAction(
  input: {
    role: string;
    permission: string;
    isGranted: boolean;
  },
  currentUserRole: string,
  currentUserId: string
): Promise<ActionResult<PermissionMatrix>> {
  return withActionHandler(
    async () => {
      // Check if user can edit permission matrix
      if (!permissionMatrixService.canEditPermissionMatrix(currentUserRole)) {
        throw new Error('You do not have permission to edit the permission matrix');
      }

      const mapping = await permissionMatrixService.updatePermission(input, currentUserId);
      revalidatePath('/roles-permissions');
      return mapping;
    },
    'Failed to update permission'
  );
}

/**
 * Initialize default permissions
 */
export async function initializeDefaultPermissionsAction(): Promise<ActionResult<void>> {
  return withActionHandler(
    async () => {
      await permissionMatrixService.initializeDefaultPermissions();
      revalidatePath('/roles-permissions');
    },
    'Failed to initialize default permissions'
  );
}
