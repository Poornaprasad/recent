/**
 * Client-side PDF to image conversion utility
 * Uses pdfjs-dist in the browser where it works properly with workers
 */

/**
 * Converts all pages of a PDF to a single PNG image data URI (client-side only)
 * All pages are combined vertically into one long image
 * @param pdfDataUri - The PDF file as a data URI
 * @returns Promise resolving to an image data URI (PNG format) containing all pages
 */
export async function convertPdfToImageClient(pdfDataUri: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('This function can only be used on the client side');
  }

  try {
    // Dynamically import pdfjs-dist for client-side usage
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set up worker for browser environment
    // Use local worker file from public folder instead of CDN to avoid fetch errors
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    
    // Extract base64 data from data URI
    const base64Data = pdfDataUri.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid PDF data URI format');
    }
    
    // Convert base64 to Uint8Array
    const pdfBytes = new Uint8Array(
      atob(base64Data)
        .split('')
        .map((char) => char.charCodeAt(0))
      );
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: pdfBytes,
      useSystemFonts: true,
      verbosity: 0,
    });
    const pdf = await loadingTask.promise;
    
    const numPages = pdf.numPages;
    // Adaptive scale: reduce scale for multi-page PDFs to keep file size manageable
    // For 1 page: use high quality (2.0)
    // For 2-3 pages: use medium quality (1.5)
    // For 4+ pages: use lower quality (1.2) to reduce file size
    const scale = numPages === 1 ? 2.0 : numPages <= 3 ? 1.5 : 1.2;
    const pageGap = 20; // Gap between pages in pixels
    
    // Calculate total height and max width
    let totalHeight = 0;
    let maxWidth = 0;
    const pageCanvases: HTMLCanvasElement[] = [];
    
    // Render all pages to individual canvases
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Create a render context
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      // Render PDF page to canvas
      await page.render(renderContext).promise;
      
      pageCanvases.push(canvas);
      totalHeight += viewport.height;
      if (pageNum < numPages) {
        totalHeight += pageGap; // Add gap between pages
      }
      maxWidth = Math.max(maxWidth, viewport.width);
    }
    
    // Create a combined canvas with all pages
    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = maxWidth;
    combinedCanvas.height = totalHeight;
    const combinedContext = combinedCanvas.getContext('2d');
    
    if (!combinedContext) {
      throw new Error('Could not get combined canvas context');
    }
    
    // Fill background with white
    combinedContext.fillStyle = 'white';
    combinedContext.fillRect(0, 0, maxWidth, totalHeight);
    
    // Draw all pages onto the combined canvas
    let currentY = 0;
    for (let i = 0; i < pageCanvases.length; i++) {
      const pageCanvas = pageCanvases[i];
      combinedContext.drawImage(pageCanvas, 0, currentY);
      currentY += pageCanvas.height + (i < pageCanvases.length - 1 ? pageGap : 0);
    }
    
    // Convert combined canvas to data URI with compression
    // Use JPEG with adaptive quality to reduce file size while maintaining readability
    // Lower quality for more pages to keep file size manageable
    const quality = numPages === 1 ? 0.9 : numPages <= 3 ? 0.8 : 0.75;
    const imageDataUri = combinedCanvas.toDataURL('image/jpeg', quality);
    
    return imageDataUri;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert PDF to image: ${errorMessage}`);
  }
}

