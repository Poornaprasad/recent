/**
 * RBAC Service
 * Role-Based Access Control for the application
 */

import 'server-only';

export enum UserRole {
  ADMIN = 'admin',
  DIRECTOR = 'director',
  MANAGER = 'manager',
  ACCOUNT = 'account',
  USER = 'user',
}

export enum Permission {
  // Invoice permissions
  VIEW_INVOICES = 'view_invoices',
  EDIT_INVOICES = 'edit_invoices',
  DELETE_INVOICES = 'delete_invoices',
  APPROVE_INVOICES = 'approve_invoices',
  
  // User management
  VIEW_USERS = 'view_users',
  EDIT_USERS = 'edit_users',
  DELETE_USERS = 'delete_users',
  
  // Configuration
  VIEW_SETTINGS = 'view_settings',
  EDIT_SETTINGS = 'edit_settings',
  
  // Audit
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  
  // Export
  EXPORT_DATA = 'export_data',
  
  // Dashboard
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_ALL_DASHBOARDS = 'view_all_dashboards',
}

export interface RolePermissions {
  [UserRole.ADMIN]: Permission[];
  [UserRole.DIRECTOR]: Permission[];
  [UserRole.MANAGER]: Permission[];
  [UserRole.ACCOUNT]: Permission[];
  [UserRole.USER]: Permission[];
}

/**
 * Role permissions mapping
 */
const ROLE_PERMISSIONS: RolePermissions = {
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
  [UserRole.ACCOUNT]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.VIEW_DASHBOARD,
  ],
  [UserRole.USER]: [
    Permission.VIEW_INVOICES,
    Permission.EDIT_INVOICES,
    Permission.VIEW_DASHBOARD,
  ],
};

export interface UserPermissions {
  role: UserRole;
  assignedStates?: string[]; // For ACCOUNT role - which states they can access
  permissions: Permission[];
}

class RBACService {
  /**
   * Get permissions for a role
   */
  getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
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

    // Account role can only access assigned states
    if (userPermissions.role === UserRole.ACCOUNT) {
      return userPermissions.assignedStates?.includes(state) || false;
    }

    // User role - can access their own invoices regardless of state
    // This is handled at the data level, not permission level
    return true;
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

    // Account and User can approve if amount is below threshold
    return amount <= threshold;
  }

  /**
   * Get user permissions object
   */
  getUserPermissions(role: UserRole, assignedStates?: string[]): UserPermissions {
    return {
      role,
      assignedStates,
      permissions: this.getRolePermissions(role),
    };
  }

  /**
   * Check if role has elevated privileges
   */
  isElevatedRole(role: UserRole): boolean {
    return [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.MANAGER].includes(role);
  }
}

// Export singleton instance
export const rbacService = new RBACService();

