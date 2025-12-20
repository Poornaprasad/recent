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
  disbursementData: CreateDisbursementRequest
): Promise<ActionResult<any>> {
  return withActionHandler(
    () => createDisbursement(caseID, disbursementData),
    'Failed to create disbursement in CRM'
  );
}

/**
 * Check for duplicate disbursements in a case
 * Compares vendor, invoice number, and date
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
  }>;
  message?: string;
}

export async function checkCaseForDuplicatesAction(
  caseID: number,
  vendorName: string,
  invoiceNumber: string,
  invoiceDate: string
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

      // Check if vendor, invoice number, and date match
      const vendorMatches = normalizedPayeeName === normalizedVendorName;
      const invoiceNumberMatches = normalizedDispInvoiceNumber === normalizedInvoiceNumber;
      const dateMatches = normalizedDispInvoiceDate && normalizedInvoiceDate
        ? normalizedDispInvoiceDate === normalizedInvoiceDate
        : false;

      // Consider it a duplicate if all three match
      if (vendorMatches && invoiceNumberMatches && dateMatches) {
        duplicates.push({
          disbursementID: disbursement.disbursementID,
          invoiceNumber: disbursement.invoiceNumber,
          invoiceDate: disbursement.invoiceDate,
          payeeName: payeeName,
          amount: disbursement.amount,
          checkNumber: disbursement.checkNumber,
        });
      }
    }

    return {
      isDuplicate: duplicates.length > 0,
      duplicates,
      message: duplicates.length > 0
        ? `Found ${duplicates.length} potential duplicate(s)`
        : 'No duplicates found',
    };
  }, 'Failed to check for duplicates');
}

