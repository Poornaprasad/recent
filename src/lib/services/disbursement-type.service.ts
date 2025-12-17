/**
 * Disbursement Type Service
 * Handles database operations for case-vendor disbursement type mappings
 */

import 'server-only';

import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../db/context';
import { caseVendorDisbursementTypes } from '../db/schema';

// Re-export DisbursementOption type for backward compatibility
export type { DisbursementOption } from '../crm/smartadvocate/types';

/**
 * Get the most recent disbursement type that was used for a vendor (across all cases)
 * This is used to pre-select the type when the same vendor is used again
 */
export async function getPreviousDisbursementTypeForVendor(
  vendorName: string
): Promise<string | undefined> {
  const db = await getDatabase();

  const row = await db
    .select()
    .from(caseVendorDisbursementTypes)
    .where(eq(caseVendorDisbursementTypes.vendorName, vendorName))
    .orderBy(desc(caseVendorDisbursementTypes.updatedAt))
    .limit(1)
    .then(rows => rows[0]);

  return row?.disbursementType;
}

/**
 * Get the disbursement type that was previously used for a vendor in a specific case
 * @deprecated Use getPreviousDisbursementTypeForVendor for vendor-based selection
 */
export async function getPreviousDisbursementType(
  caseNumber: string,
  vendorName: string
): Promise<string | undefined> {
  // For backward compatibility, still check case-specific first
  const db = await getDatabase();

  const row = await db
    .select()
    .from(caseVendorDisbursementTypes)
    .where(
      and(
        eq(caseVendorDisbursementTypes.caseNumber, caseNumber),
        eq(caseVendorDisbursementTypes.vendorName, vendorName)
      )
    )
    .orderBy(desc(caseVendorDisbursementTypes.updatedAt))
    .limit(1)
    .then(rows => rows[0]);

  return row?.disbursementType;
}

/**
 * Save the disbursement type for a vendor in a specific case
 */
export async function saveDisbursementTypeMapping(
  caseNumber: string,
  vendorName: string,
  disbursementType: string,
  invoiceId?: string
): Promise<void> {
  const db = await getDatabase();

  const id = `cvd-${Date.now()}`;
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);

  // Check if mapping already exists
  const existing = await db
    .select()
    .from(caseVendorDisbursementTypes)
    .where(
      and(
        eq(caseVendorDisbursementTypes.caseNumber, caseNumber),
        eq(caseVendorDisbursementTypes.vendorName, vendorName)
      )
    )
    .limit(1)
    .then(rows => rows[0]);

  if (existing) {
    // Update existing mapping
    await db
      .update(caseVendorDisbursementTypes)
      .set({
        disbursementType,
        invoiceId: invoiceId || existing.invoiceId,
        updatedAt: now,
      })
      .where(eq(caseVendorDisbursementTypes.id, existing.id));
  } else {
    // Create new mapping
    await db.insert(caseVendorDisbursementTypes).values({
      id,
      caseNumber,
      vendorName,
      disbursementType,
      invoiceId: invoiceId || null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Get all disbursement types used for a vendor across all cases
 */
export async function getDisbursementTypesForVendor(vendorName: string): Promise<string[]> {
  const db = await getDatabase();

  const rows = await db
    .select({ disbursementType: caseVendorDisbursementTypes.disbursementType })
    .from(caseVendorDisbursementTypes)
    .where(eq(caseVendorDisbursementTypes.vendorName, vendorName));

  const types = rows
    .map(row => row.disbursementType)
    .filter((type): type is string => type !== null && type !== undefined);

  return [...new Set(types)];
}

