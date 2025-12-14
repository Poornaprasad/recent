/**
 * Case Info Service
 * Handles fetching case information from SmartAdvocate API
 */

import 'server-only';

/**
 * Case Info response structure from SmartAdvocate API
 */
export interface CaseInfo {
  CaseNumber?: string;
  PlaintiffName?: string;
  Plaintiff?: string;
  ClientName?: string;
  CustomerName?: string;
  [key: string]: any; // Allow for other fields
}

/**
 * Fetch case info from SmartAdvocate API
 * @param caseNumber The case number to fetch info for
 * @returns Case info object or null if not found/error
 */
export async function fetchCaseInfo(caseNumber: string): Promise<CaseInfo | null> {
  try {
    if (!caseNumber || caseNumber.trim() === '') {
      return null;
    }

    // Get base URL from environment variable
    const baseUrl = process.env.sa_base_url || 'https://tbf.smartadvocate.com/CaseSyncAPI/';
    // Ensure base URL ends with a slash
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    
    // Build API URL
    const apiUrl = `${normalizedBaseUrl}case/CaseInfo?Casenumber=${encodeURIComponent(caseNumber.trim())}&AddContactInfo=false&AddReferrals=false`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers if needed
        // 'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error(`Failed to fetch case info: ${response.status} ${response.statusText}`, errorText);
      return null;
    }

    let data;
    try {
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.error('Empty response from case info API');
        return null;
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse case info API response:', parseError);
      return null;
    }
    
    // Handle different possible response formats
    if (data && typeof data === 'object') {
      return data as CaseInfo;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching case info from API:', error);
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
