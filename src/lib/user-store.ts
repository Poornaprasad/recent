/**
 * User store (temporary client-side implementation)
 * TODO: Replace with proper server actions following the repository pattern
 */

'use client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'director' | 'manager' | 'account' | 'user';
  status: 'Active' | 'Inactive' | 'Invited';
  assignedStates?: string[];
  createdAt?: string;
  lastLogin?: string;
}

// Mock data for development
let mockUsers: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'John Manager',
    email: 'john@company.com',
    role: 'manager',
    status: 'Active',
    assignedStates: ['CA', 'NY'],
    createdAt: new Date().toISOString(),
  },
];

/**
 * Get all users
 */
export async function getUsers(): Promise<User[]> {
  // TODO: Replace with actual API call to server action
  return Promise.resolve([...mockUsers]);
}

/**
 * Add a new user
 */
export async function addUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  // TODO: Replace with actual API call to server action
  const newUser: User = {
    ...user,
    id: Math.random().toString(36).substring(7),
    createdAt: new Date().toISOString(),
  };
  mockUsers.push(newUser);
  return Promise.resolve(newUser);
}

/**
 * Update an existing user
 */
export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  // TODO: Replace with actual API call to server action
  const index = mockUsers.findIndex(u => u.id === id);
  if (index === -1) {
    throw new Error('User not found');
  }
  mockUsers[index] = { ...mockUsers[index], ...updates };
  return Promise.resolve(mockUsers[index]);
}

/**
 * Delete a user
 */
export async function deleteUser(id: string): Promise<void> {
  // TODO: Replace with actual API call to server action
  mockUsers = mockUsers.filter(u => u.id !== id);
  return Promise.resolve();
}
