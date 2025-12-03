'use server';

import { CrmInvoiceStatus } from '@/lib/schemas';

/**
 * @fileOverview Mock CRM service for checking invoice status.
 */

// In a real app, this would make an API call to the CRM system.
const FAKE_CRM_DB: { [invoiceNumber: string]: CrmInvoiceStatus } = {
    '554951': CrmInvoiceStatus.Associated,
    'INV-PENDING-456': CrmInvoiceStatus.Associated,
};


export async function checkCrmForInvoice(
    invoiceNumber: string,
    customerName: string,
    totalAmount: number
): Promise<CrmInvoiceStatus | null> {
    const status = FAKE_CRM_DB[invoiceNumber];

    return Promise.resolve(status || null);
}

