/**
 * RBAC Service
 * Role-Based Access Control for the application
 */

import 'server-only';

import * as permissionMatrixService from '../../services/permission-matrix.service';
import { UserRole, Permission } from './rbac.types';

// Re-export types for convenience
export { UserRole, Permission };

export interface RolePermissions {
  [UserRole.ADMIN]: Permission[];
  [UserRole.DIRECTOR]: Permission[];
  [UserRole.MANAGER]: Permission[];
  [UserRole.SENIOR_ACCOUNTANT]: Permission[];
  [UserRole.NY_ACCOUNTANT]: Permission[];
  [UserRole.CA_ACCOUNTANT]: Permission[];
}

/**
 * Default role permissions mapping
 * This is used as fallback if database permissions are not available
 * The actual permissions should be loaded from the permission_matrix table
 */
const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.ADMIN]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.DELETE_INVOICES,
    Permission.APPROVE_INVOICES,
    Permission.VIEW_USERS,
    Permission.EDIT_USERS,
    Permission.DELETE_USERS,
    Permission.VIEW_SETTINGS,
    Permission.EDIT_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_DATA,
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ALL_DASHBOARDS,
    Permission.MANAGE_W9_STATUS,
    Permission.VIEW_VENDORS,
    Permission.EDIT_VENDORS,
  ],
  [UserRole.DIRECTOR]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.APPROVE_INVOICES,
    Permission.VIEW_USERS,
    Permission.VIEW_SETTINGS,
    Permission.EDIT_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_DATA,
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ALL_DASHBOARDS,
  ],
  [UserRole.MANAGER]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.APPROVE_INVOICES,
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ALL_DASHBOARDS,
  ],
  [UserRole.SENIOR_ACCOUNTANT]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.VIEW_DASHBOARD,
  ],
  [UserRole.NY_ACCOUNTANT]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.VIEW_DASHBOARD,
  ],
  [UserRole.CA_ACCOUNTANT]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.VIEW_DASHBOARD,
  ],
};

export interface UserPermissions {
  role: UserRole;
  assignedStates?: string[]; // For accountant roles - additional states they can access
  permissions: Permission[];
}

class RBACService {
  /**
   * Get permissions for a role
   * Loads from database permission matrix, falls back to default if not found
   */
  async getRolePermissions(role: UserRole): Promise<Permission[]> {
    try {
      const permissionNames = await permissionMatrixService.getPermissionNamesByRole(role);
      // Convert permission names to Permission enum values
      return permissionNames
        .map(name => Object.values(Permission).find(p => p === name))
        .filter((p): p is Permission => p !== undefined);
    } catch (error) {
      // Fallback to default permissions if database query fails
      console.warn(`Failed to load permissions from database for role ${role}, using defaults:`, error);
      return DEFAULT_ROLE_PERMISSIONS[role] || [];
    }
  }

  /**
   * Get permissions for a role (synchronous version, uses defaults)
   * Use this only when async is not possible
   */
  getRolePermissionsSync(role: UserRole): Permission[] {
    return DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if user has permission
   */
  hasPermission(userPermissions: UserPermissions, permission: Permission): boolean {
    return userPermissions.permissions.includes(permission);
  }

  /**
   * Check if user can access state
   */
  canAccessState(userPermissions: UserPermissions, state: string): boolean {
    // Admin, Director, Manager can access all states
    if ([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MANAGER].includes(userPermissions.role)) {
      return true;
    }

    // Senior Accountant can access all states by default
    if (userPermissions.role === UserRole.SENIOR_ACCOUNTANT) {
      return true;
    }

    // NY Accountant can access NY by default, and other states if assigned
    if (userPermissions.role === UserRole.NY_ACCOUNTANT) {
      if (state === 'NY') return true;
      return userPermissions.assignedStates?.includes(state) || false;
    }

    // CA Accountant can access CA by default, and other states if assigned
    if (userPermissions.role === UserRole.CA_ACCOUNTANT) {
      if (state === 'CA') return true;
      return userPermissions.assignedStates?.includes(state) || false;
    }

    return false;
  }

  /**
   * Check if user can approve amount
   */
  canApproveAmount(userPermissions: UserPermissions, amount: number, threshold: number): boolean {
    // Admin and Director can always approve
    if ([UserRole.ADMIN, UserRole.DIRECTOR].includes(userPermissions.role)) {
      return true;
    }

    // Manager can approve if amount is below threshold
    if (userPermissions.role === UserRole.MANAGER) {
      return amount <= threshold;
    }

    // Accountant roles can approve if amount is below threshold
    return amount <= threshold;
  }

  /**
   * Get user permissions object (async version)
   */
  async getUserPermissions(role: UserRole, assignedStates?: string[]): Promise<UserPermissions> {
    return {
      role,
      assignedStates,
      permissions: await this.getRolePermissions(role),
    };
  }

  /**
   * Get user permissions object (synchronous version)
   */
  getUserPermissionsSync(role: UserRole, assignedStates?: string[]): UserPermissions {
    return {
      role,
      assignedStates,
      permissions: this.getRolePermissionsSync(role),
    };
  }

  /**
   * Check if role has elevated privileges
   */
  isElevatedRole(role: UserRole): boolean {
    return [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MANAGER].includes(role);
  }

  /**
   * Check if role is an accountant role
   */
  isAccountantRole(role: UserRole): boolean {
    return [
      UserRole.SENIOR_ACCOUNTANT,
      UserRole.NY_ACCOUNTANT,
      UserRole.CA_ACCOUNTANT,
    ].includes(role);
  }
}

// Export singleton instance
export const rbacService = new RBACService();

