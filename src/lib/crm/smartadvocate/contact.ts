/**
 * SmartAdvocate CRM Contact API Operations
 * Handles contact types retrieval via SmartAdvocate API
 */

import 'server-only';
import { getConfig, getHeaders, hasCredentials } from './utils';
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';
import type { DisbursementOption } from './types';

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

