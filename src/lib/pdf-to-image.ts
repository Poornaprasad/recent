/**
 * Utility to convert PDF data URI to image data URI for OpenAI vision API
 * OpenAI's vision API only supports image formats, not PDFs
 * 
 * Note: PDF to image conversion requires system dependencies (poppler-utils or similar).
 * For now, we'll provide a helpful error message suggesting users upload images directly.
 */

/**
 * Converts the first page of a PDF to a PNG image data URI
 * @param pdfDataUri - The PDF file as a data URI
 * @returns Promise resolving to an image data URI (PNG format)
 */
export async function convertPdfToImage(pdfDataUri: string): Promise<string> {
  // For now, return a helpful error message
  // PDF to image conversion in Node.js requires complex setup with workers or system dependencies
  // The recommended approach is to convert PDFs to images on the client side before upload
  throw new Error(
    'PDF to image conversion is not currently supported on the server. ' +
    'Please convert your PDF to an image (PNG or JPEG) and upload the image file instead. ' +
    'You can use online tools or screenshot the first page of your PDF.'
  );
}

