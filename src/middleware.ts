import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for API route protection
 * Page routes are protected client-side via LayoutWrapper
 */

// Public API routes that don't require authentication
// Note: /api/uploads is public because files are accessed via unique filenames
// and users can only get these paths from authenticated invoice pages
const PUBLIC_API_ROUTES = ['/api/auth/login', '/api/uploads'];

// Routes that accept token via query parameter (for SSE/EventSource which doesn't support headers)
const QUERY_TOKEN_ROUTES = ['/api/sync/stream'];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Only check API routes (pages are protected client-side)
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for routes that accept token via query parameter (SSE endpoints)
  if (QUERY_TOKEN_ROUTES.some(route => pathname.startsWith(route))) {
    const queryToken = searchParams.get('token');
    if (queryToken && queryToken.length > 0) {
      return NextResponse.next();
    }
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Check for Authorization header on protected API routes
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Basic token validation (token exists)
  const token = authHeader.substring(7);
  if (!token) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only match API routes
    '/api/:path*',
  ],
};
