/**
 * Invoice service
 * Business logic layer for invoice operations
 */

import 'server-only';

import { extractInvoiceData, type ExtractInvoiceDataInput } from '@/ai/flows/extract-invoice-data';
import { findAllInvoices, findInvoiceById, upsertInvoice, updateInvoiceStatus, checkForDuplicateInvoice } from '../repositories/invoice.repository';
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

export class InvoiceService {
  /**
   * Process and save a new invoice
   */
  async processInvoice(input: ExtractInvoiceDataInput): Promise<{ data?: StoredInvoice; error?: string }> {
    try {
      // Validate file type
      const mimeType = input.invoiceDataUri.split(';')[0].split(':')[1];
      if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
        return { error: 'Invalid file type. Please upload an image or a PDF.' };
      }
      
      // PDFs should already be converted to images on the client side
      if (mimeType === 'application/pdf') {
        return { 
          error: 'PDF files must be converted to images on the client side. Please try uploading the PDF again or convert it to an image first.' 
        };
      }
      
      // Extract invoice data using AI
      const data = await extractInvoiceData({ invoiceDataUri: input.invoiceDataUri });

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
      let status: StoredInvoice['status'] = data.status || 'Pending';

      // Extract amount for high-value check
      const invoiceAmount = parseInvoiceAmount(data.totalAmount?.value);

      // Check for high-value escalation
      let isHighValue = false;
      let requiresEscalation = false;
      let escalationLevel: 'standard' | 'high' | 'critical' | undefined;
      let highValueReason: string | undefined;

      if (invoiceAmount >= HIGH_VALUE_THRESHOLDS.CRITICAL) {
        isHighValue = true;
        requiresEscalation = true;
        escalationLevel = 'critical';
        highValueReason = `Invoice amount ($${invoiceAmount.toLocaleString()}) exceeds critical threshold ($${HIGH_VALUE_THRESHOLDS.CRITICAL.toLocaleString()}). Requires executive approval.`;
        status = 'Review'; // Force to Review for critical amounts
      } else if (invoiceAmount >= HIGH_VALUE_THRESHOLDS.HIGH) {
        isHighValue = true;
        requiresEscalation = true;
        escalationLevel = 'high';
        highValueReason = `Invoice amount ($${invoiceAmount.toLocaleString()}) exceeds high threshold ($${HIGH_VALUE_THRESHOLDS.HIGH.toLocaleString()}). Requires manager approval.`;
        status = 'Review'; // Force to Review for high amounts
      } else if (invoiceAmount >= HIGH_VALUE_THRESHOLDS.STANDARD) {
        isHighValue = true;
        requiresEscalation = true;
        escalationLevel = 'standard';
        highValueReason = `Invoice amount ($${invoiceAmount.toLocaleString()}) exceeds standard threshold ($${HIGH_VALUE_THRESHOLDS.STANDARD.toLocaleString()}). Requires review.`;
        // Don't force status, but ensure it's at least Pending
        if (status === 'Draft') {
          status = 'Pending';
        }
      }

      // If confidence is low, force it to 'Review' (unless already escalated for high value)
      if (overallConfidence < CONFIDENCE_THRESHOLDS.LOW && !requiresEscalation) {
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
      
      // Create final invoice object
      const now = new Date(Math.floor(Date.now() / 1000) * 1000);
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
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await upsertInvoice(finalInvoice);

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
   */
  async getAllInvoices(): Promise<StoredInvoice[]> {
    return await findAllInvoices();
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string): Promise<StoredInvoice | undefined> {
    return await findInvoiceById(id);
  }

  /**
   * Update invoice status
   */
  async updateStatus(id: string, status: StoredInvoice['status']): Promise<void> {
    await updateInvoiceStatus(id, status);
  }

  /**
   * Check for duplicate invoice
   */
  async checkDuplicate(invoiceNumber: string, vendorName: string, invoiceDate: string) {
    return await checkForDuplicateInvoice(invoiceNumber, vendorName, invoiceDate);
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
   * Validates that case number is provided when plaintiff name (clientName/customerName) is present
   * Auto-sets state based on case number (CA if contains CA, otherwise NY)
   */
  async updateCaseNumber(id: string, caseNumber: string | undefined): Promise<void> {
    await initDb();
    const db = getDb();
    
    // Get the invoice to check for plaintiff name
    const invoice = await findInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    // Check if plaintiff name (clientName or customerName) is present
    // Helper to extract value from ExtractedField or string
    const extractValue = (field: any): string | null => {
      if (!field) return null;
      if (typeof field === 'string') return field.trim() || null;
      if (typeof field === 'object' && field !== null && 'value' in field) {
        const val = field.value;
        if (typeof val === 'string') return val.trim() || null;
      }
      return null;
    };
    
    const plaintiffNameValue = extractValue(invoice.clientName) || extractValue(invoice.customerName);
    const hasPlaintiffName = plaintiffNameValue !== null && plaintiffNameValue !== '';
    
    // Validate: case number is mandatory when plaintiff name is present
    if (hasPlaintiffName && (!caseNumber || caseNumber.trim() === '')) {
      throw new Error('Case number is required when plaintiff name is present');
    }
    
    // Auto-detect state based on case number
    let detectedState: 'CA' | 'NY' | null = null;
    if (caseNumber && caseNumber.trim() !== '') {
      const stateResult = stateDetectionService.detectState(caseNumber);
      detectedState = stateResult.state;
    }
    
    await db
      .update(invoices)
      .set({
        caseNumber: caseNumber || null,
        state: detectedState,
        updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
      })
      .where(eq(invoices.id, id));
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();

