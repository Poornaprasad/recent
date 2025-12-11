/**
 * Domain types and models
 * Central location for all domain-specific types
 */

import type { ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import type { BaseEntity } from '../repositories/base';

// Remove the `duplicateCheck` field from the type as it's not stored
// Also make documentType optional since it's stored separately
type ExtractedDataOnly = Omit<ExtractInvoiceDataOutput, 'duplicateCheck' | 'documentType'>;

export type StoredInvoice = BaseEntity & ExtractedDataOnly & {
  status: 'Paid' | 'Pending' | 'Review' | 'Draft';
  invoiceDataUri: string; // The file path (e.g., /uploads/invoice-123.png) or data URI for legacy
  isDuplicate?: boolean;
  duplicateReason?: string;
  isRecurring?: boolean;
  recurringPattern?: string; // e.g., "monthly", "quarterly"
  hasAmountAnomaly?: boolean;
  amountAnomalyReason?: string;
  expectedAmount?: number;
  amountDeviationPercent?: number;
  isHighValue?: boolean;
  highValueReason?: string;
  requiresEscalation?: boolean;
  escalationLevel?: 'standard' | 'high' | 'critical';
  escalationReason?: 'low_accuracy' | 'duplicate' | 'multiple_vendors' | 'no_clarity';
  hasMultipleVendors?: boolean;
  accuracyScore?: number; // 0-100 score for extraction accuracy
  requiresSpecialHandling?: boolean;
  specialHandlingReason?: 'per_diem' | 'mixed_document_types' | 'other';
  comment?: string; // User comments/notes
  caseNumber?: string; // SmartAdvocate case number
  state?: 'CA' | 'NY'; // State: CA (California) or NY (New York)
  paymentType?: 'Receipt' | 'Invoice' | 'Non-Financial' | 'Other'; // Payment type category
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Requires_Approval'; // Approval status
  approvedBy?: string; // User ID who approved
  approvedAt?: Date; // Timestamp of approval
  createdBy?: string; // User ID who created/uploaded
  assignedTo?: string; // User ID assigned to process
  vendorRequires1099?: boolean; // Flag indicating vendor requires 1099 (not in vendor list or marked as requiring 1099)
  documentType?: 'Webhook Source' | 'Invoice' | 'Receipt' | 'Per Diem' | 'Estate' | 'Other Document' | 'Other' | 'Office Disbursement' | 'Office Reimbursement' | 'Case Details' | 'Reimbursement' | 'Office Credit Card Bill'; // Document type classification
};

export type User = BaseEntity & {
  name: string;
  email: string;
  role: 'admin' | 'director' | 'manager' | 'senior_accountant' | 'ny_accountant' | 'ca_accountant';
  status: 'Active' | 'Inactive' | 'Invited';
  assignedStates?: string[]; // For accountant roles - additional states they can access: ["CA", "NY"]
};

export type Vendor = BaseEntity & {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  vendorType?: string; // Vendor type name
  requires1099?: boolean; // Flag for 1099 requirement
  requiresW9?: boolean; // Flag for W9 requirement
  w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
  w9ReceivedDate?: Date;
  w9ExpiryDate?: Date;
  isPaused?: boolean;
  pausedReason?: string;
  pausedUntil?: Date;
  status: 'Active' | 'Inactive';
};

export type VendorType = BaseEntity & {
  name: string;
  description?: string;
  isActive: boolean;
};

export type PendingVendor = BaseEntity & {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  vendorType?: string;
  invoiceId?: string; // Reference to the invoice that detected this vendor
  status: 'Pending' | 'Completed' | 'Rejected';
};

export type AuditLog = BaseEntity & {
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  details?: string;
  ipAddress?: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
};

// Invoice status types
export type InvoiceStatus = 'Paid' | 'Pending' | 'Review' | 'Draft';
export type DocumentType = 'Webhook Source' | 'Invoice' | 'Receipt' | 'Per Diem' | 'Estate' | 'Other Document' | 'Other' | 'Office Disbursement' | 'Office Reimbursement' | 'Case Details' | 'Reimbursement' | 'Office Credit Card Bill';
export type UserStatus = 'Active' | 'Inactive' | 'Invited';
export type VendorStatus = 'Active' | 'Inactive';
export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type W9Status = 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
export type EscalationReason = 'low_accuracy' | 'duplicate' | 'multiple_vendors' | 'no_clarity';
export type SpecialHandlingReason = 'per_diem' | 'mixed_document_types' | 'other';

// Extracted field structure
export type ExtractedField<T = unknown> = {
  value: T;
  confidence: number;
  reasoning: string;
  bbox?: Array<{ x: number; y: number }> | null;
} | null;

