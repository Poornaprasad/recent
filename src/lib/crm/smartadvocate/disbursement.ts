/**
 * SmartAdvocate CRM Disbursement API Operations
 * Handles disbursement types and statuses retrieval via SmartAdvocate API
 */

import 'server-only';
import { getConfig, getHeaders, hasCredentials } from './utils';
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';
import type { DisbursementOption } from './types';

/**
 * Get disbursement types from SmartAdvocate API
 * Types are common across all cases
 * Returns array of objects with id and description
 */
export async function getDisbursementTypes(): Promise<DisbursementOption[]> {
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

  // Build API URL following the case-info structure
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? '/case/Disbursement/types'
    : '/CaseSyncAPI/case/Disbursement/types';

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
      console.error('[SmartAdvocate] Empty response from disbursement types API');
      throw new Error('Empty response from SmartAdvocate API');
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse disbursement types API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  // Handle response format: array of { id, description }
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      id: item.id ?? 0,
      description: item.description || item.name || item.type || String(item),
    }));
  }

  return [];
}

/**
 * Get disbursement statuses from SmartAdvocate API
 * Statuses are common across all cases
 * Returns array of objects with id and description
 */
export async function getDisbursementStatuses(): Promise<DisbursementOption[]> {
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

  // Build API URL following the case-info structure
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? '/case/Disbursement/statuses'
    : '/CaseSyncAPI/case/Disbursement/statuses';

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
      console.error('[SmartAdvocate] Empty response from disbursement statuses API');
      throw new Error('Empty response from SmartAdvocate API');
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse disbursement statuses API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  // Handle response format: array of { id, description }
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      id: item.id ?? 0,
      description: item.description || item.name || item.status || String(item),
    }));
  }

  return [];
}

/**
 * Get default status based on document type
 * Invoice -> "Issue Check" (id: 1)
 * Receipt -> "Paid" (id: 3)
 */
export function getDefaultStatusForDocumentType(documentType: string | undefined): DisbursementOption | null {
  if (!documentType) return null;

  const type = documentType.toLowerCase();
  if (type === 'invoice') {
    return { id: 1, description: 'Issue Check' };
  }
  if (type === 'receipt') {
    return { id: 3, description: 'Paid' };
  }
  return null;
}

/**
 * Disbursement creation request payload
 */
export interface CreateDisbursementRequest {
  caseID: number;
  checkNumber?: string;
  invoiceNumber?: string;
  checkDate?: string; // ISO date string
  amount: number;
  description?: string;
  client?: Array<{
    id: number; // plaintiff ID
    type: 'plaintiff';
  }>;
  shareAcrossClients?: boolean;
  recoverable?: boolean;
  checkMailedDate?: string; // ISO date string
  waived?: boolean;
  comments?: string;
  isLienor?: boolean;
  disbursementType?: {
    id: number;
    description?: string;
  };
  payee?: {
    contactId: number;
    name: string;
  };
  status?: {
    id: number;
    description?: string;
  };
  invoiceDate?: string; // ISO date string
  dueDate?: string; // ISO date string
  statusDate?: string; // ISO date string
  documentIDs?: number[];
  bankAccount?: {
    id: number;
    description?: string;
  };
  expenseAccount?: {
    id: number;
    description?: string;
  };
  customField1?: string;
}

/**
 * Create a disbursement in SmartAdvocate API
 * 
 * @param caseID The case ID (not case number)
 * @param disbursementData The disbursement data to create
 * @returns The created disbursement response
 */
export async function createDisbursement(
  caseID: number,
  disbursementData: CreateDisbursementRequest
): Promise<any> {
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

  // Build API URL following the case-info structure
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? `/case/${caseID}/Disbursement`
    : `/CaseSyncAPI/case/${caseID}/Disbursement`;

  const url = `${baseUrl}${apiPath}`;
  const headers = await getHeaders();

  // Ensure caseID is included in the payload
  const payload: CreateDisbursementRequest = {
    ...disbursementData,
    caseID,
  };

  const response = await retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
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
  let data: any;
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error('[SmartAdvocate] Empty response from create disbursement API');
      throw new Error('Empty response from SmartAdvocate API');
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse create disbursement API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  return data;
}

