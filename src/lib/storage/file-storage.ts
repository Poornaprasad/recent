/**
 * File storage service
 * Handles saving and reading invoice files from disk
 */

import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import { STORAGE_CONFIG } from '../config/storage';

const UPLOADS_DIR = path.join(process.cwd(), STORAGE_CONFIG.uploadsDir.replace('./', ''));
const DATA_DIR = path.join(process.cwd(), STORAGE_CONFIG.dataDir.replace('./', ''));

async function ensureDirectoriesExist(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
}

function dataUriToBuffer(dataUri: string): { buffer: Buffer; mimeType: string; extension: string } {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URI format');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  let extension = '.png';
  if (mimeType.includes('pdf')) {
    extension = '.pdf';
  } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    extension = '.jpg';
  } else if (mimeType.includes('png')) {
    extension = '.png';
  } else if (mimeType.includes('heic')) {
    extension = '.heic';
  }

  return { buffer, mimeType, extension };
}

function sanitizeFilename(str: string): string {
  return str
    .replace(/[\/\\<>:"|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function saveInvoiceFile(
  dataUri: string,
  invoiceId: string
): Promise<string> {
  await ensureDirectoriesExist();

  const { buffer, extension } = dataUriToBuffer(dataUri);
  
  const sanitizedId = sanitizeFilename(invoiceId);
  
  const timestamp = Date.now();
  const filename = `${sanitizedId}-${timestamp}${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.writeFile(filePath, buffer);

  return `/uploads/${filename}`;
}

export async function readInvoiceFile(filePath: string): Promise<string> {
  const fullPath = path.join(process.cwd(), 'data', filePath);
  
  try {
    const buffer = await fs.readFile(fullPath);
    const mimeType = getMimeTypeFromPath(filePath);
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new Error(`Failed to read file: ${fullPath}`);
  }
}

function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.heic': 'image/heic',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function deleteInvoiceFile(filePath: string): Promise<void> {
  const fullPath = path.join(process.cwd(), 'data', filePath);
  try {
    await fs.unlink(fullPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error;
    }
  }
}





