import bcrypt from 'bcryptjs';
import db from '../db';
import type { User, Role, AccountStatus } from '../types';
import { normalizeEmail, isValidName, isValidRole, VALID_ROLES, VALID_STATUSES } from './utils';

export interface UserWithPassword extends User {
  password_hash: string;
}

/**
 * Database row type for user queries (after SQL alias mapping)
 */
interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus; // Note: SQL uses 'account_status as accountStatus'
  avatarUrl: string | null; // Note: SQL uses 'avatar_url as avatarUrl'
  password_hash?: string; // Only present when selecting password_hash
}

/**
 * Base SELECT columns for user queries
 */
const USER_SELECT_COLUMNS = `
  id, 
  name, 
  email, 
  role, 
  account_status as accountStatus, 
  avatar_url as avatarUrl
`;

/**
 * Map database row to User object
 */
function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    accountStatus: row.accountStatus,
    avatarUrl: row.avatarUrl || undefined,
  };
}

/**
 * Map database row to UserWithPassword object
 */
function mapRowToUserWithPassword(row: UserRow & { password_hash: string }): UserWithPassword {
  return {
    ...mapRowToUser(row),
    password_hash: row.password_hash,
  };
}

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns true if password matches hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Generate a unique user ID
 */
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Validate user input data
 */
function validateUserInput(
  name: string,
  email: string,
  role?: Role,
  accountStatus?: AccountStatus
): void {
  if (!isValidName(name)) {
    throw new Error('Name must be at least 2 characters long');
  }

  if (!email || !email.trim()) {
    throw new Error('Email is required');
  }

  if (role && !isValidRole(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  if (accountStatus && !VALID_STATUSES.includes(accountStatus)) {
    throw new Error(`Invalid account status: ${accountStatus}`);
  }
}

/**
 * Get user by ID
 * @param id - User ID
 * @returns User object or null if not found
 */
export function getUserById(id: string): User | null {
  if (!id || typeof id !== 'string') {
    return null;
  }

  try {
    const stmt = db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ?`);
    const row = stmt.get(id) as UserRow | undefined;

    if (!row) return null;

    return mapRowToUser(row);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Get user by email
 * @param email - User email address
 * @returns User object or null if not found
 */
export function getUserByEmail(email: string): User | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    const stmt = db.prepare(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE email = ?`);
    const row = stmt.get(normalizedEmail) as UserRow | undefined;

    if (!row) return null;

    return mapRowToUser(row);
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Get user with password hash (for authentication)
 * @param email - User email address
 * @returns UserWithPassword object or null if not found
 */
export function getUserWithPasswordByEmail(email: string): UserWithPassword | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    const stmt = db.prepare(`
      SELECT ${USER_SELECT_COLUMNS}, password_hash 
      FROM users 
      WHERE email = ?
    `);
    const row = stmt.get(normalizedEmail) as (UserRow & { password_hash: string }) | undefined;

    if (!row || !row.password_hash) return null;

    return mapRowToUserWithPassword(row);
  } catch (error) {
    console.error('Error getting user with password by email:', error);
    return null;
  }
}

/**
 * Get user with password hash by ID (for password updates)
 * @param id - User ID
 * @returns UserWithPassword object or null if not found
 */
export function getUserWithPasswordById(id: string): UserWithPassword | null {
  if (!id || typeof id !== 'string') {
    return null;
  }

  try {
    const stmt = db.prepare(`
      SELECT ${USER_SELECT_COLUMNS}, password_hash 
      FROM users 
      WHERE id = ?
    `);
    const row = stmt.get(id) as (UserRow & { password_hash: string }) | undefined;

    if (!row || !row.password_hash) return null;

    return mapRowToUserWithPassword(row);
  } catch (error) {
    console.error('Error getting user with password by ID:', error);
    return null;
  }
}

/**
 * Authenticate user with email and password
 * @param email - User email address
 * @param password - Plain text password
 * @returns User object or null if authentication fails
 */
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  if (!email || !password) {
    return null;
  }

  try {
    const user = getUserWithPasswordByEmail(email);
    if (!user) return null;

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) return null;

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

/**
 * Create a new user
 * @param name - User's full name
 * @param email - User's email address
 * @param password - Plain text password
 * @param role - User role (default: 'transcriptionist')
 * @param accountStatus - Account status (default: 'pending')
 * @returns Created User object
 * @throws Error if validation fails or user creation fails
 */
export async function createUser(
  name: string,
  email: string,
  password: string,
  role: Role = 'transcriptionist',
  accountStatus: AccountStatus = 'pending'
): Promise<User> {
  // Validate input
  validateUserInput(name, email, role, accountStatus);

  // Check if user already exists
  const normalizedEmail = normalizeEmail(email);
  const existingUser = getUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  try {
    const passwordHash = await hashPassword(password);
    const id = generateUserId();

    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, account_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, normalizedEmail, passwordHash, role, accountStatus);

    const createdUser = getUserById(id);
    if (!createdUser) {
      throw new Error('Failed to retrieve created user');
    }

    return createdUser;
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create user');
  }
}

/**
 * Update user account status
 * @param userId - User ID
 * @param status - New account status
 * @throws Error if user not found or update fails
 */
export function updateUserStatus(userId: string, status: AccountStatus): void {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required');
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid account status: ${status}`);
  }

  try {
    // Verify user exists
    const user = getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const stmt = db.prepare(`
      UPDATE users 
      SET account_status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(status, userId);
    
    if (result.changes === 0) {
      throw new Error('Failed to update user status');
    }
  } catch (error) {
    console.error('Error updating user status:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update user status');
  }
}

/**
 * Get all users
 * @param includeSystem - Whether to include the system user (default: false)
 * @returns Array of all users (excluding system user by default)
 */
export function getAllUsers(includeSystem: boolean = false): User[] {
  try {
    const stmt = db.prepare(`
      SELECT ${USER_SELECT_COLUMNS} 
      FROM users 
      ${includeSystem ? '' : 'WHERE id != ?'}
      ORDER BY created_at DESC
    `);
    const rows = includeSystem 
      ? (stmt.all() as UserRow[])
      : (stmt.all('system') as UserRow[]);

    return rows.map(mapRowToUser);
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

/**
 * Check if email is pending approval
 * @param email - Email address to check
 * @returns true if email corresponds to a pending user
 */
export function isEmailPending(email: string): boolean {
  if (!email) return false;
  
  const user = getUserByEmail(email);
  return user?.accountStatus === 'pending';
}

/**
 * Update user information
 * @param userId - User ID
 * @param updates - Object containing fields to update
 * @throws Error if validation fails or update fails
 */
export function updateUser(
  userId: string,
  updates: { name?: string; email?: string; role?: Role; accountStatus?: AccountStatus }
): void {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required');
  }

  // Verify user exists
  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Validate updates
  if (updates.name !== undefined) {
    if (!isValidName(updates.name)) {
      throw new Error('Name must be at least 2 characters long');
    }
  }

  if (updates.email !== undefined) {
    if (!updates.email || !updates.email.trim()) {
      throw new Error('Email is required');
    }
  }

  if (updates.role !== undefined && !isValidRole(updates.role)) {
    throw new Error(`Invalid role: ${updates.role}`);
  }

  if (updates.accountStatus !== undefined && !VALID_STATUSES.includes(updates.accountStatus)) {
    throw new Error(`Invalid account status: ${updates.accountStatus}`);
  }

  // Check email uniqueness if email is being updated
  if (updates.email) {
    const normalizedEmail = normalizeEmail(updates.email);
    const existingUser = getUserByEmail(normalizedEmail);
    if (existingUser && existingUser.id !== userId) {
      throw new Error('Email is already in use by another user');
    }
  }

  // Build update query
  const updatesList: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    updatesList.push('name = ?');
    values.push(updates.name.trim());
  }

  if (updates.email !== undefined) {
    updatesList.push('email = ?');
    values.push(normalizeEmail(updates.email));
  }

  if (updates.role !== undefined) {
    updatesList.push('role = ?');
    values.push(updates.role);
  }

  if (updates.accountStatus !== undefined) {
    updatesList.push('account_status = ?');
    values.push(updates.accountStatus);
  }

  if (updatesList.length === 0) {
    return; // No updates to make
  }

  updatesList.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);

  try {
    const stmt = db.prepare(`
      UPDATE users 
      SET ${updatesList.join(', ')} 
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    
    if (result.changes === 0) {
      throw new Error('Failed to update user');
    }
  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update user');
  }
}

/**
 * Update user password
 * @param userId - User ID
 * @param currentPassword - Current password for verification
 * @param newPassword - New password
 * @throws Error if validation fails or update fails
 */
export async function updatePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required');
  }

  if (!currentPassword || !newPassword) {
    throw new Error('Current password and new password are required');
  }

  // Verify user exists and get password hash
  const user = getUserWithPasswordById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Validate new password
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long');
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password in database
  try {
    const stmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(newPasswordHash, userId);
    
    if (result.changes === 0) {
      throw new Error('Failed to update password');
    }
  } catch (error) {
    console.error('Error updating password:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update password');
  }
}

/**
 * Delete a user
 * @param userId - User ID to delete
 * @throws Error if user not found or deletion fails
 */
export function deleteUser(userId: string): void {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required');
  }

  try {
    // Verify user exists
    const user = getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(userId);

    if (result.changes === 0) {
      throw new Error('Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to delete user');
  }
}
