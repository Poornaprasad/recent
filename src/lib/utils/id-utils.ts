/**
 * ID utility functions
 * Sanitize IDs for safe use in URLs and file paths
 */

/**
 * Sanitizes an ID to be safe for URLs and file paths
 * Replaces problematic characters with safe alternatives
 */
export function sanitizeId(id: string): string {
  return id
    .replace(/[\/\\<>:"|?*\s]/g, '-')  // Replace slashes, spaces, and other problematic chars with dashes
    .replace(/-{2,}/g, '-')            // Replace multiple dashes with single dash
    .replace(/^-+|-+$/g, '');          // Remove leading/trailing dashes
}

/**
 * Encodes an ID for use in URLs
 * Handles IDs that may contain special characters
 */
export function encodeId(id: string): string {
  return encodeURIComponent(id);
}

/**
 * Decodes an ID from URLs
 */
export function decodeId(encodedId: string): string {
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId; // Return as-is if decoding fails
  }
}





