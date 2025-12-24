/**
 * SmartAdvocate CRM Document API Operations (Script-Compatible)
 * This file does NOT import 'server-only' to allow use in Node.js scripts
 * Handles document retrieval and content fetching via SmartAdvocate API
 */

import type { SmartAdvocateDocument, SmartAdvocateDocumentContent, DocumentsByDateRequest, DocumentsByDateResponse, DocumentPageRequest } from './types';
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';

// Re-export types for script usage
export type { SmartAdvocateDocument, SmartAdvocateDocumentContent, DocumentsByDateRequest, DocumentsByDateResponse };

// Import script-compatible utils
import { getConfig as getConfigScript, getHeaders as getHeadersScript, hasCredentials as hasCredentialsScript } from './utils.script';

/**
 * Get documents by date range from SmartAdvocate API
 * 
 * @param params Document query parameters (date range, pagination)
 * @returns Paginated document response
 */
export async function getDocumentsByDate(
  params: DocumentsByDateRequest
): Promise<DocumentsByDateResponse> {
  if (!hasCredentialsScript()) {
    console.warn('[SmartAdvocate] API credentials not configured');
    throw new Error('SmartAdvocate API credentials not configured');
  }

  const config = getConfigScript();

  // Normalize base URL - handle both with and without trailing slash
  let baseUrl = config.SA_API_BASE_URL.trim();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Build API URL
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? '/case/documents/byDatePaged'
    : '/CaseSyncAPI/case/documents/byDatePaged';

  const url = `${baseUrl}${apiPath}`;
  const headers = await getHeadersScript();

  // Build request payload
  const payload = {
    modifiedFromDateTime: params.modifiedFromDateTime,
    modifiedToDateTime: params.modifiedToDateTime,
    pageRequest: {
      currentPage: params.currentPage ?? 0,
      pageSize: params.pageSize ?? 100,
      filterExpression: params.filterExpression ?? {},
    },
  };

  const response = await retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for document queries

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
        throw new Error('Request timeout after 60000ms');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  // Parse response
  let data: DocumentsByDateResponse | unknown;
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error('[SmartAdvocate] Empty response from documents by date API');
      throw new Error('Empty response from SmartAdvocate API');
    }

    data = JSON.parse(text);
  } catch (parseError) {
    console.error('[SmartAdvocate] Failed to parse documents by date API response:', parseError);
    throw new Error('Failed to parse SmartAdvocate API response');
  }

  // Handle response format - could be array or object with documents array
  if (data && typeof data === 'object') {
    // If response is directly an array
    if (Array.isArray(data)) {
      return {
        documents: data as SmartAdvocateDocument[],
        pageRequest: {
          currentPage: params.currentPage ?? 0,
          pageSize: params.pageSize ?? 100,
          totalPages: Math.ceil(data.length / (params.pageSize ?? 100)),
          totalRecords: data.length,
        },
      };
    }

    // If response is an object with documents array
    const responseData = data as DocumentsByDateResponse;
    
    // Ensure documents array exists
    if (!responseData.documents) {
      // Check if data itself is structured differently
      if (Array.isArray(responseData)) {
        return {
          documents: responseData as SmartAdvocateDocument[],
          pageRequest: {
            currentPage: params.currentPage ?? 0,
            pageSize: params.pageSize ?? 100,
            totalPages: Math.ceil(responseData.length / (params.pageSize ?? 100)),
            totalRecords: responseData.length,
          },
        };
      }
      responseData.documents = [];
    }
    
    // Ensure pagination info exists
    if (!responseData.pageRequest) {
      responseData.pageRequest = {
        currentPage: params.currentPage ?? 0,
        pageSize: params.pageSize ?? 100,
        totalPages: Math.ceil((responseData.documents?.length ?? 0) / (params.pageSize ?? 100)),
        totalRecords: responseData.documents?.length ?? 0,
      };
    }

    return responseData;
  }

  // Return empty response if data format is unexpected
  return {
    documents: [],
    pageRequest: {
      currentPage: params.currentPage ?? 0,
      pageSize: params.pageSize ?? 100,
      totalPages: 0,
      totalRecords: 0,
    },
  };
}

/**
 * Get document content by document ID from SmartAdvocate API
 * 
 * @param documentID The document ID to fetch content for
 * @returns Document content as base64 string or buffer
 */
export async function getDocumentContent(
  documentID: number
): Promise<SmartAdvocateDocumentContent> {
  if (!hasCredentialsScript()) {
    console.warn('[SmartAdvocate] API credentials not configured');
    throw new Error('SmartAdvocate API credentials not configured');
  }

  const config = getConfigScript();

  // Normalize base URL - handle both with and without trailing slash
  let baseUrl = config.SA_API_BASE_URL.trim();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Build API URL
  const apiPath = baseUrl.includes('/CaseSyncAPI')
    ? `/case/document/${documentID}/content`
    : `/CaseSyncAPI/case/document/${documentID}/content`;

  const url = `${baseUrl}${apiPath}`;
  const baseHeaders = await getHeadersScript();
  
  // For document content GET request, we don't need Content-Type header
  // Create headers without Content-Type for binary content
  const contentHeaders: HeadersInit = {
    ...baseHeaders,
  };
  // Remove Content-Type as it's not needed for GET requests and we're expecting binary data
  delete (contentHeaders as Record<string, string>)['Content-Type'];

  const response = await retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for document content

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: contentHeaders,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        throw createHttpError(res.status, errorText || res.statusText);
      }

      return res;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout after 120000ms');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  // Get content type from headers
  let contentType = response.headers.get('content-type') || 'application/octet-stream';
  
  // Get content as array buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // If content type is generic, try to detect from file signature (magic bytes)
  if (contentType === 'application/octet-stream' || !contentType.includes('/')) {
    // Check for PDF (PDF files start with %PDF)
    if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      contentType = 'application/pdf';
    }
    // Check for JPEG
    else if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      contentType = 'image/jpeg';
    }
    // Check for PNG
    else if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      contentType = 'image/png';
    }
    // Check for HEIC (may start with various signatures, but common one is ftyp)
    else if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      contentType = 'image/heic';
    }
    // If we can't detect, leave as octet-stream (will be filtered out later)
    // Don't default to PDF as it might be an unsupported file type
  }

  // Convert to base64 data URI
  const base64 = buffer.toString('base64');
  const dataUri = `data:${contentType};base64,${base64}`;

  return {
    documentID,
    contentType,
    dataUri,
    buffer,
    size: buffer.length,
  };
}

/**
 * Filter documents by category IDs
 * 
 * @param documents Array of documents to filter
 * @param categoryIDs Array of category IDs to include (default: [78, 1080] for Invoices and Receipts)
 * @returns Filtered documents
 */
export function filterDocumentsByCategory(
  documents: SmartAdvocateDocument[],
  categoryIDs: number[] = [78, 1080]
): SmartAdvocateDocument[] {
  return documents.filter(doc => 
    doc.categoryID && categoryIDs.includes(doc.categoryID)
  );
}

/**
 * Extract relevant fields from SmartAdvocate document
 * 
 * @param document Full document object from API
 * @returns Extracted document metadata
 */
export function extractDocumentMetadata(
  document: SmartAdvocateDocument
): {
  documentID: number;
  caseID: number;
  caseNumber: string;
  documentName: string;
  description: string | null;
  createdDate: string;
  modifiedDate: string;
  categoryID: number;
  categoryName: string;
  subCategoryName: string | null;
  comments: string | null;
  caseDocumentID: number;
} {
  return {
    documentID: document.documentID,
    caseID: document.caseID,
    caseNumber: document.caseNumber,
    documentName: document.documentName,
    description: document.description || null,
    createdDate: document.createdDate,
    modifiedDate: document.modifiedDate,
    categoryID: document.categoryID,
    categoryName: document.categoryName,
    subCategoryName: document.subCategoryName || null,
    comments: document.comments || null,
    caseDocumentID: document.caseDocumentID,
  };
}

