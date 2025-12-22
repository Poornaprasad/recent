/**
 * Status utility functions
 * Shared utilities for status badge styling
 */

import { cn } from './utils';
import type { StoredInvoice } from '../domain/types';

export function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800";
    case "invited":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800";
    case "inactive":
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800";
    case "paid":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800";
    case "review":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800";
    case "draft":
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

/**
 * Get the display status for an invoice
 * Shows "Approved" when approvalStatus is 'Approved', otherwise shows the workflow status
 */
export function getDisplayStatus(invoice: StoredInvoice): string {
  if (invoice.approvalStatus === 'Approved') {
    return 'Approved';
  }
  if (invoice.approvalStatus === 'Rejected') {
    return 'Rejected';
  }
  return invoice.status || 'Draft';
}

/**
 * Check if disbursement has been sent to CRM
 * Returns true if disbursementResponse exists and is not empty
 */
export function hasDisbursementBeenSent(invoice: StoredInvoice): boolean {
  if (!invoice.disbursementResponse) {
    return false;
  }
  
  // Check if it's a string (JSON stringified)
  if (typeof invoice.disbursementResponse === 'string') {
    try {
      const parsed = JSON.parse(invoice.disbursementResponse);
      return parsed && Object.keys(parsed).length > 0;
    } catch {
      // If parsing fails, check if it's a non-empty string
      return invoice.disbursementResponse.trim().length > 0;
    }
  }
  
  // Check if it's an object
  if (typeof invoice.disbursementResponse === 'object') {
    return Object.keys(invoice.disbursementResponse).length > 0;
  }
  
  return false;
}

/**
 * Check if invoice can be pushed to CRM
 * Returns true if invoice is approved (status = 'Pending') but disbursement hasn't been sent
 * Returns false if invoice has duplicate CRM status (should not be uploaded to CRM)
 */
export function canPushToCrm(invoice: StoredInvoice): boolean {
  // Invoice must be approved (status = 'Pending')
  const isApproved = invoice.status === 'Pending' || invoice.approvalStatus === 'Approved';
  
  // Disbursement must not have been sent yet
  const notSent = !hasDisbursementBeenSent(invoice);
  
  // Invoice must not have duplicate CRM status (duplicates should not be uploaded)
  const notDuplicate = invoice.crmStatus !== 'Duplicate';
  
  return isApproved && notSent && notDuplicate;
}

/**
 * Check if invoice has been approved and pushed to CRM
 * Returns true if invoice is approved AND has been sent to CRM (has disbursementResponse)
 */
export function isApprovedAndPushedToCrm(invoice: StoredInvoice): boolean {
  // Invoice must be approved
  const isApproved = invoice.approvalStatus === 'Approved' || invoice.status === 'Pending';
  
  // Disbursement must have been sent to CRM
  const hasBeenSent = hasDisbursementBeenSent(invoice);
  
  // Or CRM status is 'Associated' (found in CRM)
  const isAssociated = invoice.crmStatus === 'Associated';
  
  return isApproved && (hasBeenSent || isAssociated);
}





