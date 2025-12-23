import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser } from '@/lib/repositories/user.repository';
import bcrypt from 'bcryptjs';
import { auditService } from '@/lib/core/audit/audit.service';
import { AuditAction, AuditResource, AuditCategory, AuditSeverity } from '@/lib/core/audit/audit.types';

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

export async function POST(request: NextRequest) {
  // Get client IP address for audit logging
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenData = parseToken(token);

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await getUserById(tokenData.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has a password
    if (!user.password) {
      await auditService.log({
        userId: user.id,
        userEmail: user.email,
        action: AuditAction.PASSWORD_CHANGE_FAILED,
        resource: AuditResource.AUTHENTICATION,
        category: AuditCategory.AUTHENTICATION,
        severity: AuditSeverity.WARNING,
        details: {
          description: 'Password change attempted on OAuth-only account',
          reason: 'No password set for account',
        },
        metadata: { ipAddress, userAgent },
      });
      return NextResponse.json(
        { error: 'Cannot change password for this account type' },
        { status: 400 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      await auditService.log({
        userId: user.id,
        userEmail: user.email,
        action: AuditAction.PASSWORD_CHANGE_FAILED,
        resource: AuditResource.AUTHENTICATION,
        category: AuditCategory.AUTHENTICATION,
        severity: AuditSeverity.WARNING,
        details: {
          description: 'Password change failed - incorrect current password',
          reason: 'Current password is incorrect',
        },
        metadata: { ipAddress, userAgent },
      });
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await updateUser(user.id, { password: hashedPassword });

    // Log successful password change
    await auditService.logPasswordChanged(user.id, user.email, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    await auditService.logApiError(undefined, {
      endpoint: '/api/auth/change-password',
      method: 'POST',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stackTrace: error instanceof Error ? error.stack : undefined,
    }, {
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { error: 'An error occurred while changing password' },
      { status: 500 }
    );
  }
}
