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
    'Reimbursement': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
    'Office Credit Card Bill': 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
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
    'Reimbursement': 'This document requests reimbursement for expenses incurred.',
    'Office Credit Card Bill': 'This document is a credit card statement or bill for office expenses.',
  };

  return descriptions[documentType] || '';
}





