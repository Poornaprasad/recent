/**
 * Persistence layer for storing entities as JSON files
 * This file is server-only and should never be imported in client components
 */

import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Ensures the data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Gets the file path for a store
 */
function getStorePath(storeName: string): string {
  return path.join(DATA_DIR, `${storeName}.json`);
}

/**
 * Loads data from a JSON file
 */
export async function loadStore<T>(storeName: string, defaultValue: T[] = []): Promise<T[]> {
  await ensureDataDir();
  const filePath = getStorePath(storeName);

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T[];
  } catch (error) {
    // File doesn't exist yet, return default value
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      // Save the default value for future loads
      await saveStore(storeName, defaultValue);
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Saves data to a JSON file
 */
export async function saveStore<T>(storeName: string, data: T[]): Promise<void> {
  await ensureDataDir();
  const filePath = getStorePath(storeName);
  
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Appends data to a store (loads, adds, saves)
 */
export async function appendToStore<T>(storeName: string, item: T, defaultValue: T[] = []): Promise<void> {
  const data = await loadStore(storeName, defaultValue);
  data.push(item);
  await saveStore(storeName, data);
}

/**
 * Updates an item in a store
 */
export async function updateInStore<T extends { id: string }>(
  storeName: string,
  id: string,
  updates: Partial<T>,
  defaultValue: T[] = []
): Promise<T | undefined> {
  const data = await loadStore(storeName, defaultValue);
  const index = data.findIndex(item => item.id === id);
  
  if (index === -1) {
    return undefined;
  }
  
  data[index] = { ...data[index], ...updates } as T;
  await saveStore(storeName, data);
  return data[index];
}

/**
 * Deletes an item from a store
 */
export async function deleteFromStore<T extends { id: string }>(
  storeName: string,
  id: string,
  defaultValue: T[] = []
): Promise<boolean> {
  const data = await loadStore(storeName, defaultValue);
  const initialLength = data.length;
  const filtered = data.filter(item => item.id !== id);
  
  if (filtered.length < initialLength) {
    await saveStore(storeName, filtered);
    return true;
  }
  
  return false;
}

