/**
 * Database schema definitions for PostgreSQL
 */

import { pgTable, text, integer, real, timestamp, boolean, serial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Invoices table
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number'),
  invoiceDate: text('invoice_date'),
  vendorName: text('vendor_name'),
  vendorAddress: text('vendor_address'),
  customerName: text('customer_name'),
  totalAmount: real('total_amount'),
  paymentTerms: text('payment_terms'),
  lineItems: text('line_items'), // JSON string
  // New extracted fields
  amount: real('amount'), // Alternative field name for totalAmount
  clientName: text('client_name'), // Alternative field name for customerName
  description: text('description'), // High-level description of the invoice/receipt
  dueDate: text('due_date'), // Payment due date
  status: text('status', { enum: ['Paid', 'Pending', 'Review', 'Draft'] }).notNull(),
  documentType: text('document_type', { enum: ['Webhook Source', 'Invoice', 'Receipt', 'Per Diem', 'Estate', 'Other Document', 'Other', 'Office Disbursement', 'Office Reimbursement', 'Case Details', 'Reimbursement', 'Office Credit Card Bill'] }),
  invoiceDataUri: text('invoice_data_uri').notNull(),
  isDuplicate: boolean('is_duplicate').default(false),
  duplicateReason: text('duplicate_reason'),
  isRecurring: boolean('is_recurring').default(false),
  recurringPattern: text('recurring_pattern'), // e.g., "monthly", "quarterly"
  hasAmountAnomaly: boolean('has_amount_anomaly').default(false),
  amountAnomalyReason: text('amount_anomaly_reason'),
  expectedAmount: real('expected_amount'), // Expected amount based on historical average
  amountDeviationPercent: real('amount_deviation_percent'), // Percentage deviation from expected
  isHighValue: boolean('is_high_value').default(false),
  highValueReason: text('high_value_reason'),
  requiresEscalation: boolean('requires_escalation').default(false),
  escalationLevel: text('escalation_level'), // 'standard', 'high', 'critical'
  escalationReason: text('escalation_reason'), // 'low_accuracy', 'duplicate', 'multiple_vendors', 'no_clarity'
  hasMultipleVendors: boolean('has_multiple_vendors').default(false),
  accuracyScore: real('accuracy_score'), // 0-100 score for extraction accuracy
  requiresSpecialHandling: boolean('requires_special_handling').default(false),
  specialHandlingReason: text('special_handling_reason'), // 'per_diem', 'mixed_document_types', 'other'
  comment: text('comment'), // User comments/notes on the invoice
  caseNumber: text('case_number'), // SmartAdvocate case number
  state: text('state', { enum: ['CA', 'NY'] }), // State: CA (California) or NY (New York)
  paymentType: text('payment_type', { enum: ['Receipt', 'Invoice', 'Non-Financial', 'Other'] }), // Payment type category
  approvalStatus: text('approval_status', { enum: ['Pending', 'Approved', 'Rejected', 'Requires_Approval'] }).default('Pending'),
  approvedBy: text('approved_by'), // User ID who approved
  approvedAt: timestamp('approved_at'), // Timestamp of approval
  createdBy: text('created_by'), // User ID who created/uploaded
  assignedTo: text('assigned_to'), // User ID assigned to process

  // Extracted field metadata (JSON strings)
  invoiceNumberMeta: text('invoice_number_meta'), // {confidence, reasoning, bbox}
  invoiceDateMeta: text('invoice_date_meta'),
  vendorNameMeta: text('vendor_name_meta'),
  vendorAddressMeta: text('vendor_address_meta'),
  customerNameMeta: text('customer_name_meta'),
  totalAmountMeta: text('total_amount_meta'),
  paymentTermsMeta: text('payment_terms_meta'),
  lineItemsMeta: text('line_items_meta'),
  documentTypeMeta: text('document_type_meta'),
  // Metadata for new fields
  amountMeta: text('amount_meta'), // {confidence, reasoning, bbox}
  clientNameMeta: text('client_name_meta'),
  descriptionMeta: text('description_meta'),
  dueDateMeta: text('due_date_meta'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password'), // Hashed password (nullable for OAuth users)
  role: text('role', { enum: ['admin', 'director', 'manager', 'senior_accountant', 'ny_accountant', 'ca_accountant'] }).notNull(),
  status: text('status', { enum: ['Active', 'Inactive', 'Invited'] }).notNull(),
  assignedStates: text('assigned_states'), // JSON array of states for accountant roles: ["CA", "NY"]
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Vendor types table (company-wide approved types)
export const vendorTypes = pgTable('vendor_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type VendorType = typeof vendorTypes.$inferSelect;
export type NewVendorType = typeof vendorTypes.$inferInsert;

// Vendors table
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  vendorType: text('vendor_type'), // References vendor_types.name
  uniqueContactId: text('unique_contact_id'), // CRM contact ID for linking
  taxId: text('tax_id'), // Tax ID (SSN/EIN) - if exists, W9 is considered received
  requires1099: boolean('requires_1099').default(false),
  requiresW9: boolean('requires_w9').default(false),
  w9Status: text('w9_status', { enum: ['Not Required', 'Required', 'Received', 'Pending', 'Expired'] }).default('Not Required'),
  w9ReceivedDate: timestamp('w9_received_date'),
  w9ExpiryDate: timestamp('w9_expiry_date'),
  form1099Status: text('form_1099_status', { enum: ['Not Required', 'Required', 'Received', 'Tracked', 'Pending'] }).default('Not Required'),
  form1099ReceivedDate: timestamp('form_1099_received_date'),
  isPaused: boolean('is_paused').default(false),
  pausedReason: text('paused_reason'),
  pausedUntil: timestamp('paused_until'),
  status: text('status', { enum: ['Active', 'Inactive'] }).notNull().default('Active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;

// Pending vendors table (vendors detected during invoice processing, awaiting setup)
export const pendingVendors = pgTable('pending_vendors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  vendorType: text('vendor_type'),
  invoiceId: text('invoice_id'), // Reference to the invoice that detected this vendor
  status: text('status', { enum: ['Pending', 'Completed', 'Rejected'] }).notNull().default('Pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type PendingVendor = typeof pendingVendors.$inferSelect;
export type NewPendingVendor = typeof pendingVendors.$inferInsert;

// Audit logs table
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  user: text('user').notNull(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  details: text('details'),
  ipAddress: text('ip_address'),
  severity: text('severity', { enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] }).notNull().default('INFO'),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// Disbursement types table
export const disbursementTypes = pgTable('disbursement_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type DisbursementType = typeof disbursementTypes.$inferSelect;
export type NewDisbursementType = typeof disbursementTypes.$inferInsert;

// Disbursement statuses table
export const disbursementStatuses = pgTable('disbursement_statuses', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type DisbursementStatus = typeof disbursementStatuses.$inferSelect;
export type NewDisbursementStatus = typeof disbursementStatuses.$inferInsert;

// Bank accounts table
export const bankAccounts = pgTable('bank_accounts', {
  id: text('id').primaryKey(),
  accountName: text('account_name').notNull(),
  accountNumber: text('account_number'),
  routingNumber: text('routing_number'),
  bankName: text('bank_name').notNull(),
  accountType: text('account_type', { enum: ['Checking', 'Savings', 'Money Market', 'Other'] }),
  state: text('state', { enum: ['CA', 'NY'] }),
  isActive: boolean('is_active').default(true),
  lastUpdatedBy: text('last_updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;

// Expense accounts table
export const expenseAccounts = pgTable('expense_accounts', {
  id: text('id').primaryKey(),
  accountCode: text('account_code').notNull().unique(),
  accountName: text('account_name').notNull(),
  description: text('description'),
  accountType: text('account_type', { enum: ['Expense', 'Asset', 'Liability', 'Revenue', 'Equity'] }),
  parentAccountId: text('parent_account_id'), // For hierarchical accounts
  state: text('state', { enum: ['CA', 'NY'] }),
  isActive: boolean('is_active').default(true),
  lastUpdatedBy: text('last_updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ExpenseAccount = typeof expenseAccounts.$inferSelect;
export type NewExpenseAccount = typeof expenseAccounts.$inferInsert;

// W9 tracking table
export const vendorW9Status = pgTable('vendor_w9_status', {
  id: text('id').primaryKey(),
  vendorId: text('vendor_id').notNull(), // References vendors.id
  isRequired: boolean('is_required').default(false),
  status: text('status', { enum: ['Not Required', 'Required', 'Received', 'Pending', 'Expired'] }).default('Not Required'),
  receivedDate: timestamp('received_date'),
  expiryDate: timestamp('expiry_date'),
  documentPath: text('document_path'), // Path to stored W9 document
  thresholdAmount: real('threshold_amount').default(600), // Default $600 threshold
  notes: text('notes'),
  lastUpdatedBy: text('last_updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type VendorW9Status = typeof vendorW9Status.$inferSelect;
export type NewVendorW9Status = typeof vendorW9Status.$inferInsert;

// Credit authorization table (for amounts above $5000)
export const creditAuthorizations = pgTable('credit_authorizations', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull(), // References invoices.id
  amount: real('amount').notNull(),
  thresholdAmount: real('threshold_amount').default(5000),
  requestedBy: text('requested_by').notNull(), // User ID
  authorizedBy: text('authorized_by'), // User ID who authorized
  authorizationStatus: text('authorization_status', { enum: ['Pending', 'Approved', 'Rejected', 'Expired'] }).default('Pending'),
  authorizationDate: timestamp('authorization_date'),
  expiryDate: timestamp('expiry_date'),
  reason: text('reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CreditAuthorization = typeof creditAuthorizations.$inferSelect;
export type NewCreditAuthorization = typeof creditAuthorizations.$inferInsert;

// Enhanced audit logs for approvals and edits
export const approvalAuditLogs = pgTable('approval_audit_logs', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id'), // References invoices.id (nullable for other resources)
  userId: text('user_id').notNull(), // User who performed the action
  action: text('action', { enum: ['Approved', 'Rejected', 'Requested Approval', 'Edited', 'Created', 'Deleted', 'Assigned', 'Unassigned'] }).notNull(),
  resourceType: text('resource_type', { enum: ['Invoice', 'Vendor', 'User', 'Disbursement', 'Other'] }).notNull(),
  resourceId: text('resource_id').notNull(),
  previousValue: text('previous_value'), // JSON string of previous state
  newValue: text('new_value'), // JSON string of new state
  changedFields: text('changed_fields'), // JSON array of field names that changed
  reason: text('reason'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export type ApprovalAuditLog = typeof approvalAuditLogs.$inferSelect;
export type NewApprovalAuditLog = typeof approvalAuditLogs.$inferInsert;

// Daily run updates tracking
export const dailyRunUpdates = pgTable('daily_run_updates', {
  id: text('id').primaryKey(),
  runDate: timestamp('run_date').notNull(),
  updateType: text('update_type', { enum: ['Disbursement Type', 'Disbursement Status', 'Bank Account', 'Expense Account', 'Vendor', 'Other'] }).notNull(),
  resourceId: text('resource_id').notNull(),
  previousValue: text('previous_value'), // JSON string
  newValue: text('new_value'), // JSON string
  updatedBy: text('updated_by'), // System or user ID
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type DailyRunUpdate = typeof dailyRunUpdates.$inferSelect;
export type NewDailyRunUpdate = typeof dailyRunUpdates.$inferInsert;

// Approval rules table (configurable approval thresholds)
export const approvalRules = pgTable('approval_rules', {
  id: text('id').primaryKey(),
  state: text('state', { enum: ['CA', 'NY', 'ALL'] }).notNull().default('ALL'),
  thresholdAmount: real('threshold_amount').notNull().default(5000),
  requiresRoles: text('requires_roles'), // JSON array: ["director", "admin"]
  isActive: boolean('is_active').default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ApprovalRule = typeof approvalRules.$inferSelect;
export type NewApprovalRule = typeof approvalRules.$inferInsert;

// Invoice attachments table (for file storage)
export const invoiceAttachments = pgTable('invoice_attachments', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull(), // References invoices.id
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(), // Path in storage (S3, local, etc.)
  fileSize: integer('file_size'), // Size in bytes
  mimeType: text('mime_type'),
  storageType: text('storage_type', { enum: ['local', 's3', 'gcs'] }).default('local'),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type InvoiceAttachment = typeof invoiceAttachments.$inferSelect;
export type NewInvoiceAttachment = typeof invoiceAttachments.$inferInsert;

// Case-vendor-contact type mappings table
// Stores which contact type was used for a vendor in a specific case
export const caseVendorDisbursementTypes = pgTable('case_vendor_disbursement_types', {
  id: text('id').primaryKey(),
  caseNumber: text('case_number').notNull(), // SmartAdvocate case number
  vendorName: text('vendor_name').notNull(), // Vendor name
  disbursementType: text('contact_type').notNull(), // Contact type name from API (renamed from disbursement_type)
  invoiceId: text('invoice_id'), // Optional reference to the invoice that set this mapping
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CaseVendorDisbursementType = typeof caseVendorDisbursementTypes.$inferSelect;
export type NewCaseVendorDisbursementType = typeof caseVendorDisbursementTypes.$inferInsert;

// Permission matrix table (stores role-permission mappings, editable only by Admin and Director)
export const permissionMatrix = pgTable('permission_matrix', {
  id: text('id').primaryKey(),
  role: text('role', { enum: ['admin', 'director', 'manager', 'senior_accountant', 'ny_accountant', 'ca_accountant'] }).notNull(),
  permission: text('permission').notNull(), // Permission name (e.g., 'view_invoices', 'edit_invoices')
  isGranted: boolean('is_granted').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by'), // User ID who created this permission mapping
  updatedBy: text('updated_by'), // User ID who last updated this permission mapping
});

export type PermissionMatrix = typeof permissionMatrix.$inferSelect;
export type NewPermissionMatrix = typeof permissionMatrix.$inferInsert;
