import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/repositories/user.repository';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { User } from '@/lib/domain/types';

// Simple JWT-like token generation (for development)
// In production, use a proper JWT library like 'jsonwebtoken'
function generateToken(userId: string): string {
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };
  // Simple base64 encoding for development
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has a password (might be OAuth-only user)
    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== 'Active') {
      return NextResponse.json(
        { error: 'Account is not active. Please contact an administrator.' },
        { status: 403 }
      );
    }

    // Generate tokens
    const token = generateToken(user.id);
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

    return NextResponse.json({
      user: domainUser,
      token,
      refreshToken,
      tokenExpiry,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
