/**
 * User Actions
 * Server actions for user management
 */

'use server';

import { revalidatePath } from 'next/cache';
import * as userService from '../services/user.service';
import type { User } from '../db/schema';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

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
export async function createUserAction(input: {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'director' | 'manager' | 'senior_accountant' | 'ny_accountant' | 'ca_accountant';
  status: 'Active' | 'Inactive' | 'Invited';
  assignedStates?: string;
}): Promise<ActionResult<User>> {
  return withActionHandler(
    async () => {
      const user = await userService.createUser(input);
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
  }
): Promise<ActionResult<User>> {
  return withActionHandler(
    async () => {
      const user = await userService.updateUser(id, input);
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
export async function deleteUserAction(id: string): Promise<ActionResult<void>> {
  return withActionHandler(
    async () => {
      await userService.deleteUser(id);
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
