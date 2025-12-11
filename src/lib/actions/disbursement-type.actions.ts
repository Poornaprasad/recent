/**
 * Disbursement Type server actions
 * Next.js server actions for disbursement type operations
 */

'use server';

import {
  fetchDisbursementTypesFromApi,
  getPreviousDisbursementType,
  getPreviousDisbursementTypeForVendor,
  saveDisbursementTypeMapping,
  getDisbursementTypesForVendor,
} from '../services/disbursement-type.service';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

/**
 * Fetch disbursement types from SmartAdvocate API
 * Types are common across all cases
 */
export async function fetchDisbursementTypesAction(): Promise<ActionResult<string[]>> {
  return withActionHandler(
    () => fetchDisbursementTypesFromApi(),
    'Failed to fetch disbursement types'
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

