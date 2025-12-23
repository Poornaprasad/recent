/**
 * User Actions
 * Server actions for user management
 */

'use server';

import { revalidatePath } from 'next/cache';
import * as userService from '../services/user.service';
import type { User } from '../db/schema';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import { auditService } from '../core/audit/audit.service';
import { AuditAction, AuditResource, AuditCategory, AuditSeverity } from '../core/audit/audit.types';

/**
 * Get all users
 */
export async function getUsersAction(): Promise<ActionResult<User[]>> {
  return withActionHandler(
    async () => {
      const users = await userService.getAllUsers();
      return users;
    },
    'Failed to fetch users'
  );
}

/**
 * Get user by ID
 */
export async function getUserByIdAction(id: string): Promise<ActionResult<User>> {
  return withActionHandler(
    async () => {
      const user = await userService.getUserById(id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    },
    'Failed to fetch user'
  );
}

/**
 * Create a new user
 */
export async function createUserAction(
  input: {
    name: string;
    email: string;
    password?: string;
    role: 'admin' | 'director' | 'manager' | 'senior_accountant' | 'ny_accountant' | 'ca_accountant';
    status: 'Active' | 'Inactive' | 'Invited';
    assignedStates?: string;
  },
  performedByUserId?: string
): Promise<ActionResult<User>> {
  return withActionHandler(
    async () => {
      const user = await userService.createUser(input);

      // Audit log user creation
      await auditService.logUserCreated(
        performedByUserId || 'system',
        user.id,
        {
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
        }
      );

      revalidatePath('/users');
      return user;
    },
    'Failed to create user'
  );
}

/**
 * Update user
 */
export async function updateUserAction(
  id: string,
  input: {
    name?: string;
    email?: string;
    role?: 'admin' | 'director' | 'manager' | 'senior_accountant' | 'ny_accountant' | 'ca_accountant';
    status?: 'Active' | 'Inactive' | 'Invited';
    assignedStates?: string;
  },
  performedByUserId?: string
): Promise<ActionResult<User>> {
  return withActionHandler(
    async () => {
      // Get current user for comparison
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        throw new Error('User not found');
      }

      const user = await userService.updateUser(id, input);

      // Track changes for audit log
      const changedFields: string[] = [];
      const previousValue: Record<string, any> = {};
      const newValue: Record<string, any> = {};

      if (input.name && input.name !== existingUser.name) {
        changedFields.push('name');
        previousValue.name = existingUser.name;
        newValue.name = input.name;
      }
      if (input.email && input.email !== existingUser.email) {
        changedFields.push('email');
        previousValue.email = existingUser.email;
        newValue.email = input.email;
      }
      if (input.status && input.status !== existingUser.status) {
        changedFields.push('status');
        previousValue.status = existingUser.status;
        newValue.status = input.status;

        // Log status change specifically
        await auditService.log({
          userId: performedByUserId || 'system',
          action: AuditAction.USER_STATUS_CHANGED,
          resource: AuditResource.USER,
          resourceId: id,
          category: AuditCategory.USER_MANAGEMENT,
          severity: AuditSeverity.INFO,
          details: {
            description: `User status changed for ${user.name}: ${existingUser.status} -> ${input.status}`,
            userName: user.name,
            previousStatus: existingUser.status,
            newStatus: input.status,
          },
        });
      }
      if (input.role && input.role !== existingUser.role) {
        changedFields.push('role');
        previousValue.role = existingUser.role;
        newValue.role = input.role;

        // Log role change specifically (more significant)
        await auditService.logUserRoleChanged(
          performedByUserId || 'system',
          id,
          {
            userName: user.name,
            previousRole: existingUser.role,
            newRole: input.role,
          }
        );
      }
      if (input.assignedStates !== undefined && input.assignedStates !== existingUser.assignedStates) {
        changedFields.push('assignedStates');
        previousValue.assignedStates = existingUser.assignedStates;
        newValue.assignedStates = input.assignedStates;

        // Log state assignment change
        await auditService.log({
          userId: performedByUserId || 'system',
          action: AuditAction.USER_STATES_ASSIGNED,
          resource: AuditResource.USER,
          resourceId: id,
          category: AuditCategory.USER_MANAGEMENT,
          severity: AuditSeverity.INFO,
          details: {
            description: `States assigned for ${user.name}`,
            userName: user.name,
            previousStates: existingUser.assignedStates,
            newStates: input.assignedStates,
          },
        });
      }

      // Log general update if there were changes
      if (changedFields.length > 0) {
        await auditService.logUserUpdated(
          performedByUserId || 'system',
          id,
          {
            userName: user.name,
            changedFields,
            previousValue,
            newValue,
          }
        );
      }

      revalidatePath('/users');
      revalidatePath(`/users/${id}`);
      return user;
    },
    'Failed to update user'
  );
}

/**
 * Delete user
 */
export async function deleteUserAction(
  id: string,
  performedByUserId?: string
): Promise<ActionResult<void>> {
  return withActionHandler(
    async () => {
      // Get user info before deleting for audit log
      const user = await userService.getUserById(id);

      await userService.deleteUser(id);

      // Audit log user deletion
      if (user) {
        await auditService.logUserDeleted(
          performedByUserId || 'system',
          id,
          {
            userName: user.name,
            userEmail: user.email,
          }
        );
      }

      revalidatePath('/users');
    },
    'Failed to delete user'
  );
}

/**
 * Get users by role
 */
export async function getUsersByRoleAction(role: string): Promise<ActionResult<User[]>> {
  return withActionHandler(
    async () => {
      const users = await userService.getUsersByRole(role);
      return users;
    },
    'Failed to fetch users by role'
  );
}
