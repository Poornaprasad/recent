import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/repositories/user.repository';

// Parse token to extract userId (matching login route format)
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

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', valid: false },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenData = parseToken(token);

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token', valid: false },
        { status: 401 }
      );
    }

    // Check if user exists in database
    const user = await getUserById(tokenData.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', valid: false },
        { status: 404 }
      );
    }

    // Check if user is active
    if (user.status !== 'Active') {
      return NextResponse.json(
        { error: 'User account is not active', valid: false },
        { status: 403 }
      );
    }

    // User is valid
    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        assignedStates: user.assignedStates ? JSON.parse(user.assignedStates) : undefined,
      },
    });
  } catch (error) {
    console.error('User validation error:', error);
    return NextResponse.json(
      { error: 'An error occurred during validation', valid: false },
      { status: 500 }
    );
  }
}

