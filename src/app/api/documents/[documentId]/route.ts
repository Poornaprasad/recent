/**
 * API route to serve documents directly from SmartAdvocate
 * This allows viewing documents without converting to data URIs (which have size limitations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDocumentContent } from '@/lib/crm/smartadvocate/document';
import { verifyToken } from '@/lib/utils/jwt';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: documentIdParam } = await params;
    const documentId = parseInt(documentIdParam, 10);
    
    if (isNaN(documentId)) {
      return new NextResponse('Invalid document ID', { status: 400 });
    }

    // Authenticate request - check for token in query parameter, header, or cookies
    const searchParams = request.nextUrl.searchParams;
    const queryToken = searchParams.get('token');
    const authHeader = request.headers.get('authorization');
    
    let token: string | null = null;
    
    // Try query parameter first (for PDF viewers that can't send headers)
    if (queryToken) {
      token = queryToken;
    }
    // Try Authorization header
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Try cookies as fallback
    else {
      try {
        const cookieStore = await cookies();
        const tokenCookie = cookieStore.get('auth-token') || cookieStore.get('token');
        token = tokenCookie?.value || null;
      } catch {
        // Cookies may not be accessible
      }
    }

    // Verify token if provided
    if (token) {
      const tokenData = verifyToken(token);
      if (!tokenData) {
        return new NextResponse('Invalid or expired token', { status: 401 });
      }
    } else {
      // If no token provided, still allow access (similar to /api/uploads)
      // Users can only get document IDs from authenticated pages
      console.log(`[Document API] No token provided for document ${documentId}, allowing access`);
    }

    // Fetch document content from SmartAdvocate
    const content = await getDocumentContent(documentId);

    // Return the document as a binary response
    return new NextResponse(content.buffer, {
      status: 200,
      headers: {
        'Content-Type': content.contentType,
        'Content-Length': content.size.toString(),
        'Content-Disposition': `inline; filename="document-${documentId}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error(`[Document API] Error fetching document ${(await params).documentId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(
      JSON.stringify({ error: `Failed to fetch document: ${errorMessage}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

