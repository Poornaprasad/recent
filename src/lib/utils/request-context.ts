/**
 * Request Context Utilities
 * Helper functions to get request metadata in server actions
 */

import { headers } from 'next/headers';

export interface RequestMetadata {
  ipAddress: string;
  userAgent?: string;
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
