/**
 * Disbursement Type server actions
 * Next.js server actions for disbursement type operations
 */

'use server';

import {
  getDisbursementTypes,
  getDisbursementStatuses,
  createDisbursement,
  getDisbursements,
  type CreateDisbursementRequest,
  type Disbursement,
} from '../crm/smartadvocate/disbursement';
import {
  getPreviousDisbursementType,
  getPreviousDisbursementTypeForVendor,
  saveDisbursementTypeMapping,
  getDisbursementTypesForVendor,
} from '../services/disbursement-type.service';
import type { DisbursementOption } from '../crm/smartadvocate/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import { auditService } from '../core/audit/audit.service';
import { AuditAction, AuditResource, AuditCategory, AuditSeverity } from '../core/audit/audit.types';
import { getRequestMetadata, getCurrentUserId } from '../utils/request-context';

/**
 * Fetch disbursement types from SmartAdvocate API
 * Types are common across all cases
 * Returns array of { id, description }
 */
export async function fetchDisbursementTypesAction(): Promise<ActionResult<DisbursementOption[]>> {
  return withActionHandler(
    () => getDisbursementTypes(),
    'Failed to fetch disbursement types'
  );
}

/**
 * Fetch disbursement statuses from SmartAdvocate API
 * Statuses are common across all cases
 * Returns array of { id, description }
 */
export async function fetchDisbursementStatusesAction(): Promise<ActionResult<DisbursementOption[]>> {
  return withActionHandler(
    () => getDisbursementStatuses(),
    'Failed to fetch disbursement statuses'
  );
}

/**
 * Get previous disbursement type for a vendor (across all cases)
 * Used to pre-select type when same vendor is used again
 */
export async function getPreviousDisbursementTypeForVendorAction(
  vendorName: string
): Promise<ActionResult<string | undefined>> {
  return withActionHandler(
    () => getPreviousDisbursementTypeForVendor(vendorName),
    'Failed to get previous disbursement type for vendor'
  );
}

/**
 * Get previous disbursement type for a vendor in a specific case
 * @deprecated Use getPreviousDisbursementTypeForVendorAction for vendor-based selection
 */
export async function getPreviousDisbursementTypeAction(
  caseNumber: string,
  vendorName: string
): Promise<ActionResult<string | undefined>> {
  return withActionHandler(
    () => getPreviousDisbursementType(caseNumber, vendorName),
    'Failed to get previous disbursement type'
  );
}

/**
 * Save disbursement type mapping for a case and vendor
 */
export async function saveDisbursementTypeMappingAction(
  caseNumber: string,
  vendorName: string,
  disbursementType: string,
  invoiceId?: string
): Promise<{ success: boolean; error?: string }> {
  return withActionHandler(async () => {
    await saveDisbursementTypeMapping(caseNumber, vendorName, disbursementType, invoiceId);
    return { success: true };
  }, 'Failed to save disbursement type mapping');
}

/**
 * Get all disbursement types used for a vendor
 */
export async function getDisbursementTypesForVendorAction(
  vendorName: string
): Promise<ActionResult<string[]>> {
  return withActionHandler(
    () => getDisbursementTypesForVendor(vendorName),
    'Failed to get disbursement types for vendor'
  );
}

/**
 * Create a disbursement in SmartAdvocate CRM
 */
export async function createDisbursementAction(
  caseID: number,
  disbursementData: CreateDisbursementRequest,
  userId?: string
): Promise<ActionResult<any>> {
  return withActionHandler(async () => {
    const result = await createDisbursement(caseID, disbursementData);
    
    // Audit log: Disbursement created
    try {
      const auditUserId = userId || await getCurrentUserId() || 'system';
      const metadata = await getRequestMetadata();
      await auditService.log({
        userId: auditUserId,
        action: AuditAction.DISBURSEMENT_CREATED,
        resource: AuditResource.DISBURSEMENT,
        resourceId: result?.id?.toString() || result?.disbursementID?.toString(),
        category: AuditCategory.CRM_INTEGRATION,
        severity: AuditSeverity.INFO,
        details: {
          description: `Disbursement created in CRM`,
          caseID,
          amount: disbursementData.amount,
          vendorName: disbursementData.vendorName,
          invoiceNumber: disbursementData.invoiceNumber,
          disbursementId: result?.id?.toString() || result?.disbursementID?.toString(),
        },
        metadata,
      });
    } catch (error) {
      // Don't fail the operation if audit logging fails
      console.error('Failed to log disbursement creation:', error);
    }
    
    return result;
  }, 'Failed to create disbursement in CRM');
}

/**
 * Check for duplicate disbursements in a case
 * Compares vendor, invoice number, and date
 * Also shows partial matches based on vendor name and amount
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicates: Array<{
    disbursementID?: number;
    invoiceNumber?: string;
    invoiceDate?: string;
    payeeName?: string;
    amount?: number;
    checkNumber?: string;
    matchType?: 'exact' | 'partial';
  }>;
  partialMatches?: Array<{
    disbursementID?: number;
    invoiceNumber?: string;
    invoiceDate?: string;
    payeeName?: string;
    amount?: number;
    checkNumber?: string;
    matchType?: 'exact' | 'partial';
  }>;
  message?: string;
}

/**
 * Check if two vendor names strongly match
 * Uses fuzzy matching to handle variations
 */
function isVendorNameStrongMatch(name1: string, name2: string): boolean {
  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();
  
  // Exact match
  if (n1 === n2) return true;
  
  // Check if one contains the other (for abbreviations)
  if (n1.includes(n2) || n2.includes(n1)) {
    // Require at least 3 characters overlap for short names
    const minLength = Math.min(n1.length, n2.length);
    if (minLength >= 3) {
      return true;
    }
  }
  
  // Remove common business suffixes and compare
  const suffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'company', 'co'];
  let clean1 = n1;
  let clean2 = n2;
  
  for (const suffix of suffixes) {
    clean1 = clean1.replace(new RegExp(`\\s*${suffix}\\.?$`, 'i'), '');
    clean2 = clean2.replace(new RegExp(`\\s*${suffix}\\.?$`, 'i'), '');
  }
  
  if (clean1 === clean2 && clean1.length >= 3) return true;
  
  // Check word-by-word match (at least 2 words must match)
  const words1 = clean1.split(/\s+/).filter(w => w.length >= 2);
  const words2 = clean2.split(/\s+/).filter(w => w.length >= 2);
  
  if (words1.length >= 2 && words2.length >= 2) {
    const matchingWords = words1.filter(w => words2.includes(w));
    if (matchingWords.length >= 2) return true;
  }
  
  return false;
}

export async function checkCaseForDuplicatesAction(
  caseID: number,
  vendorName: string,
  invoiceNumber: string,
  invoiceDate: string,
  amount?: number
): Promise<ActionResult<DuplicateCheckResult>> {
  return withActionHandler(async () => {
    if (!caseID) {
      return {
        isDuplicate: false,
        duplicates: [],
        message: 'Case ID is required',
      };
    }

    if (!vendorName || !invoiceNumber || !invoiceDate) {
      return {
        isDuplicate: false,
        duplicates: [],
        message: 'Vendor name, invoice number, and invoice date are required',
      };
    }

    // Fetch all disbursements for the case
    const disbursements = await getDisbursements(caseID, 0, 200);

    // Normalize input values for comparison
    const normalizedVendorName = vendorName.trim().toLowerCase();
    const normalizedInvoiceNumber = invoiceNumber.trim().toLowerCase();
    const inputAmount = amount || 0;
    
    // Normalize date - handle different formats
    let normalizedInvoiceDate: string | null = null;
    try {
      const dateObj = new Date(invoiceDate);
      if (!isNaN(dateObj.getTime())) {
        // Format as YYYY-MM-DD for comparison
        normalizedInvoiceDate = dateObj.toISOString().split('T')[0];
      }
    } catch (e) {
      // If date parsing fails, use original string
      normalizedInvoiceDate = invoiceDate.trim();
    }

    // Find potential duplicates
    const duplicates: DuplicateCheckResult['duplicates'] = [];
    const partialMatches: DuplicateCheckResult['partialMatches'] = [];

    for (const disbursement of disbursements) {
      // Get payee name
      const payeeName = disbursement.payee?.name || '';
      const normalizedPayeeName = payeeName.trim().toLowerCase();

      // Get invoice number
      const dispInvoiceNumber = disbursement.invoiceNumber || '';
      const normalizedDispInvoiceNumber = dispInvoiceNumber.trim().toLowerCase();

      // Get invoice date
      let normalizedDispInvoiceDate: string | null = null;
      if (disbursement.invoiceDate) {
        try {
          const dateObj = new Date(disbursement.invoiceDate);
          if (!isNaN(dateObj.getTime())) {
            normalizedDispInvoiceDate = dateObj.toISOString().split('T')[0];
          }
        } catch (e) {
          normalizedDispInvoiceDate = String(disbursement.invoiceDate).trim();
        }
      }

      // Get amount
      const dispAmount = disbursement.amount || 0;

      // Check if vendor, invoice number, and date match (exact duplicate)
      const vendorMatches = normalizedPayeeName === normalizedVendorName;
      const invoiceNumberMatches = normalizedDispInvoiceNumber === normalizedInvoiceNumber;
      const dateMatches = normalizedDispInvoiceDate && normalizedInvoiceDate
        ? normalizedDispInvoiceDate === normalizedInvoiceDate
        : false;

      // Check for exact duplicate (all three match)
      if (vendorMatches && invoiceNumberMatches && dateMatches) {
        duplicates.push({
          disbursementID: disbursement.disbursementID,
          invoiceNumber: disbursement.invoiceNumber,
          invoiceDate: disbursement.invoiceDate,
          payeeName: payeeName,
          amount: disbursement.amount,
          checkNumber: disbursement.checkNumber,
          matchType: 'exact',
        });
        continue; // Skip partial match check for exact duplicates
      }

      // Check for partial match: vendor name strongly matches AND amount matches
      if (inputAmount > 0 && dispAmount > 0) {
        const vendorStrongMatch = isVendorNameStrongMatch(vendorName, payeeName);
        const amountMatches = Math.abs(inputAmount - dispAmount) < 0.01; // Allow for floating point precision
        
        if (vendorStrongMatch && amountMatches) {
          // Don't add if already in duplicates
          const isAlreadyInDuplicates = duplicates.some(
            d => d.disbursementID === disbursement.disbursementID
          );
          
          if (!isAlreadyInDuplicates) {
            partialMatches.push({
              disbursementID: disbursement.disbursementID,
              invoiceNumber: disbursement.invoiceNumber,
              invoiceDate: disbursement.invoiceDate,
              payeeName: payeeName,
              amount: disbursement.amount,
              checkNumber: disbursement.checkNumber,
              matchType: 'partial',
            });
          }
        }
      }
    }

    const totalMatches = duplicates.length + partialMatches.length;

    return {
      isDuplicate: duplicates.length > 0,
      duplicates,
      partialMatches: partialMatches.length > 0 ? partialMatches : undefined,
      message: totalMatches > 0
        ? `Found ${duplicates.length} exact duplicate(s)${partialMatches.length > 0 ? ` and ${partialMatches.length} partial match(es)` : ''}`
        : 'No duplicates found',
    };
  }, 'Failed to check for duplicates');
}

