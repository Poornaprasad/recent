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
import { fetchCaseInfo, extractPlaintiffName } from './case-info.service';
import type { ExtractedField } from '../domain/types';
import { serializeMeta } from '../repositories/mappers/invoice.mapper';

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
   */
  async updateStatus(id: string, status: StoredInvoice['status']): Promise<{ success: boolean; error?: string }> {
    // If approving (status = 'Pending'), check 1099/W9 requirements
    if (status === 'Pending') {
      const invoice = await findInvoiceById(id);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      const vendorName = invoice.vendorName?.value;
      if (vendorName) {
        // Check if vendor requires 1099/W9
        const vendor = await findVendorByName(vendorName);
        
        if (vendor && vendor.requires1099) {
          // Check if 1099/W9 is received or tracked
          const form1099Status = vendor.form1099Status;
          const w9Status = vendor.w9Status;
          
          const canProcess = 
            form1099Status === 'Received' || 
            form1099Status === 'Tracked' ||
            w9Status === 'Received';
          
          if (!canProcess) {
            return {
              success: false,
              error: `Cannot approve invoice. Vendor "${vendorName}" requires 1099/W9 forms. Please mark the forms as Received or Tracked in the 1099 Requests page before approving invoices.`
            };
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
   * Fetches case info from SmartAdvocate API and updates plaintiff name
   * Validates that case number is provided when plaintiff name (clientName/customerName) is present
   * Auto-sets state based on case number (CA if contains CA, otherwise NY)
   */
  async updateCaseNumber(id: string, caseNumber: string | undefined): Promise<void> {
    try {
      await initDb();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error('Database connection failed');
    }
    
    const db = getDb();
    
    // Get the invoice to check for plaintiff name
    const invoice = await findInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    // Normalize case number (trim whitespace, convert empty string to undefined)
    const normalizedCaseNumber = caseNumber?.trim() || undefined;
    
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
    
    // Helper to create ExtractedField from string value
    const createExtractedField = (value: string | null): ExtractedField<string> | null => {
      if (!value || value.trim() === '') return null;
      return {
        value: value.trim(),
        confidence: 1.0, // High confidence since it's from API
        reasoning: 'Fetched from SmartAdvocate Case Info API',
      };
    };
    
    // Fetch case info from API if case number is provided
    let plaintiffNameFromApi: string | null = null;
    let updatedClientName: ExtractedField<string> | null = invoice.clientName;
    let updatedCustomerName: ExtractedField<string> | null = invoice.customerName;
    
    if (normalizedCaseNumber && normalizedCaseNumber !== '') {
      try {
        const caseInfo = await fetchCaseInfo(normalizedCaseNumber);
        if (caseInfo) {
          plaintiffNameFromApi = extractPlaintiffName(caseInfo);
          
          // Update plaintiff name if fetched from API
          // Prefer updating customerName, but also set clientName if customerName doesn't exist
          if (plaintiffNameFromApi) {
            const existingCustomerName = extractValue(invoice.customerName);
            const existingClientName = extractValue(invoice.clientName);
            
            // If neither exists, set customerName (preferred field)
            if (!existingCustomerName && !existingClientName) {
              updatedCustomerName = createExtractedField(plaintiffNameFromApi);
            }
            // If customerName exists but clientName doesn't, also set clientName
            else if (existingCustomerName && !existingClientName) {
              updatedClientName = createExtractedField(plaintiffNameFromApi);
            }
            // If customerName doesn't exist but clientName does, update customerName
            else if (!existingCustomerName && existingClientName) {
              updatedCustomerName = createExtractedField(plaintiffNameFromApi);
            }
            // If both exist, update customerName (preferred field)
            else {
              updatedCustomerName = createExtractedField(plaintiffNameFromApi);
            }
          }
        }
      } catch (error) {
        // Log error but don't fail the update - case number can still be saved
        console.error('Error fetching case info from API:', error);
        // Continue with the update even if API call fails
      }
    }
    
    // Check if plaintiff name (clientName or customerName) is present after potential API update
    const plaintiffNameValue = extractValue(updatedClientName) || extractValue(updatedCustomerName);
    const hasPlaintiffName = plaintiffNameValue !== null && plaintiffNameValue !== '';
    
    // Validate: case number is mandatory when plaintiff name is present
    if (hasPlaintiffName && !normalizedCaseNumber) {
      throw new Error('Case number is required when plaintiff name is present');
    }
    
    // Auto-detect state based on case number
    let detectedState: 'CA' | 'NY' | null = null;
    if (normalizedCaseNumber) {
      const stateResult = stateDetectionService.detectState(normalizedCaseNumber);
      detectedState = stateResult.state;
    }
    
    // Prepare update data
    const updateData: any = {
      caseNumber: normalizedCaseNumber || null,
      state: detectedState,
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };
    
    // Update plaintiff name fields if they were fetched from API
    if (plaintiffNameFromApi) {
      // Check if customerName needs updating (compare values, not object references)
      const currentCustomerName = extractValue(invoice.customerName);
      const newCustomerName = extractValue(updatedCustomerName);
      if (newCustomerName && newCustomerName !== currentCustomerName) {
        updateData.customerName = newCustomerName;
        try {
          updateData.customerNameMeta = serializeMeta(updatedCustomerName);
        } catch (error) {
          console.error('Error serializing customerName metadata:', error);
          updateData.customerNameMeta = null;
        }
      }
      
      // Check if clientName needs updating (compare values, not object references)
      const currentClientName = extractValue(invoice.clientName);
      const newClientName = extractValue(updatedClientName);
      if (newClientName && newClientName !== currentClientName) {
        updateData.clientName = newClientName;
        try {
          updateData.clientNameMeta = serializeMeta(updatedClientName);
        } catch (error) {
          console.error('Error serializing clientName metadata:', error);
          updateData.clientNameMeta = null;
        }
      }
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
}

// Export singleton instance
export const invoiceService = new InvoiceService();

