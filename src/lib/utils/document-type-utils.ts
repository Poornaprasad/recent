/**
 * Document type utility functions
 * Shared utilities for document type badge styling and descriptions
 */

import { cn } from './utils';
import type { DocumentType } from '../domain/types';

/**
 * Get badge styling classes for a document type
 */
export function getDocumentTypeBadgeClass(documentType: DocumentType | undefined): string {
  if (!documentType) {
    return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800';
  }

  const typeMap: Record<DocumentType, string> = {
    'Invoice': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
    'Receipt': 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
    'Per Diem': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
    'Estate': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800',
    'Other Document': 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800',
    'Reimbursement': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
    'Office Credit Card Bill': 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
    'Webhook Source': 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800',
    'Other': 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800',
    'Office Disbursement': 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-800',
    'Office Reimbursement': 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-800',
    'Case Details': 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-800',
  };

  return typeMap[documentType] || 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800';
}

/**
 * Get description text for a document type
 */
export function getDocumentTypeDescription(documentType: DocumentType | undefined): string {
  if (!documentType) {
    return '';
  }

  const descriptions: Record<DocumentType, string> = {
    'Invoice': 'This document requests payment for goods or services.',
    'Receipt': 'This document confirms payment has been received.',
    'Per Diem': 'This is a per diem document (daily allowance) that can be processed as either an invoice or receipt.',
    'Estate': 'This is an estate-related document such as probate, estate accounting, or executor documents.',
    'Other Document': 'This is a non-financial document or misclassified document.',
    'Reimbursement': 'This document requests reimbursement for expenses incurred.',
    'Office Credit Card Bill': 'This document is a credit card statement or bill for office expenses.',
    'Webhook Source': 'This document was received via webhook.',
    'Other': 'This is an uncategorized document.',
    'Office Disbursement': 'This is an office disbursement document.',
    'Office Reimbursement': 'This is an office reimbursement document.',
    'Case Details': 'This document contains case details.',
  };

  return descriptions[documentType] || '';
}





