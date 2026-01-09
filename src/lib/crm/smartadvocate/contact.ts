/**
 * SmartAdvocate CRM Contact API Operations
 * Handles contact types retrieval and contact lookup via SmartAdvocate API
 */

import 'server-only';
import { getConfig, getHeaders, hasCredentials } from './utils';
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';
import type { DisbursementOption, ContactLookupResult, ContactLookupParams } from './types';

/**
 * Get contact types from SmartAdvocate API
 * Uses endpoint: /contact/ContactTypes?ContactCtg=2
 * Returns array of objects with id and description
 */
export async function getContactTypes(contactCtg: number = 2): Promise<DisbursementOption[]> {
  if (!hasCredentials()) {
    console.warn('[SmartAdvocate] API credentials not configured');
    throw new Error('SmartAdvocate API credentials not configured');
  }

  const config = getConfig();

  // Normalize base URL - handle both with and without trailing slash
  let baseUrl = config.SA_API_BASE_URL.trim();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Build API URL
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? `/contact/ContactTypes?ContactCtg=${contactCtg}`
    : `/CaseSyncAPI/contact/ContactTypes?ContactCtg=${contactCtg}`;

  const url = `${baseUrl}${apiPath}`;
  const headers = await getHeaders();

  const response = await retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        next: { revalidate: 3600 }, // Cache for 1 hour
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

  // Parse response
  let data: DisbursementOption[] | unknown;
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error('[SmartAdvocate] Empty response from contact types API');
      throw new Error('Empty response from SmartAdvocate API');
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse contact types API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  // Handle response format: array of { id, description } or { contactTypeId, name } etc.
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      id: item.id ?? item.contactTypeId ?? item.typeId ?? 0,
      description: item.description || item.name || item.contactType || item.type || String(item),
    }));
  }

  return [];
}

/**
 * Lookup contacts from SmartAdvocate API
 * Uses endpoint: /Search/contactLookup
 * 
 * @param params Contact lookup parameters (name, firstName, lastName, firstPage, rowLimit)
 * @returns Array of contact lookup results
 */
export async function lookupContacts(params: ContactLookupParams): Promise<ContactLookupResult[]> {
  if (!hasCredentials()) {
    console.warn('[SmartAdvocate] API credentials not configured');
    throw new Error('SmartAdvocate API credentials not configured');
  }

  const config = getConfig();

  // Normalize base URL - handle both with and without trailing slash
  let baseUrl = config.SA_API_BASE_URL.trim();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Build API URL
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? '/Search/contactLookup'
    : '/CaseSyncAPI/Search/contactLookup';

  const url = new URL(`${baseUrl}${apiPath}`);
  
  // Add query parameters
  if (params.name) {
    url.searchParams.append('Name', params.name);
  }
  if (params.firstName) {
    url.searchParams.append('FirstName', params.firstName);
  }
  if (params.lastName) {
    url.searchParams.append('LastName', params.lastName);
  }
  url.searchParams.append('FirstPage', String(params.firstPage || 1));
  url.searchParams.append('RowLimit', String(params.rowLimit || 10));

  const headers = await getHeaders();

  const response = await retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
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

  // Parse response
  let data: ContactLookupResult[] | unknown;
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error('[SmartAdvocate] Empty response from contact lookup API');
      return [];
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse contact lookup API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  // Handle response format: array of contacts
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      contactId: item.contactId ?? item.contactID ?? item.uniqueContactId ?? item.id ?? 0,
      name: item.name || (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}`.trim() : undefined),
      firstName: item.firstName,
      lastName: item.lastName,
      contactType: item.contactType || item.contactTypeId,
      email: item.email || item.emailAddress,
      phone: item.phone || item.phoneNumber || item.contactNumber,
      address: item.address || item.address1 || (item.address1 && item.city && item.state 
        ? `${item.address1}, ${item.city}, ${item.state} ${item.zip || ''}`.trim() 
        : undefined),
      // Include address components separately for better matching
      address1: item.address1,
      city: item.city,
      state: item.state,
      zip: item.zip,
      ...item, // Include any additional fields
    }));
  }

  return [];
}

/**
 * Get contacts for a specific case from SmartAdvocate API
 * Uses endpoint: /case/{caseId}/contacts
 * 
 * @param caseId The case ID to fetch contacts for
 * @returns Array of contact lookup results
 */
export async function getCaseContacts(caseId: number): Promise<ContactLookupResult[]> {
  if (!hasCredentials()) {
    console.warn('[SmartAdvocate] API credentials not configured');
    throw new Error('SmartAdvocate API credentials not configured');
  }

  const config = getConfig();

  // Normalize base URL - handle both with and without trailing slash
  let baseUrl = config.SA_API_BASE_URL.trim();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Build API URL
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? `/case/${caseId}/contacts`
    : `/CaseSyncAPI/case/${caseId}/contacts`;

  const url = `${baseUrl}${apiPath}`;
  const headers = await getHeaders();

  const response = await retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
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

  // Parse response
  let data: ContactLookupResult[] | unknown;
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error('[SmartAdvocate] Empty response from case contacts API');
      return [];
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse case contacts API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  // Handle response format: array of contacts
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      contactId: item.contactId ?? item.contactID ?? item.uniqueContactId ?? item.id ?? 0,
      name: item.name || (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}`.trim() : undefined),
      firstName: item.firstName,
      lastName: item.lastName,
      contactType: item.contactType || item.contactTypeId,
      email: item.email || item.emailAddress,
      phone: item.phone || item.phoneNumber || item.contactNumber,
      address: item.address || item.address1 || (item.address1 && item.city && item.state 
        ? `${item.address1}, ${item.city}, ${item.state} ${item.zip || ''}`.trim() 
        : undefined),
      // Include address components separately for better matching
      address1: item.address1,
      city: item.city,
      state: item.state,
      zip: item.zip,
      ...item, // Include any additional fields
    }));
  }

  return [];
}

