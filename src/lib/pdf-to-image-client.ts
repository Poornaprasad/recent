/**
 * Client-side PDF to image conversion utility
 * Uses pdfjs-dist in the browser where it works properly with workers
 */

/**
 * Converts the first page of a PDF to a PNG image data URI (client-side only)
 * @param pdfDataUri - The PDF file as a data URI
 * @returns Promise resolving to an image data URI (PNG format)
 */
export async function convertPdfToImageClient(pdfDataUri: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('This function can only be used on the client side');
  }

  try {
    // Dynamically import pdfjs-dist for client-side usage
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set up worker for browser environment
    // Use jsdelivr CDN with the correct .js extension (not .mjs)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    
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
    
    // Get the first page
    const page = await pdf.getPage(1);
    
    // Set up canvas for rendering with higher scale for better quality
    const viewport = page.getViewport({ scale: 2.0 });
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
    
    // Convert canvas to data URI
    const imageDataUri = canvas.toDataURL('image/png');
    
    return imageDataUri;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert PDF to image: ${errorMessage}`);
  }
}

