/**
 * Invoice service (Script-Compatible)
 * This file does NOT import 'server-only' to allow use in Node.js scripts
 * Business logic layer for invoice operations
 */

import { extractInvoiceData, type ExtractInvoiceDataInput } from '@/ai/flows/extract-invoice-data';
import { getOverallConfidence, parseInvoiceAmount } from '../utils/invoice-utils';
import { sanitizeId } from '../utils/id-utils';
import { CONFIDENCE_THRESHOLDS, HIGH_VALUE_THRESHOLDS } from '../domain/constants';
import type { StoredInvoice } from '../domain/types';
import { convertPdfToImageServer } from '../pdf-to-image-server';

// Use direct database access for scripts (bypassing 'server-only' repositories)
// Import the database connection from script-compatible module
import { getDb } from '../db/script';
import { invoices } from '../db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

// Inline file storage functions (script-compatible, no 'server-only')
import { promises as fs } from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';

// Inline storage config (avoiding 'server-only' import)
const STORAGE_CONFIG = {
  uploadsDir: './data/uploads',
  dataDir: './data',
  maxFileSize: 10 * 1024 * 1024, // 10MB
} as const;

const UPLOADS_DIR = path.join(process.cwd(), STORAGE_CONFIG.uploadsDir.replace('./', ''));

async function ensureDirectoriesExist(): Promise<void> {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
}

function dataUriToBuffer(dataUri: string): { buffer: Buffer; mimeType: string; extension: string } {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URI format');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  let extension = '.png';
  if (mimeType.includes('pdf')) {
    extension = '.pdf';
  } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    extension = '.jpg';
  } else if (mimeType.includes('png')) {
    extension = '.png';
  } else if (mimeType.includes('heic')) {
    extension = '.heic';
  }

  return { buffer, mimeType, extension };
}

function sanitizeFilename(str: string): string {
  return str
    .replace(/[\/\\<>:"|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function saveInvoiceFile(dataUri: string, invoiceId: string): Promise<string> {
  await ensureDirectoriesExist();

  const { buffer, extension } = dataUriToBuffer(dataUri);
  
  const sanitizedId = sanitizeFilename(invoiceId);
  
  const timestamp = Date.now();
  const filename = `${sanitizedId}-${timestamp}${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.writeFile(filePath, buffer);

  return `/uploads/${filename}`;
}

// Inline recurring bill analysis (script-compatible, no 'server-only')
interface RecurringBillAnalysis {
  isRecurring: boolean;
  recurringPattern?: string;
  hasAmountAnomaly: boolean;
  amountAnomalyReason?: string;
  expectedAmount?: number;
  amountDeviationPercent?: number;
  historicalCount: number;
  averageAmount: number;
  medianAmount: number;
  minAmount: number;
  maxAmount: number;
}

async function analyzeRecurringBill(
  vendorName: string,
  currentAmount: number,
  currentDate: string
): Promise<RecurringBillAnalysis> {
  const db = getDb();

  // Get historical invoices from the same vendor within the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twelveMonthsAgoTimestamp = Math.floor(twelveMonthsAgo.getTime() / 1000);

  const historicalInvoices = await db
    .select({
      totalAmount: invoices.totalAmount,
      invoiceDate: invoices.invoiceDate,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.vendorName, vendorName),
        gte(invoices.createdAt, sql`${twelveMonthsAgoTimestamp}`)
      )
    )
    .orderBy(desc(invoices.invoiceDate))
    .then(rows => 
      rows
        .filter(row => row.totalAmount !== null && row.totalAmount !== undefined)
        .map(row => ({
          amount: Number(row.totalAmount),
          date: row.invoiceDate,
          createdAt: row.createdAt,
        }))
    );

  // Need at least 2 historical invoices to establish a pattern
  if (historicalInvoices.length < 2) {
    return {
      isRecurring: false,
      hasAmountAnomaly: false,
      historicalCount: historicalInvoices.length,
      averageAmount: currentAmount,
      medianAmount: currentAmount,
      minAmount: currentAmount,
      maxAmount: currentAmount,
    };
  }

  // Calculate statistics
  const amounts = historicalInvoices.map(inv => inv.amount);
  const averageAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
  const sortedAmounts = [...amounts].sort((a, b) => a - b);
  const medianAmount = sortedAmounts.length % 2 === 0
    ? (sortedAmounts[sortedAmounts.length / 2 - 1] + sortedAmounts[sortedAmounts.length / 2]) / 2
    : sortedAmounts[Math.floor(sortedAmounts.length / 2)];
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);

  // Simple recurring pattern detection (simplified for script)
  const isRecurring = historicalInvoices.length >= 2;
  const recurringPattern = isRecurring ? 'Monthly' : undefined;

  // Calculate expected amount (use median for robustness against outliers)
  const expectedAmount = medianAmount;

  // Detect amount anomaly
  // Flag if current amount deviates by more than 15% from expected (or more than $50 difference for small amounts)
  const deviation = Math.abs(currentAmount - expectedAmount);
  const deviationPercent = expectedAmount > 0 ? (deviation / expectedAmount) * 100 : 0;
  const hasAmountAnomaly = deviationPercent > 15 || (deviation > 50 && expectedAmount < 500);
  const amountAnomalyReason = hasAmountAnomaly
    ? `Amount deviates ${deviationPercent.toFixed(1)}% from expected $${expectedAmount.toFixed(2)} (historical median)`
    : undefined;

  return {
    isRecurring,
    recurringPattern,
    hasAmountAnomaly,
    amountAnomalyReason,
    expectedAmount,
    amountDeviationPercent: deviationPercent,
    historicalCount: historicalInvoices.length,
    averageAmount,
    medianAmount,
    minAmount,
    maxAmount,
  };
}

// Re-export the invoice service class methods as standalone functions for script usage
// This is a simplified version that can be used in scripts

/**
 * Process and save a new invoice (script-compatible version)
 * This is a wrapper around the invoice service that can be used in Node.js scripts
 */
export async function processInvoice(
  input: ExtractInvoiceDataInput,
  options?: { caseNumber?: string }
): Promise<{ data?: StoredInvoice; error?: string }> {
  try {
    // Validate file type
    let invoiceDataUri = input.invoiceDataUri;
    const mimeType = invoiceDataUri.split(';')[0].split(':')[1];
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      return { error: 'Invalid file type. Please upload an image or a PDF.' };
    }
    
    // Convert PDFs to images before processing (AI model only accepts images)
    if (mimeType === 'application/pdf') {
      try {
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
    
    // Extract invoice data using AI
    const data = await extractInvoiceData({ invoiceDataUri });

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
      
      // Simple duplicate check (simplified for script)
      let duplicateResult = duplicateCheck;
      if (!duplicateResult) {
        // Basic duplicate check - just check if invoice number exists
        try {
          const db = getDb();
          const existing = await db
            .select()
            .from(invoices)
            .where(eq(invoices.id, invoiceId))
            .limit(1);
          
          if (existing.length > 0) {
            duplicateResult = {
              isDuplicate: true,
              reason: 'Invoice with same ID already exists',
            };
          }
        } catch (error) {
          // Continue if duplicate check fails
        }
      }
    
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

    // Check if vendor exists (simplified for script - just flag for 1099)
    let vendorRequires1099 = false;
    // Note: Full vendor checking and pending vendor creation is skipped in script mode
    // This can be added later if needed

    // Auto-detect state from case number if provided
    let detectedState: 'CA' | 'NY' | undefined = undefined;
    const caseNumber = options?.caseNumber?.trim() || undefined;
    if (caseNumber) {
      // Inline state detection logic (since stateDetectionService uses 'server-only')
      const caseNumberUpper = caseNumber.toUpperCase();
      if (caseNumberUpper.includes('CA')) {
        detectedState = 'CA';
      } else {
        detectedState = 'NY'; // Default to NY if case number doesn't contain CA
      }
    }

    // Create final invoice object
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const finalInvoice: StoredInvoice = {
      ...dataWithoutDuplicateCheck,
      id: invoiceId,
      invoiceDataUri: filePath,
      status: status,
      isDuplicate: duplicateResult?.isDuplicate,
      duplicateReason: duplicateResult?.reason,
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
      createdAt: now,
      updatedAt: now,
    };

    // Save to database using direct DB access
    const db = getDb();
    
    // Helper to extract value from ExtractedField
    const extractValue = (field: any) => field?.value ?? null;
    
    // Helper to serialize metadata
    const serializeMeta = (field: any): string | null => {
      if (!field || typeof field !== 'object') return null;
      const { value, ...meta } = field;
      if (Object.keys(meta).length === 0) return null;
      try {
        return JSON.stringify(meta);
      } catch {
        return null;
      }
    };
    
    // Helper to extract totalAmount/amount as number
    const extractTotalAmount = (field: any): number | null => {
      if (!field || field.value === null || field.value === undefined) {
        return null;
      }
      return parseInvoiceAmount(field.value);
    };
    
    // Convert StoredInvoice to database schema format (PostgreSQL)
    const invoiceRecord = {
      id: finalInvoice.id,
      invoiceNumber: extractValue(finalInvoice.invoiceNumber),
      invoiceNumberMeta: serializeMeta(finalInvoice.invoiceNumber),
      invoiceDate: extractValue(finalInvoice.invoiceDate),
      invoiceDateMeta: serializeMeta(finalInvoice.invoiceDate),
      vendorName: extractValue(finalInvoice.vendorName),
      vendorNameMeta: serializeMeta(finalInvoice.vendorName),
      vendorAddress: extractValue(finalInvoice.vendorAddress),
      vendorAddressMeta: serializeMeta(finalInvoice.vendorAddress),
      customerName: extractValue(finalInvoice.customerName),
      customerNameMeta: serializeMeta(finalInvoice.customerName),
      clientName: extractValue(finalInvoice.clientName),
      clientNameMeta: serializeMeta(finalInvoice.clientName),
      totalAmount: extractTotalAmount(finalInvoice.totalAmount),
      totalAmountMeta: serializeMeta(finalInvoice.totalAmount),
      amount: extractTotalAmount(finalInvoice.amount),
      amountMeta: serializeMeta(finalInvoice.amount),
      paymentTerms: extractValue(finalInvoice.paymentTerms),
      paymentTermsMeta: serializeMeta(finalInvoice.paymentTerms),
      lineItems: finalInvoice.lineItems ? JSON.stringify(extractValue(finalInvoice.lineItems)) : null,
      lineItemsMeta: serializeMeta(finalInvoice.lineItems),
      description: extractValue(finalInvoice.description),
      descriptionMeta: serializeMeta(finalInvoice.description),
      dueDate: extractValue(finalInvoice.dueDate),
      dueDateMeta: serializeMeta(finalInvoice.dueDate),
      invoiceDataUri: finalInvoice.invoiceDataUri,
      status: finalInvoice.status,
      documentType: finalInvoice.documentType || null,
      isDuplicate: finalInvoice.isDuplicate || false,
      duplicateReason: finalInvoice.duplicateReason || null,
      isRecurring: finalInvoice.isRecurring || false,
      recurringPattern: finalInvoice.recurringPattern || null,
      hasAmountAnomaly: finalInvoice.hasAmountAnomaly || false,
      amountAnomalyReason: finalInvoice.amountAnomalyReason || null,
      expectedAmount: finalInvoice.expectedAmount || null,
      amountDeviationPercent: finalInvoice.amountDeviationPercent || null,
      isHighValue: finalInvoice.isHighValue || false,
      highValueReason: finalInvoice.highValueReason || null,
      requiresEscalation: finalInvoice.requiresEscalation || false,
      escalationLevel: finalInvoice.escalationLevel || null,
      escalationReason: finalInvoice.escalationReason || null,
      hasMultipleVendors: finalInvoice.hasMultipleVendors || false,
      accuracyScore: finalInvoice.accuracyScore || null,
      requiresSpecialHandling: finalInvoice.requiresSpecialHandling || false,
      specialHandlingReason: finalInvoice.specialHandlingReason || null,
      comment: finalInvoice.comment || null,
      caseNumber: finalInvoice.caseNumber || null,
      state: finalInvoice.state || null,
      paymentType: finalInvoice.paymentType || null,
      approvalStatus: finalInvoice.approvalStatus || 'Pending',
      approvedBy: finalInvoice.approvedBy || null,
      approvedAt: finalInvoice.approvedAt || null,
      createdBy: finalInvoice.createdBy || null,
      assignedTo: finalInvoice.assignedTo || null,
      disbursementResponse: finalInvoice.disbursementResponse 
        ? (typeof finalInvoice.disbursementResponse === 'string' 
            ? finalInvoice.disbursementResponse 
            : JSON.stringify(finalInvoice.disbursementResponse)) 
        : null,
      crmStatus: finalInvoice.crmStatus || null,
      createdAt: now,
      updatedAt: now,
    };
    
    await db
      .insert(invoices)
      .values(invoiceRecord)
      .onConflictDoUpdate({
        target: invoices.id,
        set: {
          ...invoiceRecord,
          updatedAt: now,
        },
      });

    // Note: Audit logging is skipped in script mode for simplicity
    // This can be added later if needed

    return { data: finalInvoice };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('Error processing invoice:', error);
    return { error: errorMessage };
  }
}

