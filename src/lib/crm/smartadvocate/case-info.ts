/**
 * SmartAdvocate CRM Case Info API Operations
 * Handles case info retrieval via SmartAdvocate API
 */

import 'server-only';
import { getConfig, getHeaders, hasCredentials, handleApiResponse } from './utils';
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';
import type { CaseInfo, GetCaseInfoParams } from './types';

/**
 * Get case info from SmartAdvocate API
 * 
 * @param params Case info parameters (caseNumber, addContactInfo)
 * @returns Case info object or null if not found/error
 */
export async function getCaseInfo(params: GetCaseInfoParams): Promise<CaseInfo | null> {
  if (!hasCredentials()) {
    console.warn('[SmartAdvocate] API credentials not configured');
    return null;
  }

  const { caseNumber, addContactInfo = true } = params;

  if (!caseNumber || caseNumber.trim() === '') {
    return null;
  }

  const config = getConfig();

  try {
    // Normalize base URL - handle both with and without trailing slash
    // Original format might be: https://tbf.smartadvocate.com/CaseSyncAPI/
    let baseUrl = config.SA_API_BASE_URL.trim();
    
    // Remove trailing slash if present
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    // Build API URL following the Python example structure
    // If baseUrl already includes /CaseSyncAPI, this will work correctly
    // If not, we append /case/CaseInfo directly
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
          throw createHttpError(res.status, res.statusText);
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

    // Parse response - read text only once
    let data: CaseInfo;
    try {
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.error('[SmartAdvocate] Empty response from case info API');
        return null;
      }
      
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[SmartAdvocate] Failed to parse case info API response:', parseError);
      return null;
    }

    // Handle different possible response formats
    if (data && typeof data === 'object') {
      return data as CaseInfo;
    }

    return null;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[SmartAdvocate] Error fetching case info:', err.message || error);
    return null;
  }
}

/**
 * Extract plaintiff name from case info
 * Checks multiple possible fields: PlaintiffName, Plaintiff, ClientName, CustomerName
 */
export function extractPlaintiffName(caseInfo: CaseInfo | null): string | null {
  if (!caseInfo) {
    return null;
  }

  // Try different possible field names
  const plaintiffName = 
    caseInfo.PlaintiffName || 
    caseInfo.Plaintiff || 
    caseInfo.ClientName || 
    caseInfo.CustomerName;

  if (typeof plaintiffName === 'string' && plaintiffName.trim() !== '') {
    return plaintiffName.trim();
  }

  return null;
}

