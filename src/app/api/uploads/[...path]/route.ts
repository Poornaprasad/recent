import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '@/lib/config/storage';

const UPLOADS_DIR = path.join(process.cwd(), STORAGE_CONFIG.uploadsDir.replace('./', ''));

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Serve uploaded files from the data/uploads directory
 * 
 * Security: Prevents directory traversal attacks by ensuring the resolved path
 * is within the uploads directory.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Await params in Next.js 15
    const { path: pathArray } = await params;
    
    // Reconstruct the file path from the route params
    const filePath = pathArray.join('/');
    
    // Security: Prevent directory traversal
    // Resolve the full path and ensure it's within UPLOADS_DIR
    const resolvedPath = path.resolve(UPLOADS_DIR, filePath);
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
    
    // Debug logging
    console.log('[Upload API] Request details:', {
      pathArray,
      filePath,
      resolvedPath,
      resolvedUploadsDir,
      UPLOADS_DIR,
    });
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      console.error('[Upload API] Security check failed:', {
        resolvedPath,
        resolvedUploadsDir,
        startsWith: resolvedPath.startsWith(resolvedUploadsDir),
      });
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
    
    // Check if file exists
    try {
      await fs.access(resolvedPath);
      console.log('[Upload API] File found:', resolvedPath);
    } catch (error) {
      console.error('[Upload API] File not found:', {
        resolvedPath,
        error: error instanceof Error ? error.message : String(error),
      });
      // List files in directory for debugging
      try {
        const files = await fs.readdir(resolvedUploadsDir);
        console.log('[Upload API] Files in uploads directory:', files.slice(0, 10));
      } catch (dirError) {
        console.error('[Upload API] Could not read uploads directory:', dirError);
      }
      return NextResponse.json(
        { error: 'File not found', path: resolvedPath },
        { status: 404 }
      );
    }
    
    // Read the file
    const fileBuffer = await fs.readFile(resolvedPath);
    const mimeType = getMimeType(resolvedPath);
    
    // Return the file with appropriate headers
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error serving upload file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

