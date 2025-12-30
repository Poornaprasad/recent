/**
 * Utility functions for ExtractedDataPanel
 */

/**
 * Convert field names to title case with proper spacing
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
}

/**
 * Get default disbursement status ID based on document type
 */
export function getDefaultStatusId(docType: string | undefined): string {
  if (!docType) return '';
  const type = docType.toLowerCase();
  if (type === 'invoice') return '1'; // Issue Check
  if (type === 'receipt') return '3'; // Paid
  return '';
}

/**
 * Validate bounding box structure
 */
export function isValidBbox(bbox: any): boolean {
  if (!bbox || !Array.isArray(bbox) || bbox.length < 4) {
    return false;
  }
  return bbox.every((p: any) =>
    typeof p === 'object' &&
    p !== null &&
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    !isNaN(p.x) &&
    !isNaN(p.y)
  );
}
