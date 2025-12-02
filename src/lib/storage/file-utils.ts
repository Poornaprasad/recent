/**
 * File utility functions
 * Helper functions for file operations
 */

import 'server-only';

import { readInvoiceFile } from './file-storage';

export async function getInvoiceDataUri(uri: string): Promise<string> {
  // Check if it's a local file path (e.g., /uploads/invoice-123.png)
  if (uri.startsWith('/uploads/')) {
    try {
      return await readInvoiceFile(uri);
    } catch (error) {
      console.error('Error reading local file:', error);
      // Fallback to original URI if file read fails
      return uri;
    }
  }
  // If it's already a data URI or external URL, return as is
  return uri;
}





