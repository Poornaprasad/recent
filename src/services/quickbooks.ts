
'use server';

import { QuickBooksInvoiceStatus } from '@/lib/schemas';

/**
 * @fileOverview Mock QuickBooks service for checking invoice status.
 */

// In a real app, this would make an API call to QuickBooks.
const FAKE_QUICKBOOKS_DB: { [invoiceNumber: string]: QuickBooksInvoiceStatus } = {
    '554951': QuickBooksInvoiceStatus.Paid,
    'INV-PENDING-456': QuickBooksInvoiceStatus.Sent,
};


export async function getQuickBooksInvoiceStatus(invoiceNumber: string): Promise<QuickBooksInvoiceStatus | null> {
    console.log('Checking QuickBooks for invoice:', invoiceNumber);

    const status = FAKE_QUICKBOOKS_DB[invoiceNumber];
    
    return Promise.resolve(status || null);
}
