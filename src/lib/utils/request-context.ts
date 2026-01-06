/**
 * Request Context Utilities
 * Helper functions to get request metadata in server actions
 */

import { headers, cookies } from 'next/headers';
import { verifyToken } from './jwt';

export interface RequestMetadata {
  ipAddress: string;
  userAgent?: string;
}

/**
 * Get current user ID from session/cookies
 * Returns the user ID if authenticated, otherwise returns null
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const headersList = await headers();
    
    // First, try to get token from Authorization header
    const authHeader = headersList.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const tokenData = verifyToken(token);
      if (tokenData) {
        return tokenData.userId;
      }
    }
    
    // Fallback: try to get token from cookies
    // Note: In Next.js, cookies are typically set client-side and may not be accessible in server actions
    // This is a fallback attempt
    try {
      const cookieStore = await cookies();
      const tokenCookie = cookieStore.get('auth-token') || cookieStore.get('token');
      if (tokenCookie?.value) {
        const tokenData = verifyToken(tokenCookie.value);
        if (tokenData) {
          return tokenData.userId;
        }
      }
    } catch {
      // Cookies may not be accessible in server actions, continue
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

/**
 * Get request metadata (IP address, user agent) from headers
 * Use this in server actions to capture audit metadata
 */
export async function getRequestMetadata(): Promise<RequestMetadata> {
  const headersList = await headers();

  // Get IP address from various headers (in order of preference)
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') || // Cloudflare
    headersList.get('true-client-ip') || // Akamai
    'unknown';

  const userAgent = headersList.get('user-agent') || undefined;

  return {
    ipAddress,
    userAgent,
  };
}
