/**
 * SmartAdvocate CRM Document API Operations
 * Handles document retrieval and content fetching via SmartAdvocate API
 */

import 'server-only';
import { getConfig, getHeaders, hasCredentials } from './utils';
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';
import type { SmartAdvocateDocument, SmartAdvocateDocumentContent, DocumentsByDateRequest, DocumentsByDateResponse } from './types';

/**
 * Get documents by date range from SmartAdvocate API
 * 
 * @param params Document query parameters (date range, pagination)
 * @returns Paginated document response
 */
export async function getDocumentsByDate(
  params: DocumentsByDateRequest
): Promise<DocumentsByDateResponse> {
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
    ? '/case/documents/byDatePaged'
    : '/CaseSyncAPI/case/documents/byDatePaged';

  const url = `${baseUrl}${apiPath}`;
  const headers = await getHeaders();

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
    ? `/case/document/${documentID}/content`
    : `/CaseSyncAPI/case/document/${documentID}/content`;

  const url = `${baseUrl}${apiPath}`;
  const baseHeaders = await getHeaders();
  
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

      // Check content length header
      const contentLength = res.headers.get('content-length');
      if (contentLength) {
        const length = parseInt(contentLength, 10);
        if (length === 0) {
          console.error(`[SmartAdvocate] Document ${documentID} has Content-Length: 0`);
          throw new Error(`Document content is empty (Content-Length: 0). The document may not exist or may be corrupted.`);
        }
        console.log(`[SmartAdvocate] Document ${documentID} Content-Length: ${length} bytes`);
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

  // Get content type
  let contentType = response.headers.get('content-type') || 'application/octet-stream';
  
  // Get content as array buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate buffer is not empty
  if (buffer.length === 0) {
    console.error(`[SmartAdvocate] Document ${documentID} has empty content`);
    throw new Error(`Document content is empty (0 bytes). The document may not exist or may be corrupted.`);
  }

  // If content type is generic, try to detect from file signature (magic bytes)
  if (contentType === 'application/octet-stream' || !contentType.includes('/')) {
    // Check for PDF (PDF files start with %PDF)
    if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      contentType = 'application/pdf';
      console.log(`[SmartAdvocate] Document ${documentID} detected as PDF from magic bytes`);
    }
    // Check for JPEG
    else if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      contentType = 'image/jpeg';
      console.log(`[SmartAdvocate] Document ${documentID} detected as JPEG from magic bytes`);
    }
    // Check for PNG
    else if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      contentType = 'image/png';
      console.log(`[SmartAdvocate] Document ${documentID} detected as PNG from magic bytes`);
    }
    // Check for HEIC (may start with various signatures, but common one is ftyp)
    else if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      contentType = 'image/heic';
      console.log(`[SmartAdvocate] Document ${documentID} detected as HEIC from magic bytes`);
    }
  }

  console.log(`[SmartAdvocate] Document ${documentID} fetched successfully: ${buffer.length} bytes, content-type: ${contentType}`);

  // Convert to base64 data URI
  const base64 = buffer.toString('base64');
  
  // Validate base64 conversion
  if (!base64 || base64.length === 0) {
    console.error(`[SmartAdvocate] Document ${documentID} base64 conversion failed. Buffer length: ${buffer.length}`);
    throw new Error(`Failed to convert document to base64. Buffer length: ${buffer.length} bytes`);
  }
  
  // Validate base64 string is reasonable length (should be ~4/3 of buffer size)
  const expectedBase64Length = Math.ceil(buffer.length * 4 / 3);
  if (base64.length < expectedBase64Length * 0.9) {
    console.warn(`[SmartAdvocate] Document ${documentID} base64 length (${base64.length}) is shorter than expected (${expectedBase64Length})`);
  }
  
  const dataUri = `data:${contentType};base64,${base64}`;

  // Validate data URI format
  const dataUriMatch = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!dataUriMatch || !dataUriMatch[2] || dataUriMatch[2].length === 0) {
    console.error(`[SmartAdvocate] Document ${documentID} invalid data URI format. Data URI length: ${dataUri.length}, Base64 length: ${base64.length}, Buffer length: ${buffer.length}`);
    throw new Error(`Invalid data URI format. Document size: ${buffer.length} bytes, Base64 length: ${base64.length}`);
  }
  
  console.log(`[SmartAdvocate] Document ${documentID} data URI created successfully: ${dataUri.length} chars (base64: ${base64.length} chars)`);

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

