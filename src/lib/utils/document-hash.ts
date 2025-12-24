/**
 * Document hash utilities
 * Generates hash from document ID and case number for duplicate detection
 */

import { createHash } from 'crypto';

/**
 * Generate a hash from document ID and case number
 * This hash is used to detect duplicates when syncing documents from SmartAdvocate
 * 
 * @param documentID The SmartAdvocate document ID
 * @param caseNumber The case number (can be empty string if not available)
 * @returns SHA-256 hash as a hex string
 */
export function generateDocumentHash(documentID: number | string, caseNumber: string | null | undefined): string {
  // Normalize inputs: convert documentID to string, handle null/undefined caseNumber
  const docIdStr = String(documentID);
  const caseNumStr = caseNumber?.trim() || '';
  
  // Create a combined string: "documentID:caseNumber"
  const combined = `${docIdStr}:${caseNumStr}`;
  
  // Generate SHA-256 hash
  const hash = createHash('sha256');
  hash.update(combined);
  
  return hash.digest('hex');
}

