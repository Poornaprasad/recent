/**
 * Invoice service
 * Business logic layer for invoice operations
 */

import 'server-only';

import { extractInvoiceData, type ExtractInvoiceDataInput } from '@/ai/flows/extract-invoice-data';
import { findAllInvoices, findInvoiceById, upsertInvoice, updateInvoiceStatus, checkForDuplicateInvoice, findInvoicesByVendorName } from '../repositories/invoice.repository';
import { findVendorByName } from '../repositories/vendor.repository';
import { saveInvoiceFile } from '../storage/file-storage';
import { getOverallConfidence, parseInvoiceAmount } from '../utils/invoice-utils';
import { CONFIDENCE_THRESHOLDS, HIGH_VALUE_THRESHOLDS } from '../domain/constants';
import { sanitizeId } from '../utils/id-utils';
import { analyzeRecurringBill } from './recurring-bill.service';
import { getDb, initDb } from '../db';
import { invoices } from '../db/schema';
import { eq } from 'drizzle-orm';
import { vendorService } from './vendor.service';
import { createPendingVendor, findPendingVendorByInvoiceId } from '../repositories/pending-vendor.repository';
import type { StoredInvoice } from '../domain/types';
import { stateDetectionService } from '../core/state/state-detection.service';
import { isApprovedAndPushedToCrm } from '../utils/status-utils';
import { auditService } from '../core/audit/audit.service';
import { generateDocumentHash } from '../utils/document-hash';
import { convertPdfToImageServer, getPdfPageCount } from '../pdf-to-image-server';
import { convertWordToPdf } from '../word-to-pdf-server';

export class InvoiceService {
  /**
   * Process and save a new invoice
   */
  async processInvoice(
    input: ExtractInvoiceDataInput,
    options?: { 
      caseNumber?: string; 
      documentID?: number; 
      description?: string; 
      comment?: string;
      smartAdvocateMetadata?: Partial<Pick<StoredInvoice, 
        | 'saCaseId' | 'saDocumentName' | 'saFromUniqueContactId' | 'saToContactName' | 'saFromContactName'
        | 'saDocType' | 'saTemplateId' | 'saAttachFlag' | 'saCreatedUserId' | 'saCreatedDate'
        | 'saModifiedUserId' | 'saModifiedDate' | 'saCategoryId' | 'saCategoryName'
        | 'saSubCategoryId' | 'saSubCategoryName' | 'saSubSubCategoryId' | 'saSubSubSubCategoryId'
        | 'saMedProvUniqueContactId' | 'saIsReviewed' | 'saToUniqueContactId' | 'saDocumentDate'
        | 'saPriority' | 'saPriorityName' | 'saDocumentDirection' | 'saDirectionName'
        | 'saDocumentOrigin' | 'saOriginName' | 'saIsSharedInPortal' | 'saIsSharedWithEveryoneInPortal'
        | 'saCaseDocumentId' | 'saDeliveryMethodId' | 'saDeliveryName' | 'saMetadata'
      >>;
    }
  ): Promise<{ data?: StoredInvoice; error?: string }> {
    try {
      // Validate file type
      let invoiceDataUri = input.invoiceDataUri;
      const mimeType = invoiceDataUri.split(';')[0].split(':')[1];
      
      // Check if it's a Word document (application/octet-stream)
      const isWordDocument = mimeType === 'application/octet-stream';
      let isDoc = false;
      let isDocx = false;
      
      if (isWordDocument) {
        // Check magic bytes to detect Word document format
        const base64Data = invoiceDataUri.split(',')[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          
          // .doc files: D0 CF 11 E0 A1 B1 1A E1 (OLE2 format)
          if (buffer.length >= 8 && 
              buffer[0] === 0xD0 && buffer[1] === 0xCF && 
              buffer[2] === 0x11 && buffer[3] === 0xE0 &&
              buffer[4] === 0xA1 && buffer[5] === 0xB1 &&
              buffer[6] === 0x1A && buffer[7] === 0xE1) {
            isDoc = true;
          }
          // .docx files: PK (ZIP format)
          else if (buffer.length >= 4 && 
                   buffer[0] === 0x50 && buffer[1] === 0x4B && 
                   (buffer[2] === 0x03 || buffer[2] === 0x05) && 
                   (buffer[3] === 0x04 || buffer[3] === 0x06)) {
            if (buffer.length > 100) {
              const bufferString = buffer.toString('binary', 0, Math.min(1000, buffer.length));
              if (bufferString.includes('word/') || bufferString.includes('[Content_Types]')) {
                isDocx = true;
              } else {
                isDocx = true; // Assume docx if ZIP
              }
            }
          }
        }
      }
      
      if (!mimeType.startsWith('image/') && 
          mimeType !== 'application/pdf' && 
          !isDoc && 
          !isDocx) {
        return { error: 'Invalid file type. Please upload an image, PDF, or Word document.' };
      }
      
      // Get max pages limit from environment variable (default: 10)
      const maxPages = parseInt(process.env.MAX_DOCUMENT_PAGES || '10', 10);
      
      // Check page count for PDFs and Word documents before processing
      let pageCount: number | null = null;
      
      // Convert Word documents to PDF first to check page count
      if (isDoc || isDocx) {
        try {
          console.log(`Converting ${isDoc ? '.doc' : '.docx'} to PDF...`);
          const pdfDataUri = await convertWordToPdf(invoiceDataUri, isDocx);
          console.log('Word document converted to PDF successfully');
          
          // Check page count
          console.log('Checking PDF page count...');
          pageCount = await getPdfPageCount(pdfDataUri);
          console.log(`PDF has ${pageCount} page(s)`);
          
          // If page count exceeds limit, save document but skip AI processing
          if (pageCount > maxPages) {
            console.log(`Document has ${pageCount} pages, exceeding limit of ${maxPages}. Saving for manual processing.`);
            
            // Save the document without AI processing
            const rawInvoiceId = `INV-${Date.now()}`;
            const invoiceId = sanitizeId(rawInvoiceId);
            
            // Save the original PDF file
            let filePath: string;
            try {
              filePath = await saveInvoiceFile(pdfDataUri, invoiceId);
            } catch (fileError) {
              filePath = pdfDataUri;
            }
            
            // Create a minimal invoice record for manual processing
            const now = new Date(Math.floor(Date.now() / 1000) * 1000);
            const manualProcessingInvoice: StoredInvoice = {
              id: invoiceId,
              invoiceDataUri: filePath,
              status: 'Review',
              requiresSpecialHandling: true,
              specialHandlingReason: 'other',
              comment: `Document has ${pageCount} pages (exceeds limit of ${maxPages}). Requires manual processing.`,
              caseNumber: options?.caseNumber || undefined,
              documentID: options?.documentID,
              description: options?.description ? { value: options.description, confidence: 1.0, reasoning: 'From SmartAdvocate API', bbox: null } : undefined,
              // Required ExtractedDataOnly fields with null values
              invoiceNumber: null,
              invoiceDate: null,
              vendorName: null,
              vendorAddress: null,
              amount: null,
              clientName: null,
              createdAt: now,
              updatedAt: now,
              ...(options?.smartAdvocateMetadata || {}),
            };
            
            // Generate document hash if documentID is provided
            if (options?.documentID !== undefined) {
              manualProcessingInvoice.documentHash = generateDocumentHash(options.documentID, options.caseNumber);
            }
            
            // Save to database
            await upsertInvoice(manualProcessingInvoice);
            
            return { 
              data: manualProcessingInvoice,
              error: `Document has ${pageCount} pages, exceeding the limit of ${maxPages}. Document saved for manual processing.`
            };
          }
          
          // If within limit, convert PDF to image for AI processing
          console.log('Converting PDF to image...');
          invoiceDataUri = await convertPdfToImageServer(pdfDataUri);
          console.log('PDF converted to image successfully');
        } catch (conversionError) {
          const errorMessage = conversionError instanceof Error ? conversionError.message : 'Unknown error';
          return { 
            error: `Failed to convert Word document to image: ${errorMessage}` 
          };
        }
      }
      // Check page count for PDFs before processing
      else if (mimeType === 'application/pdf') {
        try {
          console.log('Checking PDF page count...');
          pageCount = await getPdfPageCount(invoiceDataUri);
          console.log(`PDF has ${pageCount} page(s)`);
          
          // If page count exceeds limit, save document but skip AI processing
          if (pageCount > maxPages) {
            console.log(`Document has ${pageCount} pages, exceeding limit of ${maxPages}. Saving for manual processing.`);
            
            // Save the document without AI processing
            const rawInvoiceId = `INV-${Date.now()}`;
            const invoiceId = sanitizeId(rawInvoiceId);
            
            // Save the original PDF file
            let filePath: string;
            try {
              filePath = await saveInvoiceFile(invoiceDataUri, invoiceId);
            } catch (fileError) {
              filePath = invoiceDataUri;
            }
            
            // Create a minimal invoice record for manual processing
            const now = new Date(Math.floor(Date.now() / 1000) * 1000);
            const manualProcessingInvoice: StoredInvoice = {
              id: invoiceId,
              invoiceDataUri: filePath,
              status: 'Review',
              requiresSpecialHandling: true,
              specialHandlingReason: 'other',
              comment: `Document has ${pageCount} pages (exceeds limit of ${maxPages}). Requires manual processing.`,
              caseNumber: options?.caseNumber || undefined,
              documentID: options?.documentID,
              description: options?.description ? { value: options.description, confidence: 1.0, reasoning: 'From SmartAdvocate API', bbox: null } : undefined,
              // Required ExtractedDataOnly fields with null values
              invoiceNumber: null,
              invoiceDate: null,
              vendorName: null,
              vendorAddress: null,
              amount: null,
              clientName: null,
              createdAt: now,
              updatedAt: now,
              ...(options?.smartAdvocateMetadata || {}),
            };
            
            // Generate document hash if documentID is provided
            if (options?.documentID !== undefined) {
              manualProcessingInvoice.documentHash = generateDocumentHash(options.documentID, options.caseNumber);
            }
            
            // Save to database
            await upsertInvoice(manualProcessingInvoice);
            
            return { 
              data: manualProcessingInvoice,
              error: `Document has ${pageCount} pages, exceeding the limit of ${maxPages}. Document saved for manual processing.`
            };
          }
          
          // If within limit, convert PDF to image for AI processing
          console.log('Converting PDF to image...');
          invoiceDataUri = await convertPdfToImageServer(invoiceDataUri);
          console.log('PDF converted to image successfully');
        } catch (conversionError) {
          const errorMessage = conversionError instanceof Error ? conversionError.message : 'Unknown error';
          return { 
            error: `Failed to convert PDF to image: ${errorMessage}` 
          };
        }
      }
      // For images (PNG, JPEG, etc.), validate size before processing
      else if (mimeType.startsWith('image/')) {
        // Validate data URI format
        const dataUriMatch = invoiceDataUri.match(/^data:([^;]+);base64,(.+)$/);
        if (!dataUriMatch || !dataUriMatch[2] || dataUriMatch[2].length === 0) {
          return { error: 'Invalid image data URI format. The image data is missing or corrupted.' };
        }
        
        // Check image size to prevent stack overflow (limit to 20MB base64 for images)
        const base64Data = dataUriMatch[2];
        const estimatedSize = (base64Data.length * 3) / 4; // Approximate binary size
        const maxImageSize = 20 * 1024 * 1024; // 20MB for images
        if (estimatedSize > maxImageSize) {
          return { error: `Image is too large (${Math.round(estimatedSize / 1024 / 1024)}MB). Maximum size is ${maxImageSize / 1024 / 1024}MB. Please compress the image or use a smaller file.` };
        }
        
        // Validate PNG/JPEG magic bytes to ensure it's a valid image
        try {
          const buffer = Buffer.from(base64Data, 'base64');
          if (buffer.length === 0) {
            return { error: 'Image data is empty. The file may be corrupted.' };
          }
          
          // Check for PNG signature (89 50 4E 47 0D 0A 1A 0A)
          const isPng = buffer.length >= 8 && 
            buffer[0] === 0x89 && buffer[1] === 0x50 && 
            buffer[2] === 0x4E && buffer[3] === 0x47 &&
            buffer[4] === 0x0D && buffer[5] === 0x0A &&
            buffer[6] === 0x1A && buffer[7] === 0x0A;
          
          // Check for JPEG signature (FF D8 FF)
          const isJpeg = buffer.length >= 3 && 
            buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
          
          // If it's supposed to be an image but doesn't have valid signatures, warn but continue
          if (!isPng && !isJpeg && mimeType.startsWith('image/')) {
            console.warn(`[Invoice Service] Image file may be corrupted or in unsupported format. MIME type: ${mimeType}`);
          }
        } catch (bufferError) {
          console.error('[Invoice Service] Error validating image buffer:', bufferError);
          return { error: 'Failed to validate image data. The file may be corrupted.' };
        }
      }
      
      // Validate data URI before AI extraction (for all file types)
      const dataUriMatch = invoiceDataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!dataUriMatch || !dataUriMatch[2] || dataUriMatch[2].length === 0) {
        return { error: 'Invalid document data URI format. The document data is missing or corrupted.' };
      }
      
      // Check data URI size to prevent stack overflow (limit to 50MB base64)
      const base64Data = dataUriMatch[2];
      const estimatedSize = (base64Data.length * 3) / 4; // Approximate binary size
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (estimatedSize > maxSize) {
        return { error: `Document is too large (${Math.round(estimatedSize / 1024 / 1024)}MB). Maximum size is ${maxSize / 1024 / 1024}MB.` };
      }
      
      // Extract invoice data using AI with error handling
      let data;
      try {
        data = await extractInvoiceData({ invoiceDataUri });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Invoice Service] AI extraction error:', errorMessage);
        
        // Handle specific error types
        if (errorMessage.includes('Maximum call stack size exceeded') || errorMessage.includes('stack overflow')) {
          return { error: 'Document processing failed due to size or complexity. Please try a smaller or simpler document.' };
        }
        if (errorMessage.includes('Schema validation') || errorMessage.includes('INVALID_ARGUMENT')) {
          return { error: 'AI extraction failed: Invalid document format. The document may be corrupted or in an unsupported format.' };
        }
        
        return { error: `AI extraction failed: ${errorMessage}` };
      }

      // Validate that we extracted some data
      const hasExtractedData = Object.values(data).some(value => {
        if (value === null || typeof value !== 'object') return false;
        if ('isDuplicate' in value || 'duplicateReason' in value) return false;
        return 'value' in value && (value as { value: unknown }).value !== undefined && (value as { value: unknown }).value !== null;
      });

      if (!hasExtractedData) {
        return { error: 'The AI could not extract any information from the document. Please try a different file.' };
      }

      // Calculate overall confidence and determine status
      const overallConfidence = getOverallConfidence(data as unknown as StoredInvoice);
      // Get status from extraction (which may include external systems check)
      // The extraction flow should return a status, but if not, we need to determine it
      // Default to 'Review' initially (matching extraction flow default), then adjust based on conditions
      let status: StoredInvoice['status'] = data.status || 'Review';

      // Extract amount for high-value check
      const invoiceAmount = parseInvoiceAmount(data.totalAmount?.value);

      // Check for high-value escalation
      let isHighValue = false;
      let requiresEscalation = false;
      let escalationLevel: 'standard' | 'high' | 'critical' | undefined;
      let highValueReason: string | undefined;

      // Preserve 'Paid' status from external systems - don't override it
      const isPaid = status === 'Paid';

      if (invoiceAmount >= HIGH_VALUE_THRESHOLDS.CRITICAL) {
        isHighValue = true;
        requiresEscalation = true;
        escalationLevel = 'critical';
        highValueReason = `Invoice amount ($${invoiceAmount.toLocaleString()}) exceeds critical threshold ($${HIGH_VALUE_THRESHOLDS.CRITICAL.toLocaleString()}). Requires executive approval.`;
        // Only override to Review if not already Paid
        if (!isPaid) {
          status = 'Review'; // Force to Review for critical amounts
        }
      } else if (invoiceAmount >= HIGH_VALUE_THRESHOLDS.HIGH) {
        isHighValue = true;
        requiresEscalation = true;
        escalationLevel = 'high';
        highValueReason = `Invoice amount ($${invoiceAmount.toLocaleString()}) exceeds high threshold ($${HIGH_VALUE_THRESHOLDS.HIGH.toLocaleString()}). Requires manager approval.`;
        // Only override to Review if not already Paid
        if (!isPaid) {
          status = 'Review'; // Force to Review for high amounts
        }
      } else if (invoiceAmount >= HIGH_VALUE_THRESHOLDS.STANDARD) {
        isHighValue = true;
        requiresEscalation = true;
        escalationLevel = 'standard';
        highValueReason = `Invoice amount ($${invoiceAmount.toLocaleString()}) exceeds standard threshold ($${HIGH_VALUE_THRESHOLDS.STANDARD.toLocaleString()}). Requires review.`;
        // Don't force status, but ensure it's at least Pending (unless already Paid)
        if (status === 'Draft' && !isPaid) {
          status = 'Pending';
        }
      }

      // If confidence is low, force it to 'Review' (unless already Paid or escalated for high value)
      if (overallConfidence < CONFIDENCE_THRESHOLDS.LOW && !requiresEscalation && !isPaid) {
        status = 'Review';
      }

      // Extract duplicateCheck and documentType before creating the invoice
      const { duplicateCheck, documentType: documentTypeField, ...dataWithoutDuplicateCheck } = data;
      
      // Generate invoice ID from invoice number, sanitizing it for safe use in URLs
      const rawInvoiceId = data.invoiceNumber?.value || `INV-${Date.now()}`;
      const invoiceId = sanitizeId(rawInvoiceId);
      
      // Save the file to disk (use sanitized ID for filename)
      let filePath: string;
      try {
        filePath = await saveInvoiceFile(input.invoiceDataUri, invoiceId);
      } catch (fileError) {
        filePath = input.invoiceDataUri;
      }
      
      // Extract document type
      const documentType = documentTypeField?.value || undefined;
      
      // Analyze for recurring bill pattern and amount anomalies
      let recurringAnalysis = null;
      const vendorName = data.vendorName?.value;
      const invoiceDate = data.invoiceDate?.value || '';

      if (vendorName && invoiceAmount > 0 && invoiceDate) {
        try {
          recurringAnalysis = await analyzeRecurringBill(vendorName, invoiceAmount, invoiceDate);
        } catch (error) {
          // Continue without recurring analysis if it fails
        }
      }

      // Check if vendor exists, if not, create pending vendor and flag for 1099 request
      let vendorRequires1099 = false;
      if (vendorName) {
        try {
          const vendorCheck = await vendorService.checkVendorExists(vendorName);
          if (!vendorCheck.exists) {
            vendorRequires1099 = true;
            // Check if pending vendor already exists for this invoice
            const existingPending = await findPendingVendorByInvoiceId(invoiceId);
            if (!existingPending) {
              // Create pending vendor record
              await createPendingVendor({
                name: vendorName,
                email: data.vendorAddress?.value || undefined,
                invoiceId: invoiceId,
                status: 'Pending',
              });
            }
          } else if (vendorCheck.requires1099) {
            vendorRequires1099 = true;
          }
        } catch (error) {
          // Continue processing even if vendor check fails
        }
      }
      
      // Auto-detect state from case number if provided
      let detectedState: 'CA' | 'NY' | undefined = undefined;
      const caseNumber = options?.caseNumber?.trim() || undefined;
      if (caseNumber) {
        const stateResult = stateDetectionService.detectState(caseNumber);
        detectedState = stateResult.state;
      }
      
      // Generate document hash if documentID is provided (for SmartAdvocate sync)
      let documentHash: string | undefined = undefined;
      const documentID = options?.documentID;
      if (documentID !== undefined) {
        documentHash = generateDocumentHash(documentID, caseNumber);
      }
      
      // Create final invoice object
      const now = new Date(Math.floor(Date.now() / 1000) * 1000);
      
      // Use description from options if provided, otherwise use extracted description
      const finalDescription = options?.description 
        ? { value: options.description, confidence: 1.0, reasoning: 'From SmartAdvocate API', bbox: null }
        : dataWithoutDuplicateCheck.description;
      
      const finalInvoice: StoredInvoice = {
        ...dataWithoutDuplicateCheck,
        id: invoiceId,
        invoiceDataUri: filePath,
        status: status,
        isDuplicate: duplicateCheck?.isDuplicate,
        duplicateReason: duplicateCheck?.reason,
        isRecurring: recurringAnalysis?.isRecurring,
        recurringPattern: recurringAnalysis?.recurringPattern,
        hasAmountAnomaly: recurringAnalysis?.hasAmountAnomaly,
        amountAnomalyReason: recurringAnalysis?.amountAnomalyReason,
        expectedAmount: recurringAnalysis?.expectedAmount,
        amountDeviationPercent: recurringAnalysis?.amountDeviationPercent,
        isHighValue,
        highValueReason,
        requiresEscalation,
        escalationLevel,
        documentType: documentType,
        vendorRequires1099: vendorRequires1099,
        caseNumber: caseNumber,
        state: detectedState,
        documentHash: documentHash,
        documentID: documentID,
        description: finalDescription,
        comment: options?.comment || undefined,
        // SmartAdvocate metadata fields
        ...(options?.smartAdvocateMetadata || {}),
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await upsertInvoice(finalInvoice);

      // Audit log: Invoice created
      await auditService.logInvoiceCreated('system', invoiceId, {
        invoiceNumber: data.invoiceNumber?.value,
        vendorName: data.vendorName?.value,
        amount: invoiceAmount,
        state: finalInvoice.state || undefined,
      });

      // If invoice requires escalation, log it
      if (requiresEscalation && escalationLevel) {
        await auditService.logInvoiceEscalated('system', invoiceId, {
          invoiceNumber: data.invoiceNumber?.value,
          vendorName: data.vendorName?.value,
          amount: invoiceAmount,
          escalationLevel,
          escalationReason: highValueReason || 'High value invoice',
        });
      }

      return { data: finalInvoice };
    } catch (error) {
      let message: string;
      if (error instanceof Error) {
        if (error.cause && typeof error.cause === 'object' && 'message' in error.cause && typeof error.cause.message === 'string') {
          message = error.cause.message;
        } else {
          message = error.message;
        }
      } else {
        message = 'Failed to process invoice. The AI model may be unavailable or the document could not be read.';
      }
      return { error: message };
    }
  }

  /**
   * Get all invoices
   * @param userPermissions Optional user permissions for state-based filtering
   */
  async getAllInvoices(userPermissions?: { role: string; assignedStates?: string[] }): Promise<StoredInvoice[]> {
    const allInvoices = await findAllInvoices();
    
    // Filter out invoices with excluded case number prefix
    const excludePrefix = process.env.EXCLUDE_CASE_NUMBER_PREFIX || 'TBF-';
    const filteredInvoices = allInvoices.filter(inv => {
      if (!inv.caseNumber) return true; // Include invoices without case numbers
      return !inv.caseNumber.startsWith(excludePrefix);
    });
    
    // Apply state-based filtering if user permissions are provided
    if (userPermissions) {
      return this.filterInvoicesByAccess(filteredInvoices, userPermissions);
    }
    
    return filteredInvoices;
  }

  /**
   * Filter invoices based on user permissions and state access
   */
  private filterInvoicesByAccess(
    invoices: StoredInvoice[],
    userPermissions: { role: string; assignedStates?: string[] }
  ): StoredInvoice[] {
    const { role, assignedStates } = userPermissions;

    // Elevated roles (admin, director, manager) have access to all states
    if (role === 'admin' || role === 'director' || role === 'manager') {
      return invoices;
    }

    // Senior Accountant has access to all states
    if (role === 'senior_accountant') {
      return invoices;
    }

    // NY Accountant - has access to NY by default, and other states if assigned
    if (role === 'ny_accountant') {
      // NY accountants can see invoices from other states if they appear in W9 requests
      // This ensures consistency: if an invoice is visible in W9, it's also visible in invoices list
      // W9 page shows invoices that require 1099/W9 tracking, regardless of state
      // So we include all invoices, but prioritize NY invoices
      const filtered = invoices.filter(inv => {
        const invoiceState = inv.state;
        if (invoiceState === 'NY') return true;
        // Include invoices with no state (null/undefined) - they may be legacy or uncategorized
        if (!invoiceState) return true;
        // Include invoices from other states if assigned
        if (assignedStates?.includes(invoiceState)) return true;
        // Include all other invoices to match W9 page behavior
        // This ensures invoices visible in W9 are also visible in invoices list
        return true;
      });
      
      return filtered;
    }

    // CA Accountant - has access to CA by default, and other states if assigned
    if (role === 'ca_accountant') {
      // CA accountants can see invoices from other states if they appear in W9 requests
      // This ensures consistency: if an invoice is visible in W9, it's also visible in invoices list
      // W9 page shows invoices that require 1099/W9 tracking, regardless of state
      // So we include all invoices, but prioritize CA invoices
      const filtered = invoices.filter(inv => {
        const invoiceState = inv.state;
        if (invoiceState === 'CA') return true;
        // Include invoices with no state (null/undefined) - they may be legacy or uncategorized
        if (!invoiceState) return true;
        // Include invoices from other states if assigned
        if (assignedStates?.includes(invoiceState)) return true;
        // Include all other invoices to match W9 page behavior
        // This ensures invoices visible in W9 are also visible in invoices list
        return true;
      });
      
      return filtered;
    }

    return invoices;
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string): Promise<StoredInvoice | undefined> {
    return await findInvoiceById(id);
  }

  /**
   * Update invoice status
   * Prevents approving invoices if vendor requires 1099/W9 and forms are not received/tracked
   * Also blocks approval if cumulative invoices in financial year cross $600 threshold
   */
  async updateStatus(id: string, status: StoredInvoice['status']): Promise<{ success: boolean; error?: string }> {
    // If approving (status = 'Pending'), check 1099/W9 requirements
    if (status === 'Pending') {
      const invoice = await findInvoiceById(id);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      // Skip W9 check for receipts - only applies to invoices
      if (invoice.documentType === 'Receipt') {
        await updateInvoiceStatus(id, status);
        return { success: true };
      }

      // Only check W9 requirements for Invoice document types
      if (invoice.documentType && invoice.documentType !== 'Invoice') {
        await updateInvoiceStatus(id, status);
        return { success: true };
      }

      const vendorName = invoice.vendorName?.value;
      if (vendorName) {
        // Check if vendor requires 1099/W9
        const vendor = await findVendorByName(vendorName);
        
        // Check if W9 is received or tax ID exists
        const hasW9Received = vendor?.w9Status === 'Received';
        const hasTaxId = vendor?.taxId && vendor.taxId.trim() !== '';
        const noNeedToTrack = hasW9Received || hasTaxId;
        
        // Check threshold for ALL vendors (in list or not) if they don't have W9/tax ID
        // Only skip check if vendor has W9 received or tax ID
        if (!noNeedToTrack) {
          // Get financial year from invoice date
          const invoiceDate = typeof invoice.invoiceDate === 'object' && invoice.invoiceDate?.value 
            ? invoice.invoiceDate.value 
            : invoice.invoiceDate;
          
          let financialYear: number | null = null;
          if (invoiceDate) {
            try {
              const date = new Date(invoiceDate);
              if (!isNaN(date.getTime())) {
                financialYear = date.getFullYear();
              }
            } catch {
              // Invalid date, continue without financial year check
            }
          }
          
          // If we have a financial year, check cumulative total
          let cumulativeTotal: number | null = null;
          if (financialYear !== null) {
            // Get all invoices for this vendor in the same financial year (only Invoice document types)
            const vendorInvoices = await findInvoicesByVendorName(vendorName);
            const invoicesInSameYear = vendorInvoices.filter(inv => {
              // Only count Invoice document types (exclude receipts)
              if (inv.documentType === 'Receipt') return false;
              if (inv.documentType && inv.documentType !== 'Invoice') return false;
              
              // Get financial year from invoice date
              const invDate = typeof inv.invoiceDate === 'object' && inv.invoiceDate?.value 
                ? inv.invoiceDate.value 
                : inv.invoiceDate;
              
              if (!invDate) return false;
              
              try {
                const date = new Date(invDate);
                if (isNaN(date.getTime())) return false;
                return date.getFullYear() === financialYear;
              } catch {
                return false;
              }
            });
            
            // Calculate cumulative total including current invoice
            const currentInvoiceAmount = parseInvoiceAmount(
              invoice.totalAmount?.value || invoice.amount?.value
            );
            
            cumulativeTotal = invoicesInSameYear.reduce((sum, inv) => {
              // Don't double-count the current invoice if it's already in the list
              if (inv.id === invoice.id) {
                return sum;
              }
              const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
              return sum + (amount || 0);
            }, 0) + currentInvoiceAmount;
            
            // If cumulative total crosses $600, block approval
            if (cumulativeTotal >= 600) {
              return {
                success: false,
                error: `Cannot approve invoice. Vendor "${vendorName}" has cumulative invoices totaling $${cumulativeTotal.toFixed(2)} in ${financialYear}, which exceeds the $600 threshold. Please ensure W9 form is received or tax ID is added before approving invoices.`
              };
            }
          }
          
          // Also check if 1099/W9 is received or tracked (legacy check for cases without financial year)
          // Only apply this check if vendor is in list and we didn't already check the threshold
          if (vendor && cumulativeTotal === null) {
            const form1099Status = vendor.form1099Status;
            const w9Status = vendor.w9Status;
            
            const canProcess = 
              form1099Status === 'Received' || 
              form1099Status === 'Tracked' ||
              w9Status === 'Received';
            
            if (!canProcess) {
              return {
                success: false,
                error: `Cannot approve invoice. Vendor "${vendorName}" requires 1099/W9 forms. Please mark the forms as Received or Tracked in the W9 Requests page before approving invoices.`
              };
            }
          }
        }
      }
    }

    await updateInvoiceStatus(id, status);
    return { success: true };
  }

  /**
   * Check for duplicate invoice
   * If caseNumber is provided, only checks for duplicates within that case
   */
  async checkDuplicate(invoiceNumber: string, vendorName: string, invoiceDate: string, caseNumber?: string | null) {
    return await checkForDuplicateInvoice(invoiceNumber, vendorName, invoiceDate, undefined, caseNumber);
  }

  /**
   * Add comment to invoice
   */
  async addComment(id: string, comment: string): Promise<void> {
    await initDb();
    const db = getDb();
    
    await db
      .update(invoices)
      .set({
        comment,
        updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
      })
      .where(eq(invoices.id, id));
  }

  /**
   * Update case number
   * Saves the case number and auto-detects state
   * Does NOT overwrite AI-extracted plaintiff names - case info is fetched separately by frontend
   * Re-checks for duplicates within the case when case number is set
   */
  async updateCaseNumber(id: string, caseNumber: string | undefined): Promise<void> {
    try {
      await initDb();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error('Database connection failed');
    }

    const db = getDb();

    // Get the invoice to verify it exists
    const invoice = await findInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Normalize case number (trim whitespace, convert empty string to undefined)
    const normalizedCaseNumber = caseNumber?.trim() || undefined;

    // Auto-detect state based on case number
    let detectedState: 'CA' | 'NY' | null = null;
    if (normalizedCaseNumber) {
      const stateResult = stateDetectionService.detectState(normalizedCaseNumber);
      detectedState = stateResult.state;
    }

    // Re-check for duplicates within the case if case number is provided
    let duplicateCheckResult: { isDuplicate: boolean; duplicateReason?: string } | null = null;
    if (normalizedCaseNumber) {
      const invoiceNumber = typeof invoice.invoiceNumber === 'object' && invoice.invoiceNumber !== null
        ? invoice.invoiceNumber.value
        : invoice.invoiceNumber;
      const vendorName = typeof invoice.vendorName === 'object' && invoice.vendorName !== null
        ? invoice.vendorName.value
        : invoice.vendorName;
      const invoiceDate = typeof invoice.invoiceDate === 'object' && invoice.invoiceDate !== null
        ? invoice.invoiceDate.value
        : invoice.invoiceDate;

      if (invoiceNumber && vendorName && invoiceDate) {
        const duplicate = await checkForDuplicateInvoice(
          invoiceNumber,
          vendorName,
          invoiceDate,
          id, // Exclude current invoice
          normalizedCaseNumber // Only check within this case
        );

        if (duplicate) {
          // Build duplicate reason
          const reasonParts = [];
          const duplicateInvoiceNumber = typeof duplicate.invoiceNumber === 'object' && duplicate.invoiceNumber !== null
            ? duplicate.invoiceNumber.value
            : duplicate.invoiceNumber;
          const duplicateVendorName = typeof duplicate.vendorName === 'object' && duplicate.vendorName !== null
            ? duplicate.vendorName.value
            : duplicate.vendorName;
          const duplicateInvoiceDate = typeof duplicate.invoiceDate === 'object' && duplicate.invoiceDate !== null
            ? duplicate.invoiceDate.value
            : duplicate.invoiceDate;

          if (duplicateInvoiceNumber && duplicateInvoiceNumber === invoiceNumber) {
            reasonParts.push(`Invoice number ${duplicateInvoiceNumber}`);
          }
          if (duplicateVendorName && duplicateVendorName === vendorName) {
            reasonParts.push(`vendor ${duplicateVendorName}`);
          }
          if (duplicateInvoiceDate && duplicateInvoiceDate === invoiceDate) {
            reasonParts.push(`date ${duplicateInvoiceDate}`);
          }

          // Check if the original duplicate invoice has been approved and pushed to CRM
          const originalIsApprovedAndPushed = isApprovedAndPushedToCrm(duplicate);
          
          let duplicateReason = reasonParts.length > 0
            ? `Duplicate found: matching ${reasonParts.join(', ')}`
            : `Duplicate invoice found`;
          
          // Add case number if available
          if (normalizedCaseNumber) {
            duplicateReason += ` (within case ${normalizedCaseNumber})`;
          }
          
          // Add information about the original invoice status
          if (originalIsApprovedAndPushed) {
            duplicateReason += `. Original invoice has been approved and pushed to CRM`;
          } else {
            duplicateReason += `. Original invoice is not yet approved/pushed to CRM`;
          }

          duplicateCheckResult = {
            isDuplicate: true,
            duplicateReason
          };
        } else {
          // No duplicate found within the case
          duplicateCheckResult = { isDuplicate: false };
        }
      }
    }

    // Prepare update data - update case number, state, and duplicate status if re-checked
    const updateData: any = {
      caseNumber: normalizedCaseNumber || null,
      state: detectedState,
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };

    // Update duplicate status if we re-checked
    if (duplicateCheckResult !== null) {
      updateData.isDuplicate = duplicateCheckResult.isDuplicate;
      updateData.duplicateReason = duplicateCheckResult.duplicateReason || null;
    }

    try {
      await db
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, id));
    } catch (error) {
      console.error('Database update error:', error);
      console.error('Update data:', JSON.stringify(updateData, null, 2));
      throw new Error(`Failed to update invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update plaintiff name
   * Stores the plaintiff name from case lookup
   */
  async updatePlaintiffName(id: string, plaintiffName: string | undefined): Promise<void> {
    try {
      await initDb();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error('Database connection failed');
    }

    const db = getDb();

    // Get the invoice to verify it exists
    const invoice = await findInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Normalize plaintiff name (trim whitespace, convert empty string to undefined)
    const normalizedPlaintiffName = plaintiffName?.trim() || undefined;

    // Update the invoice
    await db
      .update(invoices)
      .set({
        plaintiffName: normalizedPlaintiffName || null,
        updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
      })
      .where(eq(invoices.id, id));
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();

