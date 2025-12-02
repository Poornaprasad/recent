/**
 * Core Services Index
 * Central export for all core services
 */

// Logging
export { logger, LogLevel, type LogContext, type LogEntry } from './logging/logger.service';

// RBAC
export {
  rbacService,
  UserRole,
  Permission,
  type UserPermissions,
  type RolePermissions,
} from './auth/rbac.service';

// Audit
export {
  auditService,
  AuditAction,
  AuditResource,
  type AuditLogEntry,
} from './audit/audit.service';

// State Detection
export {
  stateDetectionService,
  State,
  type StateDetectionResult,
} from './state/state-detection.service';

// Approval
export {
  approvalService,
  type ApprovalResult,
  type ApprovalRuleConfig,
} from './approval/approval.service';

// Payment Type
export {
  paymentTypeService,
  PaymentType,
  type PaymentTypeCategory,
} from './payment-type/payment-type.service';

