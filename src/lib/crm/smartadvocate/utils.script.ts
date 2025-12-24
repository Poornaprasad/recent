/**
 * SmartAdvocate CRM Utilities (Script-Compatible)
 * This file does NOT import 'server-only' to allow use in Node.js scripts
 * Authentication, configuration, and helper functions
 */

import type { SmartAdvocateConfig } from './types';

// ============================================================================
// Token Management
// ============================================================================

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Authenticate with SmartAdvocate API using username and password
 * Returns an authentication token that can be used for future requests
 */
async function authenticateWithCredentials(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  try {
    const url = `${baseUrl}/Users/authenticate`;
    const payload = {
      Username: username,
      Password: password,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      // Equivalent to resp.raise_for_status() in Python
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const token = data.token;

      if (!token) {
        throw new Error('No auth token in response');
      }

      if (typeof token !== 'string') {
        throw new Error('Token in response is not a string');
      }

      return token;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout after 30000ms');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SmartAdvocate] Authentication failed:', errorMessage);
    throw error;
  }
}

/**
 * Get or refresh authentication token
 * Uses cached token if still valid, otherwise authenticates with username/password
 */
async function getAuthToken(): Promise<string | null> {
  const config = getConfig();

  // If username/password not provided, return null
  if (!config.SA_USERNAME || !config.SA_PASSWORD) {
    return null;
  }

  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  // Authenticate to get a new token
  try {
    const token = await authenticateWithCredentials(
      config.SA_API_BASE_URL,
      config.SA_USERNAME,
      config.SA_PASSWORD
    );

    // Cache the token (default expiration: 1 hour, adjust if API provides expiration)
    // SmartAdvocate tokens typically expire after some time, we'll refresh proactively
    tokenCache = {
      token,
      expiresAt: Date.now() + 55 * 60 * 1000, // 55 minutes (refresh 5 min before 1 hour)
    };

    return token;
  } catch (error) {
    console.error('[SmartAdvocate] Authentication error:', error);
    // Clear invalid cache
    tokenCache = null;
    throw error;
  }
}

/**
 * Clear the cached authentication token
 * Useful when credentials change or token is invalid
 */
export function clearAuthToken(): void {
  tokenCache = null;
}

// ============================================================================
// Configuration Utilities
// ============================================================================

/**
 * Get SmartAdvocate API configuration from environment variables
 * Uses SMARTADVOCATE_* prefix as primary, with SA_* as fallback for backward compatibility
 */
export function getConfig(): SmartAdvocateConfig {
  const pageSize = process.env.SA_DOCUMENT_SYNC_PAGE_SIZE 
    ? parseInt(process.env.SA_DOCUMENT_SYNC_PAGE_SIZE, 10) 
    : undefined;
  
  return {
    SA_API_BASE_URL: process.env.SMARTADVOCATE_BASE_URL || process.env.SA_API_BASE_URL || process.env.sa_base_url || 'https://app.smartadvocate.com',
    SA_API_KEY: process.env.SMARTADVOCATE_API_KEY || process.env.SA_API_KEY,
    SA_USERNAME: process.env.SMARTADVOCATE_USERNAME || process.env.SA_USERNAME,
    SA_PASSWORD: process.env.SMARTADVOCATE_PASSWORD || process.env.SA_PASSWORD,
    SA_DOCUMENT_SYNC_FROM_DATE: process.env.SA_DOCUMENT_SYNC_FROM_DATE,
    SA_DOCUMENT_SYNC_TO_DATE: process.env.SA_DOCUMENT_SYNC_TO_DATE,
    SA_DOCUMENT_SYNC_PAGE_SIZE: pageSize,
  };
}

/**
 * Check if SmartAdvocate API credentials are configured
 */
export function hasCredentials(): boolean {
  const config = getConfig();
  return !!(config.SA_API_KEY || (config.SA_USERNAME && config.SA_PASSWORD));
}

/**
 * Get SmartAdvocate API headers for requests
 * Supports:
 * 1. Authenticated token - if username/password provided, authenticates and uses token (first preference)
 * 2. API key (Bearer) - if SA_API_KEY is provided (fallback)
 */
export async function getHeaders(): Promise<HeadersInit> {
  const config = getConfig();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Connection': 'keep-alive',
  };
  
  if (config.SA_USERNAME && config.SA_PASSWORD) {
    // First preference: Try to get authenticated token using username/password
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Failed to authenticate with SmartAdvocate API: No token received');
    }
    headers['Authorization'] = `Bearer ${token}`;
  } else if (config.SA_API_KEY) {
    // Second preference: Use API key if username/password not provided
    headers['Authorization'] = `Bearer ${config.SA_API_KEY}`;
    headers['X-API-Key'] = config.SA_API_KEY;
  } else {
    throw new Error('SmartAdvocate API credentials not configured');
  }
  
  return headers;
}

/**
 * Validate API response and handle errors
 * Throws error if response is not OK
 * Clears token cache on 401 (Unauthorized) to force re-authentication
 */
export async function handleApiResponse(response: Response, context: string): Promise<Response> {
  if (!response.ok) {
    // If we get a 401, the token might be expired - clear it
    if (response.status === 401) {
      tokenCache = null;
    }
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`SmartAdvocate API error (${context}): ${response.status} - ${errorText}`);
  }
  return response;
}

