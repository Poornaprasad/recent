/**
 * Export utility functions
 * Utilities for exporting data to various formats (CSV, etc.)
 */

import type { StoredInvoice } from '../domain/types';
import { getOverallConfidence, getFieldsExtractedCount, formatTotalAmount } from './invoice-utils';

/**
 * Exports invoices to CSV format
 */
export function exportInvoicesToCSV(invoices: StoredInvoice[]): Blob {
  const headers = [
    'Invoice #',
    'Type',
    'Vendor',
    'Date',
    'Amount',
    'Status',
    'Confidence',
    'Fields Extracted'
  ];

  const rows = invoices.map(inv => [
    inv.invoiceNumber?.value || inv.id,
    inv.documentType || 'N/A',
    inv.vendorName?.value || 'N/A',
    inv.invoiceDate?.value || 'N/A',
    formatTotalAmount(inv.totalAmount?.value),
    inv.status || 'N/A',
    (getOverallConfidence(inv) * 100).toFixed(1) + '%',
    getFieldsExtractedCount(inv).toString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return new Blob([csvContent], { type: 'text/csv' });
}

/**
 * Downloads a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports invoices to CSV and triggers download
 */
export function exportInvoicesToCSVFile(invoices: StoredInvoice[], filename?: string): void {
  const blob = exportInvoicesToCSV(invoices);
  const defaultFilename = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadBlob(blob, filename || defaultFilename);
}

