/**
 * RBAC Middleware
 * Middleware for checking permissions in API routes and server actions
 */

import 'server-only';

import { rbacService, Permission, UserRole, type UserPermissions } from '../core/auth/rbac.service';
import { logger } from '../core/logging/logger.service';

export interface AuthContext {
  userId: string;
  userRole: UserRole;
  assignedStates?: string[];
}

/**
 * Check if user has permission
 */
export function requirePermission(
  authContext: AuthContext | null,
  permission: Permission
): void {
  if (!authContext) {
    throw new Error('Authentication required');
  }

  const userPermissions = rbacService.getUserPermissions(
    authContext.userRole,
    authContext.assignedStates
  );

  if (!rbacService.hasPermission(userPermissions, permission)) {
    logger.warn('Permission denied', {
      userId: authContext.userId,
      permission,
      role: authContext.userRole,
    });
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Check if user can access state
 */
export function requireStateAccess(
  authContext: AuthContext | null,
  state: string
): void {
  if (!authContext) {
    throw new Error('Authentication required');
  }

  const userPermissions = rbacService.getUserPermissions(
    authContext.userRole,
    authContext.assignedStates
  );

  if (!rbacService.canAccessState(userPermissions, state)) {
    logger.warn('State access denied', {
      userId: authContext.userId,
      state,
      role: authContext.userRole,
      assignedStates: authContext.assignedStates,
    });
    throw new Error(`Access denied to state: ${state}`);
  }
}

/**
 * Check if user has elevated role
 */
export function requireElevatedRole(authContext: AuthContext | null): void {
  if (!authContext) {
    throw new Error('Authentication required');
  }

  if (!rbacService.isElevatedRole(authContext.userRole)) {
    logger.warn('Elevated role required', {
      userId: authContext.userId,
      role: authContext.userRole,
    });
    throw new Error('Elevated role required (Admin, Director, or Manager)');
  }
}

