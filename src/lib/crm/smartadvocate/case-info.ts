/**
 * SmartAdvocate CRM Case Info API Operations
 * Handles case info retrieval via SmartAdvocate API
 */

import 'server-only';
import { getConfig, getHeaders, hasCredentials } from './utils';
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';
import type { SmartAdvocateCase, GetCaseInfoParams, PlaintiffInfo } from './types';

/**
 * Get case info from SmartAdvocate API
 *
 * @param params Case info parameters (caseNumber, addContactInfo)
 * @returns Case info object or null if not found/error
 */
export async function getCaseInfo(params: GetCaseInfoParams): Promise<SmartAdvocateCase | null> {
  if (!hasCredentials()) {
    console.warn('[SmartAdvocate] API credentials not configured');
    throw new Error('SmartAdvocate API credentials not configured');
  }

  const { caseNumber, addContactInfo = true } = params;

  if (!caseNumber || caseNumber.trim() === '') {
    throw new Error('Case number is required');
  }

  const config = getConfig();

  // Normalize base URL - handle both with and without trailing slash
  let baseUrl = config.SA_API_BASE_URL.trim();

  // Remove trailing slash if present
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Build API URL following the Python example structure
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? '/case/CaseInfo'
    : '/CaseSyncAPI/case/CaseInfo';

  const url = new URL(`${baseUrl}${apiPath}`);
  url.searchParams.append('Casenumber', caseNumber.trim());
  url.searchParams.append('AddContactInfo', addContactInfo.toString());

  const headers = await getHeaders();

  const response = await retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        throw createHttpError(res.status, errorText || res.statusText);
      }

      return res;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout after 30000ms');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  // Parse response - API returns an array of cases
  let data: SmartAdvocateCase | SmartAdvocateCase[];
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error('[SmartAdvocate] Empty response from case info API');
      throw new Error('Empty response from SmartAdvocate API');
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse case info API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  // Handle array response - API returns array of cases
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new Error(`Case not found: ${caseNumber}`);
    }
    // Return first case (should typically be only one)
    return data[0];
  }

  // Handle single object response
  if (data && typeof data === 'object') {
    return data as SmartAdvocateCase;
  }

  throw new Error(`Case not found: ${caseNumber}`);
}

/**
 * Extract plaintiff info from case
 * Gets the primary plaintiff's name and email from the plaintiffs array
 */
export function extractPlaintiffInfo(caseInfo: SmartAdvocateCase | null): PlaintiffInfo | null {
  if (!caseInfo) {
    return null;
  }

  const plaintiffs = caseInfo.plaintiffs;
  if (!plaintiffs || !Array.isArray(plaintiffs) || plaintiffs.length === 0) {
    return null;
  }

  // Find the primary plaintiff first
  let plaintiff = plaintiffs.find(p => p.primary === true);

  // If no primary plaintiff, find the primary contact
  if (!plaintiff) {
    plaintiff = plaintiffs.find(p => p.primaryContact === true);
  }

  // If still no match, use the first plaintiff
  if (!plaintiff) {
    plaintiff = plaintiffs[0];
  }

  if (!plaintiff || !plaintiff.name) {
    return null;
  }

  // Extract email from contact if available
  let email: string | undefined;
  let phone: string | undefined;

  if (plaintiff.contact) {
    // Get primary email or first email
    const emails = plaintiff.contact.emails;
    if (emails && Array.isArray(emails) && emails.length > 0) {
      const primaryEmail = emails.find(e => e.primary === true);
      email = primaryEmail?.name || emails[0]?.name;
    }

    // Get primary phone or first phone
    const phones = plaintiff.contact.phones;
    if (phones && Array.isArray(phones) && phones.length > 0) {
      const primaryPhone = phones.find(p => p.primary === true);
      phone = primaryPhone?.phoneNumber || phones[0]?.phoneNumber;
    }
  }

  return {
    name: plaintiff.name,
    email,
    phone,
    isPrimary: plaintiff.primary || false,
  };
}

/**
 * Extract plaintiff name from case info (convenience function)
 * Returns just the name string for backwards compatibility
 */
export function extractPlaintiffName(caseInfo: SmartAdvocateCase | null): string | null {
  const info = extractPlaintiffInfo(caseInfo);
  return info?.name || null;
}
