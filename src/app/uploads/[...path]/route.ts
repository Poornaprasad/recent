import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '@/lib/config/storage';

const UPLOADS_DIR = path.join(process.cwd(), STORAGE_CONFIG.uploadsDir.replace('./', ''));

function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.heic': 'image/heic',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const filename = params.path.join('/');
    
    // Security: Prevent directory traversal and ensure it's just a filename
    if (filename.includes('..') || path.isAbsolute(filename)) {
      return new NextResponse('Invalid file path', { status: 400 });
    }
    
    // Only allow alphanumeric, dash, underscore, and dot characters in filename
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return new NextResponse('Invalid file name', { status: 400 });
    }
    
    const filePath = path.join(UPLOADS_DIR, filename);
    
    // Verify the file is within the uploads directory
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return new NextResponse('Access denied', { status: 403 });
    }
    
    const buffer = await fs.readFile(filePath);
    const mimeType = getMimeTypeFromPath(filename);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}

