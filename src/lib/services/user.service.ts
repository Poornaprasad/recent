/**
 * User Service
 * Business logic for user management
 */

import 'server-only';

import * as userRepository from '../repositories/user.repository';
import type { User } from '../db/schema';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'director' | 'manager' | 'senior_accountant' | 'ny_accountant' | 'ca_accountant';
  status: 'Active' | 'Inactive' | 'Invited';
  assignedStates?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: 'admin' | 'director' | 'manager' | 'senior_accountant' | 'ny_accountant' | 'ca_accountant';
  status?: 'Active' | 'Inactive' | 'Invited';
  assignedStates?: string;
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
  return await userRepository.getAllUsers();
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  return await userRepository.getUserById(id);
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  // Validate email is unique
  const existingUser = await userRepository.getUserByEmail(input.email);
  if (existingUser) {
    throw new Error('A user with this email already exists');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    throw new Error('Invalid email format');
  }

  // Hash password if provided
  let hashedPassword: string | undefined;
  if (input.password) {
    if (input.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    hashedPassword = await bcrypt.hash(input.password, 10);
  }

  // Create user with hashed password
  return await userRepository.createUser({
    ...input,
    password: hashedPassword,
  });
}

/**
 * Update user
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  // Check if user exists
  const existingUser = await userRepository.getUserById(id);
  if (!existingUser) {
    throw new Error('User not found');
  }

  // If email is being updated, check uniqueness
  if (input.email && input.email !== existingUser.email) {
    const userWithEmail = await userRepository.getUserByEmail(input.email);
    if (userWithEmail && userWithEmail.id !== id) {
      throw new Error('A user with this email already exists');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format');
    }
  }

  return await userRepository.updateUser(id, input);
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<void> {
  // Check if user exists
  const existingUser = await userRepository.getUserById(id);
  if (!existingUser) {
    throw new Error('User not found');
  }

  // Prevent deleting the last admin
  if (existingUser.role === 'admin') {
    const adminCount = await userRepository.countUsersByRole('admin');
    if (adminCount <= 1) {
      throw new Error('Cannot delete the last admin user');
    }
  }

  await userRepository.deleteUser(id);
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: string): Promise<User[]> {
  const allUsers = await userRepository.getAllUsers();
  return allUsers.filter(user => user.role === role);
}

/**
 * Get active users count
 */
export async function getActiveUsersCount(): Promise<number> {
  const allUsers = await userRepository.getAllUsers();
  return allUsers.filter(user => user.status === 'Active').length;
}
