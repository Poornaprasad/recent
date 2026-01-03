/**
 * Server-side Word document to PDF conversion utility
 * Uses LibreOffice (soffice) to convert .doc and .docx files to PDF
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify as promisifyUtil } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const execAsync = promisifyUtil(exec);

/**
 * Check if LibreOffice is installed and available
 */
async function isLibreOfficeAvailable(): Promise<boolean> {
  try {
    await execAsync('which soffice || which libreoffice');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the LibreOffice command (soffice or libreoffice)
 */
async function getLibreOfficeCommand(): Promise<string> {
  try {
    await execAsync('which soffice');
    return 'soffice';
  } catch {
    try {
      await execAsync('which libreoffice');
      return 'libreoffice';
    } catch {
      throw new Error('LibreOffice is not installed. Please install it:\n' +
        '  macOS: brew install --cask libreoffice\n' +
        '  Ubuntu/Debian: sudo apt-get install libreoffice\n' +
        '  CentOS/RHEL: sudo yum install libreoffice\n' +
        '  Or download from: https://www.libreoffice.org/download/');
    }
  }
}

/**
 * Converts a Word document (.doc or .docx) to PDF
 * @param wordDataUri - The Word document as a data URI
 * @param isDocx - Whether the file is .docx (true) or .doc (false)
 * @returns Promise resolving to a PDF data URI
 */
export async function convertWordToPdf(wordDataUri: string, isDocx: boolean = true): Promise<string> {
  let tempWordPath: string | null = null;
  let tempPdfPath: string | null = null;
  let tempOutputDir: string | null = null;
  
  try {
    // Extract base64 data from data URI
    const base64Data = wordDataUri.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid Word document data URI format');
    }
    
    // Convert base64 to Buffer
    const wordBuffer = Buffer.from(base64Data, 'base64');
    
    // Create temporary Word document file
    const tempDir = tmpdir();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const extension = isDocx ? 'docx' : 'doc';
    tempWordPath = path.join(tempDir, `word-${uniqueId}.${extension}`);
    await writeFile(tempWordPath, wordBuffer);
    
    // Create temporary output directory for PDF
    tempOutputDir = path.join(tempDir, `pdf-output-${uniqueId}`);
    await fs.promises.mkdir(tempOutputDir, { recursive: true });
    
    // Check if LibreOffice is available
    const libreOfficeCmd = await getLibreOfficeCommand();
    
    // Use LibreOffice to convert Word to PDF
    // soffice --headless --convert-to pdf --outdir <output_dir> <input_file>
    try {
      const result = await execAsync(`${libreOfficeCmd} --headless --convert-to pdf --outdir "${tempOutputDir}" "${tempWordPath}"`);
      console.log('LibreOffice conversion output:', result.stdout);
      if (result.stderr) {
        console.warn('LibreOffice conversion warnings:', result.stderr);
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      // Check if the error is because LibreOffice is not found
      if (errorMsg.includes('command not found') || errorMsg.includes('ENOENT')) {
        throw new Error('LibreOffice is not installed. Please install it:\n' +
          '  macOS: brew install --cask libreoffice\n' +
          '  Ubuntu/Debian: sudo apt-get install libreoffice\n' +
          '  CentOS/RHEL: sudo yum install libreoffice\n' +
          '  Or download from: https://www.libreoffice.org/download/');
      }
      throw new Error(`Failed to convert Word document with LibreOffice: ${errorMsg}`);
    }
    
    // Find the generated PDF file
    // LibreOffice creates a PDF with the same base name as the input file
    const baseName = path.basename(tempWordPath, `.${extension}`);
    
    // Try different possible PDF file names
    const possiblePdfPaths = [
      path.join(tempOutputDir, `${baseName}.pdf`),
      path.join(tempOutputDir, `word-${baseName}.pdf`),
      path.join(tempOutputDir, path.basename(tempWordPath, `.${extension}`) + '.pdf'),
    ];
    
    // Also check all PDF files in the output directory
    let foundPdf = false;
    const files = await fs.promises.readdir(tempOutputDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      // Use the first PDF file found
      tempPdfPath = path.join(tempOutputDir, pdfFiles[0]);
      foundPdf = true;
    } else {
      // Try the possible paths
      for (const possiblePath of possiblePdfPaths) {
        if (fs.existsSync(possiblePath)) {
          tempPdfPath = possiblePath;
          foundPdf = true;
          break;
        }
      }
    }
    
    // Check if PDF file exists
    if (!foundPdf || !tempPdfPath || !fs.existsSync(tempPdfPath)) {
      const dirContents = await fs.promises.readdir(tempOutputDir).catch(() => []);
      throw new Error(`PDF file was not created by LibreOffice. Output directory contents: ${dirContents.join(', ')}`);
    }
    
    // Read the PDF file
    const pdfBuffer = await readFile(tempPdfPath);
    
    // Convert to base64 data URI
    const base64 = pdfBuffer.toString('base64');
    const pdfDataUri = `data:application/pdf;base64,${base64}`;
    
    return pdfDataUri;
  } finally {
    // Clean up temporary files
    if (tempWordPath && fs.existsSync(tempWordPath)) {
      try {
        await unlink(tempWordPath);
      } catch (error) {
        console.warn('Failed to delete temporary Word file:', error);
      }
    }
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try {
        await unlink(tempPdfPath);
      } catch (error) {
        console.warn('Failed to delete temporary PDF file:', error);
      }
    }
    if (tempOutputDir && fs.existsSync(tempOutputDir)) {
      try {
        await fs.promises.rm(tempOutputDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to delete temporary output directory:', error);
      }
    }
  }
}

