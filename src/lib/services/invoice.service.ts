/**
 * Invoice service
 * Business logic layer for invoice operations
 */

import 'server-only';

import { extractInvoiceData, type ExtractInvoiceDataInput } from '@/ai/flows/extract-invoice-data';
import { findAllInvoices, findInvoiceById, upsertInvoice, updateInvoiceStatus, checkForDuplicateInvoice } from '../repositories/invoice.repository';
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
   * @param userPermissions Optional user permissions for state-based filtering
   */
  async getAllInvoices(userPermissions?: { role: string; assignedStates?: string[] }): Promise<StoredInvoice[]> {
    const allInvoices = await findAllInvoices();
    
    // Apply state-based filtering if user permissions are provided
    if (userPermissions) {
      return this.filterInvoicesByAccess(allInvoices, userPermissions);
    }
    
    return allInvoices;
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
      return invoices.filter(inv => {
        const invoiceState = inv.state;
        if (invoiceState === 'NY') return true;
        return invoiceState && assignedStates?.includes(invoiceState);
      });
    }

    // CA Accountant - has access to CA by default, and other states if assigned
    if (role === 'ca_accountant') {
      return invoices.filter(inv => {
        const invoiceState = inv.state;
        if (invoiceState === 'CA') return true;
        return invoiceState && assignedStates?.includes(invoiceState);
      });
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
        
        // If vendor requires 1099/W9 and W9 is not received/tax ID doesn't exist, check threshold
        if (vendor && vendor.requires1099 && !noNeedToTrack) {
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
          // Only apply this check if we didn't already check the threshold
          if (cumulativeTotal === null) {
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
   * Saves the case number and auto-detects state
   * Does NOT overwrite AI-extracted plaintiff names - case info is fetched separately by frontend
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

    // Prepare update data - only update case number and state
    // Do NOT overwrite AI-extracted clientName/customerName
    const updateData: any = {
      caseNumber: normalizedCaseNumber || null,
      state: detectedState,
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };

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
}

// Export singleton instance
export const invoiceService = new InvoiceService();

