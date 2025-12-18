/**
 * Disbursement Type server actions
 * Next.js server actions for disbursement type operations
 */

'use server';

import {
  getDisbursementTypes,
  getDisbursementStatuses,
  createDisbursement,
  type CreateDisbursementRequest,
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

