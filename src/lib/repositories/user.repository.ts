/**
 * User Repository
 * Data access layer for user management
 */

import 'server-only';

import { getDb } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { User, NewUser } from '../db/schema';
import { randomUUID } from 'crypto';

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
  const db = getDb();
  return await db.select().from(users);
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] || null;
}

/**
 * Create a new user
 */
export async function createUser(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const db = getDb();
  const newUser: NewUser = {
    id: randomUUID(),
    ...data,
  };

  const result = await db.insert(users).values(newUser).returning();
  return result[0];
}

/**
 * Update user
 */
export async function updateUser(id: string, data: Partial<Omit<NewUser, 'id' | 'createdAt'>>): Promise<User> {
  const db = getDb();
  const result = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!result[0]) {
    throw new Error('User not found');
  }

  return result[0];
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<void> {
  const db = getDb();
  await db.delete(users).where(eq(users.id, id));
}

/**
 * Count users by role
 */
export async function countUsersByRole(role: string): Promise<number> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.role, role));
  return result.length;
}
