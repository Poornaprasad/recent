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
      // Log the error for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Could not read local file ${uri}. ${errorMessage}`);
      console.warn('This may be a legacy invoice with a data URI stored in the database, or the file was deleted.');
      // Fallback to original URI if file read fails
      // If the original URI is also a file path, it will be returned as-is
      // The caller should handle this case appropriately
      return uri;
    }
  }
  // If it's already a data URI or external URL, return as is
  return uri;
}





