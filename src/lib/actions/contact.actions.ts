/**
 * Contact server actions
 * Next.js server actions for SmartAdvocate contact operations
 */

'use server';

import { lookupContacts } from '../crm/smartadvocate';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import type { ContactLookupResult, ContactLookupParams } from '../crm/smartadvocate/types';

/**
 * Lookup contacts from SmartAdvocate API
 * Searches for vendor contacts by name, firstName, or lastName
 */
export async function lookupContactsAction(
  params: ContactLookupParams
): Promise<ActionResult<ContactLookupResult[]>> {
  return withActionHandler(async () => {
    // At least one search parameter is required
    if (!params.name && !params.firstName && !params.lastName) {
      throw new Error('At least one search parameter (name, firstName, or lastName) is required');
    }

    const results = await lookupContacts({
      name: params.name?.trim(),
      firstName: params.firstName?.trim(),
      lastName: params.lastName?.trim(),
      firstPage: params.firstPage || 1,
      rowLimit: params.rowLimit || 10,
    });

    return results;
  }, 'Failed to lookup contacts');
}

