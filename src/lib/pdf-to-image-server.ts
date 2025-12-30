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

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const execAsync = promisifyUtil(exec);

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
    const canvasModule = await import('canvas');
    const { createCanvas, Image } = canvasModule;

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
    tempPdfPath = path.join(tempDir, `pdf-${uniqueId}.pdf`);
    await writeFile(tempPdfPath, pdfBuffer);
    
    // Use pdftoppm to convert PDF to JPEG images
    // pdftoppm converts all pages and names them with -1, -2, etc.
    const outputPrefix = path.join(tempDir, `page-${uniqueId}`);
    const density = 200; // DPI
    
    // Run pdftoppm: pdftoppm -jpeg -r 200 input.pdf output-prefix
    // This will create output-prefix-1.jpg, output-prefix-2.jpg, etc.
    try {
      await execAsync(`pdftoppm -jpeg -r ${density} "${tempPdfPath}" "${outputPrefix}"`);
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

    // Load all page images and calculate dimensions
    const loadedImages: any[] = [];
    for (const base64 of pageImages) {
      const img = new (canvasModule.Image as any)();
      const imgBuffer = Buffer.from(base64, 'base64');
      img.src = imgBuffer;
      loadedImages.push(img);
    }
    
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

