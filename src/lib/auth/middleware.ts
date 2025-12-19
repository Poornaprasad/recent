/**
 * Authentication middleware for API routes
 * Provides utilities for protecting routes with authentication and authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from './index';
import { isTokenExpired } from './utils';
import type { User } from '../types';

/**
 * Authentication result
 */
export interface AuthResult {
  user: User;
  userId: string;
}

/**
 * Authentication error response
 */
export interface AuthError {
  error: string;
  status: number;
}

/**
 * Extract token from request headers
 * Supports both Authorization header (Bearer token) and custom X-Auth-Token header
 */
function extractToken(request: NextRequest): string | null {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try custom X-Auth-Token header
  const customToken = request.headers.get('x-auth-token');
  if (customToken) {
    return customToken;
  }
  
  return null;
}

/**
 * Validate token and get user
 * In production, this should verify JWT signature and extract user info
 * For now, we'll use a simple token format: userId-timestamp-random
 * 
 * @param token - Authentication token
 * @returns User object if token is valid, null otherwise
 */
async function validateToken(token: string): Promise<User | null> {
  try {
    // Simple token parsing (replace with JWT verification in production)
    // Token format: userId-timestamp-random
    // Since userId might be a UUID (contains dashes), we need to parse from the right
    // The last part is always the random hex (64 chars), second-to-last is timestamp
    const parts = token.split('-');
    if (parts.length < 3) {
      return null;
    }
    
    // Last part is the random hex (64 characters from randomBytes(32).toString('hex'))
    // Second-to-last part is the timestamp (base36)
    // Everything before that is the userId
    const randomPart = parts[parts.length - 1];
    const timestampPart = parts[parts.length - 2];
    const userId = parts.slice(0, -2).join('-');
    
    if (!userId || userId === 'system' || userId.trim() === '') {
      return null; // Reject system tokens and empty userIds
    }
    
    // Basic validation of token parts
    if (!randomPart || !timestampPart) {
      return null;
    }
    
    // Validate random part is hex (64 chars from 32 bytes)
    if (randomPart.length !== 64 || !/^[0-9a-f]+$/i.test(randomPart)) {
      return null;
    }
    
    // Get user from database
    const user = getUserById(userId);
    if (!user) {
      return null;
    }
    
    // Check account status
    if (user.accountStatus && user.accountStatus !== 'active') {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error validating token:', error);
    return null;
  }
}

/**
 * Authentication middleware
 * Validates token and returns user information
 * 
 * @param request - Next.js request object
 * @returns AuthResult if authenticated, AuthError if not
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult | AuthError> {
  const token = extractToken(request);
  
  if (!token) {
    return {
      error: 'Authentication required. Please provide a valid token.',
      status: 401,
    };
  }
  
  const user = await validateToken(token);
  
  if (!user) {
    return {
      error: 'Invalid or expired token. Please log in again.',
      status: 401,
    };
  }
  
  return {
    user,
    userId: user.id,
  };
}

/**
 * Require authentication middleware wrapper
 * Use this to protect API routes that require authentication
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuth(request);
 *   if ('error' in auth) {
 *     return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   }
 *   // Use auth.user and auth.userId
 * }
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const auth = await authenticateRequest(request);
  
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }
  
  return auth;
}

/**
 * Require specific role middleware
 * Use this to protect API routes that require specific roles
 * 
 * @param request - Next.js request object
 * @param allowedRoles - Array of allowed roles
 * @returns AuthResult if authenticated and authorized, NextResponse with error if not
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthResult | NextResponse> {
  const auth = await authenticateRequest(request);
  
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }
  
  if (!allowedRoles.includes(auth.user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions. This action requires specific role access.' },
      { status: 403 }
    );
  }
  
  return auth;
}

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no token is provided
 * Useful for routes that have different behavior for authenticated vs unauthenticated users
 * 
 * @param request - Next.js request object
 * @returns AuthResult if authenticated, null if not authenticated (but no error)
 */
export async function optionalAuth(
  request: NextRequest
): Promise<AuthResult | null> {
  const token = extractToken(request);
  
  if (!token) {
    return null;
  }
  
  const user = await validateToken(token);
  
  if (!user) {
    return null;
  }
  
  return {
    user,
    userId: user.id,
  };
}

