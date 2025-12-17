/**
 * Contact Type server actions
 * Next.js server actions for contact type operations
 */

'use server';

import { getContactTypes } from '../crm/smartadvocate/contact';
import type { DisbursementOption } from '../crm/smartadvocate/types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

/**
 * Fetch contact types from SmartAdvocate API
 * Uses endpoint: /contact/ContactTypes?ContactCtg=2
 * Returns array of { id, description }
 */
export async function fetchContactTypesAction(contactCtg: number = 2): Promise<ActionResult<DisbursementOption[]>> {
  return withActionHandler(
    () => getContactTypes(contactCtg),
    'Failed to fetch contact types'
  );
}

