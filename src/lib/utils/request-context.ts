/**
 * Request Context Utilities
 * Helper functions to get request metadata in server actions
 */

import { headers, cookies } from 'next/headers';

export interface RequestMetadata {
  ipAddress: string;
  userAgent?: string;
}

/**
 * Parse token to extract userId (matching login route format)
 */
function parseToken(token: string): { userId: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
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
      const tokenData = parseToken(token);
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
        const tokenData = parseToken(tokenCookie.value);
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
