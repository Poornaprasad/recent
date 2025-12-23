/**
 * Audit server actions
 * Next.js server actions for audit log operations
 */

'use server';

import {
  auditService,
  AuditResource,
  AuditCategory,
  AuditSeverity,
  ACTION_LABELS,
} from '../core/audit/audit.service';
import type {
  AuditLogFilter,
  AuditLogResult,
  AuditLogRecord
} from '../core/audit/audit.types';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

/**
 * Get all audit logs with pagination
 */
export async function getAllAuditLogsAction(
  limit: number = 1000
): Promise<ActionResult<AuditLogRecord[]>> {
  return withActionHandler(
    async () => {
      const logs = await auditService.getAllAuditLogs(limit);
      return logs;
    },
    'Failed to fetch audit logs'
  );
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogsAction(
  filter: AuditLogFilter
): Promise<ActionResult<AuditLogResult>> {
  return withActionHandler(
    async () => {
      const result = await auditService.getAuditLogs(filter);
      return result;
    },
    'Failed to fetch audit logs'
  );
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogsAction(
  userId: string,
  limit: number = 100
): Promise<ActionResult<AuditLogRecord[]>> {
  return withActionHandler(
    async () => {
      const logs = await auditService.getUserAuditLogs(userId, limit);
      return logs;
    },
    'Failed to fetch user audit logs'
  );
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogsAction(
  resource: AuditResource,
  resourceId: string,
  limit: number = 50
): Promise<ActionResult<AuditLogRecord[]>> {
  return withActionHandler(
    async () => {
      const logs = await auditService.getResourceAuditLogs(resource, resourceId, limit);
      return logs;
    },
    'Failed to fetch resource audit logs'
  );
}

/**
 * Get audit logs by category
 */
export async function getAuditLogsByCategoryAction(
  category: AuditCategory | AuditCategory[],
  limit: number = 100
): Promise<ActionResult<AuditLogResult>> {
  return withActionHandler(
    async () => {
      const result = await auditService.getAuditLogs({ category, limit });
      return result;
    },
    'Failed to fetch audit logs by category'
  );
}

/**
 * Get authentication-related audit logs
 */
export async function getAuthAuditLogsAction(
  limit: number = 100
): Promise<ActionResult<AuditLogResult>> {
  return withActionHandler(
    async () => {
      const result = await auditService.getAuditLogs({
        category: AuditCategory.AUTHENTICATION,
        limit,
      });
      return result;
    },
    'Failed to fetch authentication audit logs'
  );
}

/**
 * Get approval workflow audit logs
 */
export async function getApprovalAuditLogsAction(
  limit: number = 100
): Promise<ActionResult<AuditLogResult>> {
  return withActionHandler(
    async () => {
      const result = await auditService.getAuditLogs({
        category: AuditCategory.APPROVAL_WORKFLOW,
        limit,
      });
      return result;
    },
    'Failed to fetch approval audit logs'
  );
}

/**
 * Get error audit logs
 */
export async function getErrorAuditLogsAction(
  limit: number = 100
): Promise<ActionResult<AuditLogResult>> {
  return withActionHandler(
    async () => {
      const result = await auditService.getAuditLogs({
        severity: [AuditSeverity.ERROR, AuditSeverity.CRITICAL],
        limit,
      });
      return result;
    },
    'Failed to fetch error audit logs'
  );
}

/**
 * Search audit logs
 */
export async function searchAuditLogsAction(
  searchTerm: string,
  limit: number = 100
): Promise<ActionResult<AuditLogResult>> {
  return withActionHandler(
    async () => {
      const result = await auditService.getAuditLogs({
        searchTerm,
        limit,
      });
      return result;
    },
    'Failed to search audit logs'
  );
}

/**
 * Get audit log action labels for display
 */
export async function getAuditActionLabelsAction(): Promise<ActionResult<Record<string, string>>> {
  return withActionHandler(
    async () => {
      return ACTION_LABELS;
    },
    'Failed to fetch action labels'
  );
}

/**
 * Export audit categories for filter UI
 */
export async function getAuditCategoriesAction(): Promise<ActionResult<Array<{ value: string; label: string }>>> {
  return withActionHandler(
    async () => {
      return [
        { value: 'authentication', label: 'Authentication' },
        { value: 'invoice_management', label: 'Invoice Management' },
        { value: 'approval_workflow', label: 'Approval Workflow' },
        { value: 'vendor_management', label: 'Vendor Management' },
        { value: 'user_management', label: 'User Management' },
        { value: 'system', label: 'System' },
        { value: 'security', label: 'Security' },
        { value: 'data_export', label: 'Data Export' },
        { value: 'crm_integration', label: 'CRM Integration' },
      ];
    },
    'Failed to fetch audit categories'
  );
}

/**
 * Export audit severities for filter UI
 */
export async function getAuditSeveritiesAction(): Promise<ActionResult<Array<{ value: string; label: string }>>> {
  return withActionHandler(
    async () => {
      return [
        { value: 'DEBUG', label: 'Debug' },
        { value: 'INFO', label: 'Info' },
        { value: 'WARNING', label: 'Warning' },
        { value: 'ERROR', label: 'Error' },
        { value: 'CRITICAL', label: 'Critical' },
      ];
    },
    'Failed to fetch audit severities'
  );
}
