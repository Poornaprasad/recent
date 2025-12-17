/**
 * Invoice utility functions
 * Shared utilities for invoice-related calculations and operations
 */

import type { StoredInvoice } from '../domain/types';

/**
 * Calculates the overall confidence score for an invoice
 * by averaging the confidence scores of all extracted fields
 */
export function getOverallConfidence(invoice: StoredInvoice): number {
  const fields = Object.values(invoice).filter(
    (value): value is { confidence: number } => 
      value !== null && 
      typeof value === 'object' && 
      'confidence' in value &&
      typeof (value as { confidence: unknown }).confidence === 'number'
  );

  if (fields.length === 0) return 0;
  
  const totalConfidence = fields.reduce(
    (acc, field) => acc + (field.confidence || 0), 
    0
  );
  
  return totalConfidence / fields.length;
}

/**
 * Counts the number of extracted fields in an invoice
 */
export function getFieldsExtractedCount(invoice: StoredInvoice): number {
  const excludedKeys = new Set(['isDuplicate', 'duplicateReason', 'invoiceDataUri', 'status', 'id', 'documentType']);
  
  return Object.keys(invoice).filter(
    key => !excludedKeys.has(key) && invoice[key as keyof StoredInvoice] !== null
  ).length;
}

/**
 * Parses an invoice amount value to a number
 * Handles both string (e.g., "$550.80") and number types
 * Returns 0 if parsing fails
 */
export function parseInvoiceAmount(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Remove currency symbols ($, €, £, etc.), commas, whitespace, and common currency codes (USD, EUR, GBP, etc.)
    // First remove currency symbols and formatting
    let cleanedAmount = value.replace(/[$€£¥,\s]/g, '');
    // Remove common currency codes (case-insensitive)
    cleanedAmount = cleanedAmount.replace(/\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR)\b/gi, '');
    // Parse the remaining numeric value
    const parsed = parseFloat(cleanedAmount);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
}

/**
 * Formats a total amount value to a string with 2 decimal places
 * Handles both string (e.g., "$550.80") and number types
 */
export function formatTotalAmount(value: unknown): string {
  const amount = parseInvoiceAmount(value);
  return amount.toFixed(2);
}

/**
 * Formats an amount as currency (USD)
 * Returns formatted string like "$1,234.56"
 */
export function formatCurrency(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

/**
 * Invoice filter options
 */
export interface InvoiceFilters {
  searchTerm?: string;
  statusFilter?: string;
  documentTypeFilter?: string;
  vendorFilter?: string;
}

/**
 * Filters invoices based on provided criteria
 */
export function filterInvoices(
  invoices: StoredInvoice[],
  filters: InvoiceFilters
): StoredInvoice[] {
  const { searchTerm = '', statusFilter = 'all', documentTypeFilter = 'all', vendorFilter = 'all' } = filters;
  
  return invoices.filter(invoice => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (invoice.invoiceNumber?.value || '').toLowerCase().includes(searchLower) ||
      (invoice.vendorName?.value || '').toLowerCase().includes(searchLower) ||
      (invoice.customerName?.value || '').toLowerCase().includes(searchLower) ||
      (invoice.vendorAddress?.value || '').toLowerCase().includes(searchLower) ||
      invoice.id.toLowerCase().includes(searchLower);

    // Status filter
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    // Document type filter
    const matchesDocumentType = documentTypeFilter === 'all' || invoice.documentType === documentTypeFilter;

    // Vendor filter
    const matchesVendor = vendorFilter === 'all' || invoice.vendorName?.value === vendorFilter;

    return matchesSearch && matchesStatus && matchesDocumentType && matchesVendor;
  });
}

/**
 * Sort field options
 */
export type SortField = 'date' | 'vendor' | 'amount' | 'confidence' | 'status' | 'invoiceNumber' | 'caseNumber';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sorts invoices based on the specified field and direction
 */
export function sortInvoices(
  invoices: StoredInvoice[],
  sortField: SortField,
  sortDirection: SortDirection
): StoredInvoice[] {
  const sorted = [...invoices].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'date':
        const dateA = a.invoiceDate?.value ? new Date(a.invoiceDate.value).getTime() : 0;
        const dateB = b.invoiceDate?.value ? new Date(b.invoiceDate.value).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'vendor':
        const vendorA = (a.vendorName?.value || '').toLowerCase();
        const vendorB = (b.vendorName?.value || '').toLowerCase();
        comparison = vendorA.localeCompare(vendorB);
        break;
      case 'amount':
        const amountA = parseInvoiceAmount(a.totalAmount?.value);
        const amountB = parseInvoiceAmount(b.totalAmount?.value);
        comparison = amountA - amountB;
        break;
      case 'confidence':
        comparison = getOverallConfidence(a) - getOverallConfidence(b);
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
      case 'invoiceNumber':
        const numA = (a.invoiceNumber?.value || a.id).toLowerCase();
        const numB = (b.invoiceNumber?.value || b.id).toLowerCase();
        comparison = numA.localeCompare(numB);
        break;
      case 'caseNumber':
        const caseA = (a.caseNumber || '').toLowerCase();
        const caseB = (b.caseNumber || '').toLowerCase();
        comparison = caseA.localeCompare(caseB);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Gets unique vendor names from a list of invoices
 */
export function getUniqueVendors(invoices: StoredInvoice[]): string[] {
  const vendors = new Set<string>();
  invoices.forEach(inv => {
    const vendor = inv.vendorName?.value;
    if (vendor) vendors.add(vendor);
  });
  return Array.from(vendors).sort();
}





