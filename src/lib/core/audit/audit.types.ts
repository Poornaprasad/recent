/**
 * Audit Types and Enums
 * Comprehensive type definitions for the audit logging system
 */

/**
 * Audit action categories - specific to this invoice management system
 */
export enum AuditAction {
  // Authentication actions
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_CHANGE_FAILED = 'password_change_failed',
  SESSION_EXPIRED = 'session_expired',

  // Invoice actions
  INVOICE_CREATED = 'invoice_created',
  INVOICE_UPDATED = 'invoice_updated',
  INVOICE_DELETED = 'invoice_deleted',
  INVOICE_VIEWED = 'invoice_viewed',
  INVOICE_APPROVED = 'invoice_approved',
  INVOICE_REJECTED = 'invoice_rejected',
  INVOICE_ESCALATED = 'invoice_escalated',
  INVOICE_STATUS_CHANGED = 'invoice_status_changed',
  INVOICE_FIELD_EDITED = 'invoice_field_edited',
  INVOICE_COMMENT_ADDED = 'invoice_comment_added',
  INVOICE_FLAGGED_FOR_REVIEW = 'invoice_flagged_for_review',
  INVOICE_CRM_PUSHED = 'invoice_crm_pushed',
  INVOICE_ASSIGNED = 'invoice_assigned',
  INVOICE_BULK_PROCESSED = 'invoice_bulk_processed',

  // Approval workflow actions
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_THRESHOLD_EXCEEDED = 'approval_threshold_exceeded',
  APPROVAL_RULE_CREATED = 'approval_rule_created',
  APPROVAL_RULE_UPDATED = 'approval_rule_updated',

  // Escalation actions
  ESCALATION_TRIGGERED = 'escalation_triggered',
  ESCALATION_RESOLVED = 'escalation_resolved',
  ESCALATION_LEVEL_CHANGED = 'escalation_level_changed',

  // Vendor actions
  VENDOR_CREATED = 'vendor_created',
  VENDOR_UPDATED = 'vendor_updated',
  VENDOR_DELETED = 'vendor_deleted',
  VENDOR_W9_STATUS_CHANGED = 'vendor_w9_status_changed',
  VENDOR_1099_STATUS_CHANGED = 'vendor_1099_status_changed',
  VENDOR_PAUSED = 'vendor_paused',
  VENDOR_RESUMED = 'vendor_resumed',
  VENDOR_TYPE_CREATED = 'vendor_type_created',
  PENDING_VENDOR_COMPLETED = 'pending_vendor_completed',
  PENDING_VENDOR_REJECTED = 'pending_vendor_rejected',

  // User management actions
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_ROLE_CHANGED = 'user_role_changed',
  USER_STATUS_CHANGED = 'user_status_changed',
  USER_STATES_ASSIGNED = 'user_states_assigned',

  // Permission/Settings actions
  PERMISSION_UPDATED = 'permission_updated',
  SETTINGS_CHANGED = 'settings_changed',

  // Data export actions
  DATA_EXPORTED = 'data_exported',
  REPORT_GENERATED = 'report_generated',

  // API/System actions
  API_ERROR = 'api_error',
  SYSTEM_ERROR = 'system_error',
  VALIDATION_ERROR = 'validation_error',
  ACCESS_DENIED = 'access_denied',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

  // CRM Integration actions
  CRM_SYNC_STARTED = 'crm_sync_started',
  CRM_SYNC_COMPLETED = 'crm_sync_completed',
  CRM_SYNC_FAILED = 'crm_sync_failed',
  DISBURSEMENT_CREATED = 'disbursement_created',

  // Bulk operations
  BULK_APPROVAL = 'bulk_approval',
  BULK_STATUS_UPDATE = 'bulk_status_update',
  BULK_DELETE = 'bulk_delete',
}

/**
 * Resource types that can be audited
 */
export enum AuditResource {
  INVOICE = 'invoice',
  USER = 'user',
  VENDOR = 'vendor',
  PENDING_VENDOR = 'pending_vendor',
  APPROVAL_RULE = 'approval_rule',
  PERMISSION = 'permission',
  SETTINGS = 'settings',
  DISBURSEMENT = 'disbursement',
  VENDOR_TYPE = 'vendor_type',
  AUTHENTICATION = 'authentication',
  SYSTEM = 'system',
  CRM = 'crm',
  REPORT = 'report',
}

/**
 * Severity levels for audit entries
 */
export enum AuditSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Category for grouping audit actions
 */
export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  INVOICE_MANAGEMENT = 'invoice_management',
  APPROVAL_WORKFLOW = 'approval_workflow',
  VENDOR_MANAGEMENT = 'vendor_management',
  USER_MANAGEMENT = 'user_management',
  SYSTEM = 'system',
  SECURITY = 'security',
  DATA_EXPORT = 'data_export',
  CRM_INTEGRATION = 'crm_integration',
}

/**
 * Base audit log entry interface
 */
export interface AuditLogEntry {
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  category: AuditCategory;
  details?: AuditDetails;
  metadata?: AuditMetadata;
  severity: AuditSeverity;
}

/**
 * Detailed information about the audit action
 */
export interface AuditDetails {
  // General fields
  description?: string;
  reason?: string;

  // Invoice-related
  invoiceNumber?: string;
  vendorName?: string;
  amount?: number;
  state?: string;
  previousStatus?: string;
  newStatus?: string;

  // Approval-related
  approvalStatus?: string;
  thresholdAmount?: number;
  escalationLevel?: string;
  escalationReason?: string;
  requiredRoles?: string[];

  // Change tracking
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  changedFields?: string[];
  changeCount?: number;

  // Error details
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;

  // Additional context
  [key: string]: any;
}

/**
 * Metadata about the audit event
 */
export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  endpoint?: string;
  method?: string;
  duration?: number;
  affectedCount?: number;
}

/**
 * Filter options for querying audit logs
 */
export interface AuditLogFilter {
  userId?: string;
  action?: AuditAction | AuditAction[];
  resource?: AuditResource | AuditResource[];
  resourceId?: string;
  category?: AuditCategory | AuditCategory[];
  severity?: AuditSeverity | AuditSeverity[];
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated audit log result
 */
export interface AuditLogResult {
  logs: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Full audit log record from database
 */
export interface AuditLogRecord {
  id: string;
  timestamp: Date;
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  category: string;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  severity: string;
}

/**
 * Action to severity mapping
 */
export const ACTION_SEVERITY_MAP: Partial<Record<AuditAction, AuditSeverity>> = {
  // Critical severity
  [AuditAction.LOGIN_FAILED]: AuditSeverity.WARNING,
  [AuditAction.ACCESS_DENIED]: AuditSeverity.WARNING,
  [AuditAction.SYSTEM_ERROR]: AuditSeverity.ERROR,
  [AuditAction.API_ERROR]: AuditSeverity.ERROR,
  [AuditAction.CRM_SYNC_FAILED]: AuditSeverity.ERROR,
  [AuditAction.PASSWORD_CHANGE_FAILED]: AuditSeverity.WARNING,

  // Warning severity
  [AuditAction.APPROVAL_THRESHOLD_EXCEEDED]: AuditSeverity.WARNING,
  [AuditAction.ESCALATION_TRIGGERED]: AuditSeverity.WARNING,
  [AuditAction.RATE_LIMIT_EXCEEDED]: AuditSeverity.WARNING,
  [AuditAction.VALIDATION_ERROR]: AuditSeverity.WARNING,

  // Info severity (default for most actions)
  [AuditAction.LOGIN_SUCCESS]: AuditSeverity.INFO,
  [AuditAction.LOGOUT]: AuditSeverity.INFO,
  [AuditAction.INVOICE_APPROVED]: AuditSeverity.INFO,
  [AuditAction.INVOICE_REJECTED]: AuditSeverity.INFO,
  [AuditAction.USER_CREATED]: AuditSeverity.INFO,
  [AuditAction.VENDOR_CREATED]: AuditSeverity.INFO,
};

/**
 * Action to category mapping
 */
export const ACTION_CATEGORY_MAP: Record<AuditAction, AuditCategory> = {
  // Authentication
  [AuditAction.LOGIN_SUCCESS]: AuditCategory.AUTHENTICATION,
  [AuditAction.LOGIN_FAILED]: AuditCategory.AUTHENTICATION,
  [AuditAction.LOGOUT]: AuditCategory.AUTHENTICATION,
  [AuditAction.PASSWORD_CHANGED]: AuditCategory.AUTHENTICATION,
  [AuditAction.PASSWORD_CHANGE_FAILED]: AuditCategory.AUTHENTICATION,
  [AuditAction.SESSION_EXPIRED]: AuditCategory.AUTHENTICATION,

  // Invoice management
  [AuditAction.INVOICE_CREATED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_UPDATED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_DELETED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_VIEWED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_STATUS_CHANGED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_FIELD_EDITED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_COMMENT_ADDED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_FLAGGED_FOR_REVIEW]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_CRM_PUSHED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_ASSIGNED]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.INVOICE_BULK_PROCESSED]: AuditCategory.INVOICE_MANAGEMENT,

  // Approval workflow
  [AuditAction.INVOICE_APPROVED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.INVOICE_REJECTED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.INVOICE_ESCALATED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.APPROVAL_REQUESTED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.APPROVAL_THRESHOLD_EXCEEDED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.APPROVAL_RULE_CREATED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.APPROVAL_RULE_UPDATED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.ESCALATION_TRIGGERED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.ESCALATION_RESOLVED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.ESCALATION_LEVEL_CHANGED]: AuditCategory.APPROVAL_WORKFLOW,
  [AuditAction.BULK_APPROVAL]: AuditCategory.APPROVAL_WORKFLOW,

  // Vendor management
  [AuditAction.VENDOR_CREATED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.VENDOR_UPDATED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.VENDOR_DELETED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.VENDOR_W9_STATUS_CHANGED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.VENDOR_1099_STATUS_CHANGED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.VENDOR_PAUSED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.VENDOR_RESUMED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.VENDOR_TYPE_CREATED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.PENDING_VENDOR_COMPLETED]: AuditCategory.VENDOR_MANAGEMENT,
  [AuditAction.PENDING_VENDOR_REJECTED]: AuditCategory.VENDOR_MANAGEMENT,

  // User management
  [AuditAction.USER_CREATED]: AuditCategory.USER_MANAGEMENT,
  [AuditAction.USER_UPDATED]: AuditCategory.USER_MANAGEMENT,
  [AuditAction.USER_DELETED]: AuditCategory.USER_MANAGEMENT,
  [AuditAction.USER_ROLE_CHANGED]: AuditCategory.USER_MANAGEMENT,
  [AuditAction.USER_STATUS_CHANGED]: AuditCategory.USER_MANAGEMENT,
  [AuditAction.USER_STATES_ASSIGNED]: AuditCategory.USER_MANAGEMENT,
  [AuditAction.PERMISSION_UPDATED]: AuditCategory.USER_MANAGEMENT,
  [AuditAction.SETTINGS_CHANGED]: AuditCategory.USER_MANAGEMENT,

  // Data export
  [AuditAction.DATA_EXPORTED]: AuditCategory.DATA_EXPORT,
  [AuditAction.REPORT_GENERATED]: AuditCategory.DATA_EXPORT,

  // System
  [AuditAction.API_ERROR]: AuditCategory.SYSTEM,
  [AuditAction.SYSTEM_ERROR]: AuditCategory.SYSTEM,
  [AuditAction.VALIDATION_ERROR]: AuditCategory.SYSTEM,
  [AuditAction.ACCESS_DENIED]: AuditCategory.SECURITY,
  [AuditAction.RATE_LIMIT_EXCEEDED]: AuditCategory.SECURITY,

  // CRM Integration
  [AuditAction.CRM_SYNC_STARTED]: AuditCategory.CRM_INTEGRATION,
  [AuditAction.CRM_SYNC_COMPLETED]: AuditCategory.CRM_INTEGRATION,
  [AuditAction.CRM_SYNC_FAILED]: AuditCategory.CRM_INTEGRATION,
  [AuditAction.DISBURSEMENT_CREATED]: AuditCategory.CRM_INTEGRATION,

  // Bulk operations
  [AuditAction.BULK_STATUS_UPDATE]: AuditCategory.INVOICE_MANAGEMENT,
  [AuditAction.BULK_DELETE]: AuditCategory.INVOICE_MANAGEMENT,
};

/**
 * Human-readable action labels
 */
export const ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.LOGIN_SUCCESS]: 'Login Successful',
  [AuditAction.LOGIN_FAILED]: 'Login Failed',
  [AuditAction.LOGOUT]: 'Logged Out',
  [AuditAction.PASSWORD_CHANGED]: 'Password Changed',
  [AuditAction.PASSWORD_CHANGE_FAILED]: 'Password Change Failed',
  [AuditAction.SESSION_EXPIRED]: 'Session Expired',

  [AuditAction.INVOICE_CREATED]: 'Invoice Created',
  [AuditAction.INVOICE_UPDATED]: 'Invoice Updated',
  [AuditAction.INVOICE_DELETED]: 'Invoice Deleted',
  [AuditAction.INVOICE_VIEWED]: 'Invoice Viewed',
  [AuditAction.INVOICE_APPROVED]: 'Invoice Approved',
  [AuditAction.INVOICE_REJECTED]: 'Invoice Rejected',
  [AuditAction.INVOICE_ESCALATED]: 'Invoice Escalated',
  [AuditAction.INVOICE_STATUS_CHANGED]: 'Invoice Status Changed',
  [AuditAction.INVOICE_FIELD_EDITED]: 'Invoice Field Edited',
  [AuditAction.INVOICE_COMMENT_ADDED]: 'Comment Added',
  [AuditAction.INVOICE_FLAGGED_FOR_REVIEW]: 'Flagged for Review',
  [AuditAction.INVOICE_CRM_PUSHED]: 'Pushed to CRM',
  [AuditAction.INVOICE_ASSIGNED]: 'Invoice Assigned',
  [AuditAction.INVOICE_BULK_PROCESSED]: 'Bulk Processed',

  [AuditAction.APPROVAL_REQUESTED]: 'Approval Requested',
  [AuditAction.APPROVAL_THRESHOLD_EXCEEDED]: 'Threshold Exceeded',
  [AuditAction.APPROVAL_RULE_CREATED]: 'Approval Rule Created',
  [AuditAction.APPROVAL_RULE_UPDATED]: 'Approval Rule Updated',

  [AuditAction.ESCALATION_TRIGGERED]: 'Escalation Triggered',
  [AuditAction.ESCALATION_RESOLVED]: 'Escalation Resolved',
  [AuditAction.ESCALATION_LEVEL_CHANGED]: 'Escalation Level Changed',

  [AuditAction.VENDOR_CREATED]: 'Vendor Created',
  [AuditAction.VENDOR_UPDATED]: 'Vendor Updated',
  [AuditAction.VENDOR_DELETED]: 'Vendor Deleted',
  [AuditAction.VENDOR_W9_STATUS_CHANGED]: 'W9 Status Changed',
  [AuditAction.VENDOR_1099_STATUS_CHANGED]: '1099 Status Changed',
  [AuditAction.VENDOR_PAUSED]: 'Vendor Paused',
  [AuditAction.VENDOR_RESUMED]: 'Vendor Resumed',
  [AuditAction.VENDOR_TYPE_CREATED]: 'Vendor Type Created',
  [AuditAction.PENDING_VENDOR_COMPLETED]: 'Vendor Setup Completed',
  [AuditAction.PENDING_VENDOR_REJECTED]: 'Pending Vendor Rejected',

  [AuditAction.USER_CREATED]: 'User Created',
  [AuditAction.USER_UPDATED]: 'User Updated',
  [AuditAction.USER_DELETED]: 'User Deleted',
  [AuditAction.USER_ROLE_CHANGED]: 'User Role Changed',
  [AuditAction.USER_STATUS_CHANGED]: 'User Status Changed',
  [AuditAction.USER_STATES_ASSIGNED]: 'States Assigned',

  [AuditAction.PERMISSION_UPDATED]: 'Permission Updated',
  [AuditAction.SETTINGS_CHANGED]: 'Settings Changed',

  [AuditAction.DATA_EXPORTED]: 'Data Exported',
  [AuditAction.REPORT_GENERATED]: 'Report Generated',

  [AuditAction.API_ERROR]: 'API Error',
  [AuditAction.SYSTEM_ERROR]: 'System Error',
  [AuditAction.VALIDATION_ERROR]: 'Validation Error',
  [AuditAction.ACCESS_DENIED]: 'Access Denied',
  [AuditAction.RATE_LIMIT_EXCEEDED]: 'Rate Limit Exceeded',

  [AuditAction.CRM_SYNC_STARTED]: 'CRM Sync Started',
  [AuditAction.CRM_SYNC_COMPLETED]: 'CRM Sync Completed',
  [AuditAction.CRM_SYNC_FAILED]: 'CRM Sync Failed',
  [AuditAction.DISBURSEMENT_CREATED]: 'Disbursement Created',

  [AuditAction.BULK_APPROVAL]: 'Bulk Approval',
  [AuditAction.BULK_STATUS_UPDATE]: 'Bulk Status Update',
  [AuditAction.BULK_DELETE]: 'Bulk Delete',
};
