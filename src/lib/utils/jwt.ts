import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

// JWT configuration
const JWT_ALGORITHM = 'HS256' as const;

// Cache for development secret (so it's consistent across requests in the same server instance)
let cachedDevSecret: string | null = null;

/**
 * Get JWT secret from environment variable
 * In development, falls back to a randomly generated secret (cached per server instance)
 * In production, JWT_SECRET environment variable is REQUIRED
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  // In production, JWT_SECRET is required
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SECURITY: JWT_SECRET environment variable is required in production. ' +
      'Please set a strong, random secret (at least 32 characters).'
    );
  }

  // Development fallback - generate a temporary secret and cache it
  // This ensures the same secret is used for token generation and verification
  // Warning: This means tokens won't persist across server restarts in development
  if (!cachedDevSecret) {
    cachedDevSecret = randomBytes(32).toString('hex');
    console.warn('[AUTH] JWT_SECRET not set, using temporary development secret (cached for this server instance)');
  }
  
  return cachedDevSecret;
}

/**
 * Verify and parse a JWT token
 * Returns the decoded payload if valid, null otherwise
 */
export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    }) as jwt.JwtPayload;

    // Extract userId from 'sub' field (as set in login route)
    if (!decoded.sub) {
      return null;
    }

    return {
      userId: decoded.sub,
      email: decoded.email || '',
      role: decoded.role || '',
    };
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
}

/**
 * Generate a signed JWT token for authentication
 * Uses HS256 algorithm with a secret key
 */
export function generateToken(userId: string, email: string, role: string): string {
  const secret = getJwtSecret();

  const payload = {
    sub: userId,      // Subject (user ID)
    email,            // User email
    role,             // User role for authorization
    type: 'access',   // Token type
  };

  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '24h',
    issuer: 'invoice-management-system',
  });
}

