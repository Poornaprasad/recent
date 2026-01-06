/**
 * Server-side PDF to image conversion utility
 * Uses pdftoppm (poppler) directly for reliable PDF to image conversion
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify as promisifyUtil } from 'util';
import { createRequire } from 'module';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const execAsync = promisifyUtil(exec);

/**
 * Counts the number of pages in a PDF without converting it
 * Uses pdfinfo (poppler) to get page count quickly
 * @param pdfDataUri - The PDF file as a data URI
 * @returns Promise resolving to the number of pages in the PDF
 */
export async function getPdfPageCount(pdfDataUri: string): Promise<number> {
  let tempPdfPath: string | null = null;
  
  try {
    // Extract base64 data from data URI
    const base64Data = pdfDataUri.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid PDF data URI format');
    }
    
    // Convert base64 to Buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    
    // Validate PDF buffer (should start with %PDF)
    if (pdfBuffer.length < 4 || pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50 || pdfBuffer[2] !== 0x44 || pdfBuffer[3] !== 0x46) {
      throw new Error('Invalid PDF format - buffer does not start with PDF signature');
    }
    
    // Create temporary PDF file
    const tempDir = tmpdir();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    tempPdfPath = path.join(tempDir, `pdf-count-${uniqueId}.pdf`);
    await writeFile(tempPdfPath, pdfBuffer);
    
    // Use pdfinfo to get page count
    // pdfinfo outputs metadata including "Pages: N"
    try {
      const { stdout } = await execAsync(`pdfinfo "${tempPdfPath}"`);
      const pagesMatch = stdout.match(/Pages:\s*(\d+)/i);
      if (pagesMatch && pagesMatch[1]) {
        return parseInt(pagesMatch[1], 10);
      }
      throw new Error('Could not extract page count from pdfinfo output');
    } catch (error: any) {
      // If pdfinfo fails, fall back to counting pages using pdftoppm approach
      // This is slower but more reliable
      const outputPrefix = path.join(tempDir, `page-count-${uniqueId}`);
      try {
        // Run pdftoppm with -l 1 to limit to first page only, then count all generated pages
        await execAsync(`pdftoppm -jpeg -r 1 "${tempPdfPath}" "${outputPrefix}"`);
        
        // Count generated image files
        let pageCount = 0;
        let pageNum = 1;
        const maxPages = 1000; // Reasonable upper limit
        
        while (pageNum <= maxPages) {
          const imagePath = `${outputPrefix}-${pageNum}.jpg`;
          try {
            await fs.promises.access(imagePath, fs.constants.F_OK);
            pageCount++;
            // Clean up the image file immediately
            try {
              await unlink(imagePath);
            } catch {
              // Ignore cleanup errors
            }
            pageNum++;
          } catch {
            // File doesn't exist, we've reached the end
            break;
          }
        }
        
        if (pageCount === 0) {
          throw new Error('Failed to count PDF pages - no pages found');
        }
        
        return pageCount;
      } catch (fallbackError: any) {
        const errorMsg = fallbackError?.message || String(fallbackError);
        throw new Error(`Failed to count PDF pages: ${errorMsg}`);
      }
    }
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to count PDF pages: ${errorMessage}`);
  } finally {
    // Clean up temporary PDF file
    if (tempPdfPath) {
      try {
        await unlink(tempPdfPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Converts all pages of a PDF to a single JPEG image data URI (server-side)
 * All pages are combined vertically into one long image
 * @param pdfDataUri - The PDF file as a data URI
 * @returns Promise resolving to an image data URI (JPEG format) containing all pages
 */
export async function convertPdfToImageServer(pdfDataUri: string): Promise<string> {
  let tempPdfPath: string | null = null;
  let tempImagePaths: string[] = [];
  
  try {
    // Import canvas module - dynamic import should work with serverExternalPackages
    const canvasModule = await import('canvas');
    
    // Access exports - canvas exports createCanvas and loadImage directly
    let createCanvas = canvasModule.createCanvas;
    let loadImage = canvasModule.loadImage;
    
    // If not found, try default export
    if ((!createCanvas || typeof createCanvas !== 'function') && canvasModule.default) {
      createCanvas = canvasModule.default.createCanvas;
      loadImage = canvasModule.default.loadImage;
    }
    
    // If still not found, try createRequire as fallback (for Next.js edge cases)
    if (!createCanvas || typeof createCanvas !== 'function') {
      try {
        // Use createRequire - need a valid file URL
        let requirePath: string | URL;
        
        if (typeof import.meta !== 'undefined' && import.meta.url) {
          requirePath = import.meta.url;
        } else {
          // If import.meta.url is not available, we can't use createRequire
          throw new Error('import.meta.url is not available');
        }
        
        const require = createRequire(requirePath);
        const canvasRequire = require('canvas');
        createCanvas = canvasRequire.createCanvas;
        loadImage = canvasRequire.loadImage;
      } catch (requireError: any) {
        // Log module structure for debugging
        console.error('[PDF-to-Image] Canvas module debug:', {
          moduleKeys: Object.keys(canvasModule).slice(0, 15),
          hasCreateCanvas: !!canvasModule.createCanvas,
          hasDefault: !!canvasModule.default,
          createCanvasType: typeof canvasModule.createCanvas,
          requireError: requireError?.message,
        });
        
        throw new Error(
          `Failed to import canvas module. ` +
          `createCanvas type: ${typeof createCanvas}. ` +
          `Module keys: ${Object.keys(canvasModule).slice(0, 10).join(', ')}. ` +
          `Require error: ${requireError?.message || String(requireError)}. ` +
          `Please ensure canvas is installed: npm install canvas`
        );
      }
    }
    
    // Validate that both functions are available
    if (!createCanvas || typeof createCanvas !== 'function') {
      throw new Error(
        `createCanvas is not available from canvas module. ` +
        `Type: ${typeof createCanvas}. ` +
        `Please ensure canvas is properly installed: npm install canvas`
      );
    }
    if (!loadImage || typeof loadImage !== 'function') {
      throw new Error(
        `loadImage is not available from canvas module. ` +
        `Type: ${typeof loadImage}. ` +
        `Please ensure canvas is properly installed: npm install canvas`
      );
    }

    // Extract base64 data from data URI
    // Handle both data:application/pdf;base64, and data:image/... formats
    const dataUriMatch = pdfDataUri.match(/^data:(.+?);base64,(.+)$/);
    if (!dataUriMatch || !dataUriMatch[2]) {
      throw new Error(`Invalid PDF data URI format. Expected format: data:application/pdf;base64,... but got: ${pdfDataUri.substring(0, 50)}...`);
    }
    
    const base64Data = dataUriMatch[2];
    
    // Convert base64 to Buffer
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      throw new Error(`Failed to decode base64 PDF data: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Validate PDF buffer (should start with %PDF)
    if (pdfBuffer.length < 4) {
      throw new Error(`Invalid PDF format - buffer too short (${pdfBuffer.length} bytes). Expected at least 4 bytes.`);
    }
    
    if (pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50 || pdfBuffer[2] !== 0x44 || pdfBuffer[3] !== 0x46) {
      const firstBytes = Array.from(pdfBuffer.slice(0, Math.min(10, pdfBuffer.length)))
        .map(b => `0x${b.toString(16).padStart(2, '0')}`)
        .join(' ');
      throw new Error(
        `Invalid PDF format - buffer does not start with PDF signature (0x25 0x50 0x44 0x46). ` +
        `Got: ${firstBytes}. Buffer length: ${pdfBuffer.length} bytes. ` +
        `This might indicate the Word-to-PDF conversion failed or returned invalid data.`
      );
    }
    
    // Create temporary PDF file
    const tempDir = tmpdir();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    tempPdfPath = path.join(tempDir, `pdf-${uniqueId}.pdf`);
    await writeFile(tempPdfPath, pdfBuffer);
    
    // Use pdftoppm to convert PDF to JPEG images
    // pdftoppm converts all pages and names them with -1, -2, etc.
    const outputPrefix = path.join(tempDir, `page-${uniqueId}`);
    const density = 200; // DPI
    
    // Run pdftoppm: pdftoppm -jpeg -r 200 input.pdf output-prefix
    // This will create output-prefix-1.jpg, output-prefix-2.jpg, etc.
    // Use array format to prevent command injection
    try {
      await execAsync(`pdftoppm -jpeg -r ${density} "${tempPdfPath}" "${outputPrefix}"`, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large PDFs
        timeout: 60000, // 60 second timeout
      });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      throw new Error(`Failed to convert PDF with pdftoppm: ${errorMsg}`);
    }
    
    // Find all generated image files
    const pageImages: string[] = [];
    let pageNum = 1;
    const maxPages = 100;
    
    while (pageNum <= maxPages) {
      const imagePath = `${outputPrefix}-${pageNum}.jpg`;
      try {
        // Check if file exists
        await fs.promises.access(imagePath, fs.constants.F_OK);
        // Read the image file and convert to base64
        const imageBuffer = await fs.promises.readFile(imagePath);
        const base64 = imageBuffer.toString('base64');
        pageImages.push(base64);
        tempImagePaths.push(imagePath);
        pageNum++;
      } catch {
        // File doesn't exist, we've reached the end
        break;
      }
    }
    
    if (pageImages.length === 0) {
      throw new Error('Failed to convert PDF - no pages found');
    }
    
    console.log(`Successfully converted PDF to ${pageImages.length} page(s)`);
    
    // If single page, return it directly
    if (pageImages.length === 1) {
      return `data:image/jpeg;base64,${pageImages[0]}`;
    }
    
    // For multiple pages, combine them vertically using canvas
    const pageGap = 20;
    let totalHeight = 0;
    let maxWidth = 0;

    // Load all page images in parallel and calculate dimensions
    const loadedImages = await Promise.all(
      pageImages.map((base64) => loadImage(Buffer.from(base64, 'base64')))
    );
    
    loadedImages.forEach((img) => {
      totalHeight += img.height;
      maxWidth = Math.max(maxWidth, img.width);
    });
    totalHeight += pageGap * (loadedImages.length - 1);
    
    // Create combined canvas
    const canvas = createCanvas(maxWidth, totalHeight);
    const ctx = canvas.getContext('2d');
    
    // Fill white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, maxWidth, totalHeight);
    
    // Draw all pages
    let currentY = 0;
    for (const img of loadedImages) {
      ctx.drawImage(img, 0, currentY);
      currentY += img.height + pageGap;
    }
    
    // Convert to JPEG data URI with compression
    const quality = pageImages.length === 1 ? 0.9 : pageImages.length <= 3 ? 0.8 : 0.75;
    const buffer = canvas.toBuffer('image/jpeg', { quality });
    const base64 = buffer.toString('base64');
    
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert PDF to image: ${errorMessage}`);
  } finally {
    // Clean up temporary files
    if (tempPdfPath) {
      try {
        await unlink(tempPdfPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    for (const imgPath of tempImagePaths) {
      try {
        await unlink(imgPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

