/**
 * Case server actions
 * Next.js server actions for SmartAdvocate case operations
 */

'use server';

import { getCaseInfo, extractPlaintiffInfo } from '../crm/smartadvocate';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import type { PlaintiffInfo } from '../crm/smartadvocate/types';

/**
 * Lookup case info from SmartAdvocate API
 * Returns plaintiff info without modifying any invoice data
 */
export async function lookupCaseInfoAction(
  caseNumber: string
): Promise<ActionResult<PlaintiffInfo>> {
  return withActionHandler(async () => {
    if (!caseNumber || caseNumber.trim() === '') {
      throw new Error('Case number is required');
    }

    const caseInfo = await getCaseInfo({
      caseNumber: caseNumber.trim(),
      addContactInfo: true,
    });

    if (!caseInfo) {
      throw new Error(`Case not found: ${caseNumber}`);
    }

    const plaintiffInfo = extractPlaintiffInfo(caseInfo);

    if (!plaintiffInfo) {
      throw new Error(`No plaintiff found in case: ${caseNumber}`);
    }

    return plaintiffInfo;
  }, 'Failed to lookup case info');
}
