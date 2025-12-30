import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/repositories/user.repository';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type { User } from '@/lib/domain/types';
import { auditService } from '@/lib/core/audit/audit.service';

// JWT configuration
const JWT_EXPIRY = '24h';
const JWT_ALGORITHM = 'HS256' as const;

/**
 * Get JWT secret from environment variable
 * In development, falls back to a randomly generated secret (not persistent across restarts)
 * In production, JWT_SECRET environment variable is REQUIRED
 */
function getJwtSecret(): string {
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

  // Development fallback - generate a temporary secret
  // Warning: This means tokens won't persist across server restarts in development
  console.warn('[AUTH] JWT_SECRET not set, using temporary development secret');
  return randomBytes(32).toString('hex');
}

/**
 * Generate a signed JWT token for authentication
 * Uses HS256 algorithm with a secret key
 */
function generateToken(userId: string, email: string, role: string): string {
  const secret = getJwtSecret();

  const payload = {
    sub: userId,      // Subject (user ID)
    email,            // User email
    role,             // User role for authorization
    type: 'access',   // Token type
  };

  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRY,
    issuer: 'invoice-management-system',
  });
}

export async function POST(request: NextRequest) {
  // Get client IP address for audit logging
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      await auditService.logLoginFailed(email || 'unknown', 'Missing email or password', {
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await getUserByEmail(email);

    if (!user) {
      await auditService.logLoginFailed(email, 'User not found', {
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has a password (might be OAuth-only user)
    if (!user.password) {
      await auditService.logLoginFailed(email, 'No password set for user', {
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await auditService.logLoginFailed(email, 'Invalid password', {
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== 'Active') {
      await auditService.logLoginFailed(email, `Account status: ${user.status}`, {
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Account is not active. Please contact an administrator.' },
        { status: 403 }
      );
    }

    // Generate tokens
    const token = generateToken(user.id, user.email, user.role);
    const refreshToken = randomUUID();
    const tokenExpiry = Date.now() + 60 * 60 * 24 * 1000; // 24 hours in milliseconds

    // Map database user to domain user (exclude password)
    const domainUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as User['role'],
      status: user.status as User['status'],
      assignedStates: user.assignedStates ? JSON.parse(user.assignedStates) : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Log successful login
    await auditService.logLoginSuccess(
      user.id,
      user.email,
      user.name,
      user.role,
      {
        ipAddress,
        userAgent,
      }
    );

    return NextResponse.json({
      user: domainUser,
      token,
      refreshToken,
      tokenExpiry,
    });
  } catch (error) {
    console.error('Login error:', error);
    await auditService.logApiError(undefined, {
      endpoint: '/api/auth/login',
      method: 'POST',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stackTrace: error instanceof Error ? error.stack : undefined,
    }, {
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
