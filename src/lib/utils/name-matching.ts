/**
 * Name and Email Matching Utilities
 *
 * Provides fuzzy matching for names with different formats:
 * - "John Smith" vs "Smith, John"
 * - "John Michael Smith" vs "Smith, John Michael"
 * - Case insensitive comparison
 * - Email matching support
 */

/**
 * Email regex pattern for validation
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks if a string is a valid email address
 */
export function isEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Normalizes a string for comparison
 * - Converts to lowercase
 * - Trims whitespace
 * - Normalizes multiple spaces to single space
 * - Removes common punctuation
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,'"]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Extracts name parts from a string
 * Handles formats like:
 * - "John Smith"
 * - "Smith, John"
 * - "John Michael Smith"
 * - "Smith, John Michael"
 */
function extractNameParts(name: string): string[] {
  const normalized = normalizeString(name);

  // Handle "Last, First" format
  if (normalized.includes(',')) {
    const [lastName, ...rest] = normalized.split(',');
    const firstParts = rest.join(' ').trim().split(' ').filter(Boolean);
    return [...firstParts, lastName.trim()].filter(Boolean);
  }

  // Handle "First Last" format
  return normalized.split(' ').filter(Boolean);
}

/**
 * Generates all permutations of an array
 */
function getPermutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];

  const result: T[][] = [];

  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = getPermutations(remaining);

    for (const perm of perms) {
      result.push([current, ...perm]);
    }
  }

  return result;
}

/**
 * Generates name variations for matching
 * Given parts ["john", "michael", "smith"], generates:
 * - "john michael smith"
 * - "smith john michael"
 * - All other permutations
 */
function generateNameVariations(parts: string[]): Set<string> {
  const variations = new Set<string>();

  // Limit permutations for performance (max 4 parts = 24 permutations)
  if (parts.length > 4) {
    // For very long names, just use original and reversed
    variations.add(parts.join(' '));
    variations.add([...parts].reverse().join(' '));
    return variations;
  }

  const permutations = getPermutations(parts);

  for (const perm of permutations) {
    variations.add(perm.join(' '));
  }

  return variations;
}

/**
 * Compares two names with fuzzy matching
 * Handles different name formats and orderings
 *
 * @param name1 - First name to compare
 * @param name2 - Second name to compare
 * @returns true if names match (considering permutations)
 *
 * @example
 * compareNames("John Smith", "Smith, John") // true
 * compareNames("Likhith Kumar", "Kumar, Likhith") // true
 * compareNames("John Michael Smith", "Smith, John Michael") // true
 */
export function compareNames(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const parts1 = extractNameParts(name1);
  const parts2 = extractNameParts(name2);

  // Quick check: if different number of parts, names don't match
  if (parts1.length !== parts2.length) return false;

  // Quick exact match after normalization
  const normalized1 = parts1.sort().join(' ');
  const normalized2 = parts2.sort().join(' ');

  if (normalized1 === normalized2) return true;

  // Generate variations and check for intersection
  const variations1 = generateNameVariations(parts1);
  const variations2 = generateNameVariations(parts2);

  for (const v1 of variations1) {
    if (variations2.has(v1)) return true;
  }

  return false;
}

/**
 * Compares two emails (case insensitive)
 */
export function compareEmails(email1: string, email2: string): boolean {
  if (!email1 || !email2) return false;
  return normalizeString(email1) === normalizeString(email2);
}

/**
 * Converts name from "Last, First" format to "First Last" format
 * Handles formats like:
 * - "Smith, John" -> "John Smith"
 * - "Smith, John Michael" -> "John Michael Smith"
 * - "John Smith" -> "John Smith" (already in correct format)
 *
 * @param name - Name in "Last, First" or "First Last" format
 * @returns Name in "First Last" format
 */
export function formatNameFirstLast(name: string): string {
  if (!name || !name.trim()) return name;
  
  const trimmed = name.trim();
  
  // Check if it's in "Last, First" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length >= 2) {
      const lastName = parts[0];
      const firstParts = parts.slice(1).join(' ').trim();
      return `${firstParts} ${lastName}`.trim();
    }
  }
  
  // Already in "First Last" format or doesn't have comma
  return trimmed;
}

/**
 * Match result with detailed information
 */
export interface MatchResult {
  isMatch: boolean;
  matchType: 'name' | 'email' | 'none';
  confidence: 'exact' | 'permutation' | 'none';
}

/**
 * Compares a document value (name or email) against case data
 * Automatically detects if the value is an email and uses appropriate matching
 *
 * @param documentValue - Value extracted from document (could be name or email)
 * @param caseName - Plaintiff name from case lookup
 * @param caseEmail - Optional email from case lookup
 * @returns MatchResult with match status and type
 */
export function matchPlaintiffData(
  documentValue: string,
  caseName: string,
  caseEmail?: string
): MatchResult {
  if (!documentValue) {
    return { isMatch: false, matchType: 'none', confidence: 'none' };
  }

  // Check if document value is an email
  if (isEmail(documentValue)) {
    if (caseEmail && compareEmails(documentValue, caseEmail)) {
      return { isMatch: true, matchType: 'email', confidence: 'exact' };
    }
    return { isMatch: false, matchType: 'email', confidence: 'none' };
  }

  // Document value is a name - compare with case name
  if (!caseName) {
    return { isMatch: false, matchType: 'name', confidence: 'none' };
  }

  // Check exact match first (after normalization)
  const normalizedDoc = normalizeString(documentValue);
  const normalizedCase = normalizeString(caseName);

  if (normalizedDoc === normalizedCase) {
    return { isMatch: true, matchType: 'name', confidence: 'exact' };
  }

  // Check permutation match
  if (compareNames(documentValue, caseName)) {
    return { isMatch: true, matchType: 'name', confidence: 'permutation' };
  }

  return { isMatch: false, matchType: 'name', confidence: 'none' };
}
