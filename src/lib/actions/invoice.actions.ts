/**
 * Invoice server actions
 * Next.js server actions for invoice operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { invoiceService } from '../services/invoice.service';
import { getInvoiceDataUri } from '../storage/file-utils';
import type { StoredInvoice } from '../domain/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import { getDb, initDb } from '../db';
import { invoices } from '../db/schema';
import { eq } from 'drizzle-orm';
import { serializeMeta } from '../repositories/mappers/invoice.mapper';
import { retryPlaintiffNameExtraction } from '@/ai/flows/extract-invoice-data';
import { findInvoiceById } from '../repositories/invoice.repository';
import { auditService } from '../core/audit/audit.service';
import { AuditAction, AuditResource, AuditCategory, AuditSeverity } from '../core/audit/audit.types';
import { getRequestMetadata, getCurrentUserId } from '../utils/request-context';

/**
 * Process a new invoice upload
 */
export async function processInvoiceAction(
  input: { invoiceDataUri: string; caseNumber?: string }
): Promise<{ data?: StoredInvoice; error?: string }> {
  const result = await invoiceService.processInvoice(
    { invoiceDataUri: input.invoiceDataUri },
    { caseNumber: input.caseNumber }
  );

  if (result.data) {
    revalidatePath('/invoices');
    revalidatePath('/approvals');
    revalidatePath('/dashboard');
  }

  return result;
}

/**
 * Get invoice by ID
 */
export async function getInvoiceByIdAction(id: string): Promise<ActionResult<StoredInvoice>> {
  return withActionHandler(async () => {
    const invoice = await invoiceService.getInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice;
  }, 'Failed to fetch invoice');
}

/**
 * Get invoice data URI (file path to data URI conversion)
 */
export async function getInvoiceDataUriAction(uri: string): Promise<{ dataUri?: string; error?: string }> {
  return withActionHandler(
    () => getInvoiceDataUri(uri).then(dataUri => ({ dataUri })),
    'Failed to get invoice file'
  );
}

/**
 * Check if invoice can be approved (checks W9/tax ID requirements)
 */
export async function canApproveInvoiceAction(
  id: string
): Promise<{ canApprove: boolean; error?: string }> {
  try {
    const invoice = await invoiceService.getInvoiceById(id);
    if (!invoice) {
      return { canApprove: false, error: 'Invoice not found' };
    }

    // Skip W9 check for receipts - only applies to invoices
    if (invoice.documentType === 'Receipt') {
      return { canApprove: true };
    }

    // Only check W9 requirements for Invoice document types
    if (invoice.documentType && invoice.documentType !== 'Invoice') {
      return { canApprove: true };
    }

    const vendorName = invoice.vendorName?.value;
    if (!vendorName) {
      return { canApprove: true }; // No vendor name, allow approval
    }

    // Check if vendor requires 1099/W9
    const { findVendorByName } = await import('../repositories/vendor.repository');
    // Try exact match first, then trimmed match
    const vendor = await findVendorByName(vendorName) || await findVendorByName(vendorName.trim());
    
    // Check if W9 is received or tax ID exists
    // Tax ID can be string or number, so convert to string for checking
    const hasW9Received = vendor?.w9Status === 'Received';
    const taxIdValue = vendor?.taxId;
    const hasTaxId = taxIdValue !== null && taxIdValue !== undefined && 
                     String(taxIdValue).trim() !== '';
    const noNeedToTrack = hasW9Received || hasTaxId;
    
    // If vendor has tax ID or W9 received, allow approval immediately
    if (noNeedToTrack) {
      return { canApprove: true };
    }
    
    // If vendor is not found in database, allow approval (can't verify requirements)
    if (!vendor) {
      return { canApprove: true };
    }
    
    // Check threshold for vendors in database that don't have W9/tax ID
    if (!noNeedToTrack && vendor) {
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
      if (financialYear !== null) {
        const { findInvoicesByVendorName } = await import('../repositories/invoice.repository');
        const { parseInvoiceAmount } = await import('../utils/invoice-utils');
        
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
        
        const cumulativeTotal = invoicesInSameYear.reduce((sum, inv) => {
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
            canApprove: false,
            error: `Cannot approve invoice. Vendor "${vendorName}" has cumulative invoices totaling $${cumulativeTotal.toFixed(2)} in ${financialYear}, which exceeds the $600 threshold. Please ensure W9 form is received or tax ID is added before approving invoices.`
          };
        }
      }
      
      // Also check if 1099/W9 is received or tracked (legacy check for cases without financial year)
      if (vendor) {
        const form1099Status = vendor.form1099Status;
        const w9Status = vendor.w9Status;
        
        const canProcess = 
          form1099Status === 'Received' || 
          form1099Status === 'Tracked' ||
          w9Status === 'Received';
        
        if (!canProcess && !financialYear) {
          return {
            canApprove: false,
            error: `Cannot approve invoice. Vendor "${vendorName}" requires 1099/W9 forms. Please mark the forms as Received or Tracked in the W9 Requests page before approving invoices.`
          };
        }
      }
    }

    return { canApprove: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check approval eligibility';
    console.error('Error in canApproveInvoiceAction:', error);
    return { canApprove: false, error: message };
  }
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatusAction(
  id: string,
  status: 'Pending' | 'Draft',
  userId?: string
): Promise<{ success: boolean, error?: string}> {
  return withActionHandler(async () => {
    // Get invoice before update for audit log
    const invoice = await findInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const previousStatus = invoice.status;

    const result = await invoiceService.updateStatus(id, status);
    if (!result.success) {
      return result;
    }

    // Audit log: Invoice status changed
    try {
      const auditUserId = userId || await getCurrentUserId() || 'system';
      const metadata = await getRequestMetadata();
      await auditService.logInvoiceStatusChanged(
        auditUserId,
        id,
        {
          invoiceNumber: invoice.invoiceNumber?.value || invoice.invoiceNumber,
          previousStatus,
          newStatus: status,
        },
        metadata
      );
    } catch (error) {
      // Don't fail the operation if audit logging fails
      console.error('Failed to log invoice status change:', error);
    }

    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    revalidatePath('/w9-requests');
    return { success: true };
  }, 'Failed to update invoice status');
}

/**
 * Get all invoices
 * @param userPermissions Optional user permissions for state-based filtering
 */
export async function getInvoicesAction(
  userPermissions?: { role: string; assignedStates?: string[] }
): Promise<ActionResult<StoredInvoice[]>> {
  return withActionHandler(
    () => invoiceService.getAllInvoices(userPermissions),
    'Failed to fetch invoices'
  );
}

/**
 * Flag invoice for review
 * Cannot flag invoices that require escalation (they are handled via role-based access control)
 */
export async function flagInvoiceForReviewAction(
  id: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    // First check if invoice requires escalation
    const invoice = await invoiceService.getInvoiceById(id);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }
    
    if (invoice.requiresEscalation === true) {
      return { 
        success: false, 
        error: 'Cannot flag escalated invoices for review. Escalated invoices require role-based approval and are handled separately.' 
      };
    }
    
    await invoiceService.updateStatus(id, 'Review');
    
    // Audit log: Invoice flagged for review
    try {
      const auditUserId = userId || await getCurrentUserId() || 'system';
      const metadata = await getRequestMetadata();
      await auditService.log({
        userId: auditUserId,
        action: AuditAction.INVOICE_FLAGGED_FOR_REVIEW,
        resource: AuditResource.INVOICE,
        resourceId: id,
        category: AuditCategory.INVOICE_MANAGEMENT,
        severity: AuditSeverity.INFO,
        details: {
          description: `Invoice flagged for review`,
          invoiceNumber: invoice.invoiceNumber?.value || invoice.invoiceNumber,
        },
        metadata,
      });
    } catch (error) {
      // Don't fail the operation if audit logging fails
      console.error('Failed to log invoice flag for review:', error);
    }
    
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  }, 'Failed to flag invoice for review');
}

/**
 * Add comment to invoice
 */
export async function addInvoiceCommentAction(
  id: string,
  comment: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    // Get invoice for audit log
    const invoice = await findInvoiceById(id);
    
    await invoiceService.addComment(id, comment);
    
    // Audit log: Invoice comment added
    try {
      const auditUserId = userId || await getCurrentUserId() || 'system';
      const metadata = await getRequestMetadata();
      await auditService.log({
        userId: auditUserId,
        action: AuditAction.INVOICE_COMMENT_ADDED,
        resource: AuditResource.INVOICE,
        resourceId: id,
        category: AuditCategory.INVOICE_MANAGEMENT,
        severity: AuditSeverity.INFO,
        details: {
          description: `Comment added to invoice`,
          invoiceNumber: invoice?.invoiceNumber?.value || invoice?.invoiceNumber,
          commentLength: comment.length,
        },
        metadata,
      });
    } catch (error) {
      // Don't fail the operation if audit logging fails
      console.error('Failed to log invoice comment:', error);
    }
    
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  }, 'Failed to add comment');
}

/**
 * Update invoice case number
 */
export async function updateInvoiceCaseNumberAction(
  id: string,
  caseNumber: string | undefined,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await withActionHandler(async () => {
    // Get invoice before update for audit log
    const invoice = await findInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    const previousCaseNumber = invoice.caseNumber;
    
    await invoiceService.updateCaseNumber(id, caseNumber);
    
    // Audit log: Invoice case number updated
    try {
      const auditUserId = userId || await getCurrentUserId() || 'system';
      const metadata = await getRequestMetadata();
      await auditService.logInvoiceFieldEdited(
        auditUserId,
        id,
        {
          invoiceNumber: invoice.invoiceNumber?.value || invoice.invoiceNumber,
          fieldName: 'caseNumber',
          previousValue: previousCaseNumber || null,
          newValue: caseNumber || null,
        },
        metadata
      );
    } catch (error) {
      // Don't fail the operation if audit logging fails
      console.error('Failed to log invoice case number update:', error);
    }
    
    revalidatePath(`/invoices/${id}`);
    revalidatePath('/approvals');
    return { success: true };
  }, 'Failed to update case number');

  // Unwrap the result to match the expected return type
  if (result.error) {
    return { success: false, error: result.error };
  }
  return result.data || { success: false, error: 'Unknown error' };
}

// Field name to database column mapping
const fieldToColumnMap: Record<string, { valueCol: string; metaCol: string | null; isNumeric?: boolean }> = {
  invoiceNumber: { valueCol: 'invoiceNumber', metaCol: 'invoiceNumberMeta' },
  invoiceDate: { valueCol: 'invoiceDate', metaCol: 'invoiceDateMeta' },
  vendorName: { valueCol: 'vendorName', metaCol: 'vendorNameMeta' },
  vendorAddress: { valueCol: 'vendorAddress', metaCol: 'vendorAddressMeta' },
  customerName: { valueCol: 'customerName', metaCol: 'customerNameMeta' },
  totalAmount: { valueCol: 'totalAmount', metaCol: 'totalAmountMeta', isNumeric: true },
  paymentTerms: { valueCol: 'paymentTerms', metaCol: 'paymentTermsMeta' },
  amount: { valueCol: 'amount', metaCol: 'amountMeta', isNumeric: true },
  clientName: { valueCol: 'clientName', metaCol: 'clientNameMeta' },
  description: { valueCol: 'description', metaCol: 'descriptionMeta' },
  dueDate: { valueCol: 'dueDate', metaCol: 'dueDateMeta' },
};

/**
 * Update a single invoice field
 * Persists the edited value and metadata to the database
 */
export async function updateInvoiceFieldAction(
  invoiceId: string,
  fieldName: string,
  fieldValue: string,
  isEdited: boolean = true,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await withActionHandler(async () => {
    await initDb();
    const db = getDb();

    // Get invoice before update for audit log
    const invoice = await findInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Get previous value for audit log
    const previousValue = (invoice as any)[fieldName]?.value || (invoice as any)[fieldName] || null;

    const mapping = fieldToColumnMap[fieldName];
    if (!mapping) {
      throw new Error(`Unknown field: ${fieldName}`);
    }

    // Prepare the update data
    const updateData: Record<string, any> = {
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };

    // Set the value column
    if (mapping.isNumeric) {
      const numValue = parseFloat(fieldValue.replace(/[^0-9.-]/g, ''));
      updateData[mapping.valueCol] = isNaN(numValue) ? null : numValue;
    } else {
      updateData[mapping.valueCol] = fieldValue || null;
    }

    // Set the metadata column (mark as user-edited, remove confidence)
    if (mapping.metaCol) {
      // Build metadata - confidence is intentionally omitted for user-edited fields
      const meta: { value: string; reasoning?: string } = { value: fieldValue };
      if (isEdited) {
        meta.reasoning = 'User edited';
      }
      updateData[mapping.metaCol] = serializeMeta(meta);
    }

    await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId));

    // Audit log: Invoice field edited
    if (isEdited) {
      try {
        const auditUserId = userId || await getCurrentUserId() || 'system';
        const metadata = await getRequestMetadata();
        await auditService.logInvoiceFieldEdited(
          auditUserId,
          invoiceId,
          {
            invoiceNumber: invoice.invoiceNumber?.value || invoice.invoiceNumber,
            fieldName,
            previousValue: previousValue,
            newValue: fieldValue,
          },
          metadata
        );
      } catch (error) {
        // Don't fail the operation if audit logging fails
        console.error('Failed to log invoice field edit:', error);
      }
    }

    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true };
  }, 'Failed to update invoice field');

  // Unwrap the result to match the expected return type
  if (result.error) {
    return { success: false, error: result.error };
  }
  return result.data || { success: false, error: 'Unknown error' };
}

/**
 * Update invoice with disbursement response
 * If vendor's cumulative total is below $600, automatically marks invoice as "Paid"
 */
export async function updateInvoiceDisbursementResponseAction(
  invoiceId: string,
  disbursementResponse: any,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await initDb();
    const db = getDb();

    // Get the invoice to check vendor and calculate cumulative total
    const invoice = await findInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const updateData: Record<string, any> = {
      disbursementResponse: typeof disbursementResponse === 'string' 
        ? disbursementResponse 
        : JSON.stringify(disbursementResponse),
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };

    // Check if vendor's cumulative total is below $600
    // If so, mark invoice as "Paid" when pushed to CRM
    const vendorName = invoice.vendorName?.value;
    if (vendorName) {
      const { parseInvoiceAmount } = await import('../utils/invoice-utils');
      const { findInvoicesByVendorName } = await import('../repositories/invoice.repository');
      
      // Get all invoices for this vendor
      const vendorInvoices = await findInvoicesByVendorName(vendorName);
      
      // Helper function to get financial year (calendar year) from invoice date
      const getFinancialYear = (invoiceDate: string | null | undefined): number | null => {
        if (!invoiceDate) return null;
        try {
          const date = new Date(invoiceDate);
          if (isNaN(date.getTime())) return null;
          return date.getFullYear();
        } catch {
          return null;
        }
      };
      
      // Get the current invoice's financial year
      const currentInvoiceDate = typeof invoice.invoiceDate === 'object' && invoice.invoiceDate?.value 
        ? invoice.invoiceDate.value 
        : invoice.invoiceDate;
      const currentFinancialYear = getFinancialYear(currentInvoiceDate);
      
      if (currentFinancialYear !== null) {
        // Calculate cumulative total for this vendor in the same financial year
        // Only count invoices that have been pushed to CRM (have disbursementResponse)
        // This represents the cumulative amount that has been paid to the vendor
        let cumulativeTotal = 0;
        for (const inv of vendorInvoices) {
          // Skip receipts - only track invoices for cumulative calculation
          if (inv.documentType === 'Receipt') {
            continue;
          }
          
          // Only process invoices with documentType === 'Invoice' or undefined/null (legacy invoices)
          if (inv.documentType && inv.documentType !== 'Invoice') {
            continue;
          }
          
          // Only count invoices that have been pushed to CRM (have disbursementResponse)
          // This ensures we only count invoices that have actually been paid
          if (!inv.disbursementResponse) {
            continue;
          }
          
          // Get invoice date and financial year
          const invDate = typeof inv.invoiceDate === 'object' && inv.invoiceDate?.value 
            ? inv.invoiceDate.value 
            : inv.invoiceDate;
          const invFinancialYear = getFinancialYear(invDate);
          
          // Only count invoices in the same financial year
          if (invFinancialYear === currentFinancialYear) {
            const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
            cumulativeTotal += amount || 0;
          }
        }
        
        // Add the current invoice amount to the cumulative total
        const currentInvoiceAmount = parseInvoiceAmount(invoice.totalAmount?.value || invoice.amount?.value);
        const totalWithCurrent = cumulativeTotal + currentInvoiceAmount;
        
        // If cumulative total (including current invoice) is below $600, mark invoice as "Paid"
        if (totalWithCurrent < 600) {
          updateData.status = 'Paid';
        }
      }
    }

    await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId));

    // Audit log: Invoice pushed to CRM (disbursement created)
    try {
      const auditUserId = userId || await getCurrentUserId() || 'system';
      const metadata = await getRequestMetadata();
      const { parseInvoiceAmount } = await import('../utils/invoice-utils');
      const amount = parseInvoiceAmount(invoice.totalAmount?.value || invoice.amount?.value);
      
      await auditService.logInvoiceCrmPushed(
        auditUserId,
        invoiceId,
        {
          invoiceNumber: invoice.invoiceNumber?.value || invoice.invoiceNumber,
          vendorName: invoice.vendorName?.value || invoice.vendorName,
          amount: amount || 0,
          crmStatus: 'Disbursement Created',
          disbursementId: typeof disbursementResponse === 'object' 
            ? disbursementResponse?.id?.toString() 
            : undefined,
        },
        metadata
      );
    } catch (error) {
      // Don't fail the operation if audit logging fails
      console.error('Failed to log invoice CRM push:', error);
    }

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    revalidatePath('/w9-requests');
    return { success: true };
  }, 'Failed to update disbursement response');
}

/**
 * Update invoice CRM status
 */
export async function updateInvoiceCrmStatusAction(
  invoiceId: string,
  crmStatus: 'Associated' | 'Draft' | 'Not Found' | 'Duplicate',
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await initDb();
    const db = getDb();

    // Get invoice before update for audit log
    const invoice = await findInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const previousCrmStatus = invoice.crmStatus;

    const updateData: Record<string, any> = {
      crmStatus,
      updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    };

    await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId));

    // Audit log: Invoice CRM status updated
    try {
      const auditUserId = userId || await getCurrentUserId() || 'system';
      const metadata = await getRequestMetadata();
      await auditService.log({
        userId: auditUserId,
        action: AuditAction.INVOICE_UPDATED,
        resource: AuditResource.INVOICE,
        resourceId: invoiceId,
        category: AuditCategory.CRM_INTEGRATION,
        severity: AuditSeverity.INFO,
        details: {
          description: `Invoice CRM status updated`,
          invoiceNumber: invoice.invoiceNumber?.value || invoice.invoiceNumber,
          previousCrmStatus: previousCrmStatus || 'None',
          newCrmStatus: crmStatus,
        },
        metadata,
      });
    } catch (error) {
      // Don't fail the operation if audit logging fails
      console.error('Failed to log invoice CRM status update:', error);
    }

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/approvals');
    revalidatePath('/invoices');
    return { success: true };
  }, 'Failed to update CRM status');
}

/**
 * Retry plaintiff name extraction with case name hint
 * Searches the document for the case name and updates the clientName field if found
 */
export async function retryPlaintiffNameAction(
  invoiceId: string,
  caseName: string
): Promise<{ success: boolean; found: boolean; error?: string }> {
  return withActionHandler(async () => {
    // Get the invoice to retrieve the document URI
    const invoice = await findInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Get the invoice data URI (convert file path to data URI if needed)
    const invoiceDataUri = await getInvoiceDataUri(invoice.invoiceDataUri);

    // Retry extraction with case name hint
    const result = await retryPlaintiffNameExtraction(invoiceDataUri, caseName);

    if (result.error) {
      throw new Error(result.error);
    }

    // If the name was found, update the invoice field with full metadata
    if (result.found && result.clientName?.value) {
      await initDb();
      const db = getDb();

      const mapping = fieldToColumnMap['clientName'];
      if (!mapping) {
        throw new Error('Unknown field: clientName');
      }

      // Prepare the update data with full metadata from AI extraction
      const updateData: Record<string, any> = {
        updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
      };

      // Set the value column
      updateData[mapping.valueCol] = result.clientName.value || null;

      // Set the metadata column with full AI extraction metadata
      if (mapping.metaCol && result.clientName) {
        const meta: { value: string; confidence?: number; reasoning?: string; bbox?: any } = {
          value: result.clientName.value,
        };
        if (result.clientName.confidence !== undefined) {
          meta.confidence = result.clientName.confidence;
        }
        if (result.clientName.reasoning) {
          meta.reasoning = result.clientName.reasoning + ' (Retried with case name hint)';
        }
        if (result.clientName.bbox) {
          meta.bbox = result.clientName.bbox;
        }
        updateData[mapping.metaCol] = serializeMeta(meta);
      }

      await db
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, invoiceId));
    }

    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true, found: result.found };
  }, 'Failed to retry plaintiff name extraction');
}

