/**
 * Domain constants
 * Centralized constants used throughout the application
 */

export const INVOICE_STATUSES = {
  PAID: 'Paid',
  PENDING: 'Pending',
  REVIEW: 'Review',
  DRAFT: 'Draft',
} as const;

export const DOCUMENT_TYPES = {
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
} as const;

export const USER_STATUSES = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  INVITED: 'Invited',
} as const;

export const VENDOR_STATUSES = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
} as const;

export const AUDIT_SEVERITIES = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
} as const;

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  LOW: 0.75,
  MEDIUM: 0.85,
  HIGH: 0.95,
} as const;

// Date thresholds for duplicate detection
export const DUPLICATE_CHECK_MONTHS = 2;

// High-value invoice escalation thresholds
export const HIGH_VALUE_THRESHOLDS = {
  STANDARD: 10,      // $10,000 - Standard threshold requiring review
  HIGH: 1000,         // $50,000 - High threshold requiring manager approval
  CRITICAL: 10000,    // $100,000 - Critical threshold requiring executive approval
} as const;

// File upload constraints
export const FILE_CONSTRAINTS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/heic', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.heic', '.pdf'],
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

