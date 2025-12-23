/**
 * Audit Service
 * Comprehensive audit trail logging for invoice management system
 */

import 'server-only';

import { logger } from '../logging/logger.service';
import { getDb, initDb } from '../../db';
import { auditLogs } from '../../db/schema';
import { sql, eq, and, or, like, desc, gte, lte, inArray } from 'drizzle-orm';
import {
  AuditAction,
  AuditResource,
  AuditSeverity,
  AuditCategory,
  AuditLogEntry,
  AuditDetails,
  AuditMetadata,
  AuditLogFilter,
  AuditLogResult,
  AuditLogRecord,
  ACTION_SEVERITY_MAP,
  ACTION_CATEGORY_MAP,
  ACTION_LABELS,
} from './audit.types';

// Re-export types for convenience
export {
  AuditAction,
  AuditResource,
  AuditSeverity,
  AuditCategory,
  ACTION_LABELS,
};

export type { AuditLogEntry, AuditDetails, AuditMetadata, AuditLogFilter, AuditLogResult, AuditLogRecord };

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get severity for an action (with fallback to INFO)
 */
function getSeverityForAction(action: AuditAction): AuditSeverity {
  return ACTION_SEVERITY_MAP[action] || AuditSeverity.INFO;
}

/**
 * Get category for an action
 */
function getCategoryForAction(action: AuditAction): AuditCategory {
  return ACTION_CATEGORY_MAP[action] || AuditCategory.SYSTEM;
}

class AuditService {
  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<string | null> {
    try {
      await initDb();
      const db = getDb();

      const auditId = generateAuditId();
      const severity = entry.severity || getSeverityForAction(entry.action);
      const category = entry.category || getCategoryForAction(entry.action);

      const auditEntry = {
        id: auditId,
        timestamp: new Date(),
        userId: entry.userId,
        userName: entry.userName || null,
        userEmail: entry.userEmail || null,
        userRole: entry.userRole || null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId || null,
        category,
        details: entry.details ? JSON.stringify(entry.details) : null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        severity,
      };

      await db.insert(auditLogs).values(auditEntry);

      // Also log to application logger for immediate visibility
      logger.info(`Audit: ${ACTION_LABELS[entry.action] || entry.action}`, {
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        category,
        severity,
      });

      return auditId;
    } catch (error) {
      logger.error(
        'Failed to log audit entry',
        { entry },
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't throw - audit logging should not break the application
      return null;
    }
  }

  // ==========================================
  // Authentication Audit Methods
  // ==========================================

  /**
   * Log successful login
   */
  async logLoginSuccess(
    userId: string,
    userEmail: string,
    userName: string,
    userRole: string,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      userName,
      userEmail,
      userRole,
      action: AuditAction.LOGIN_SUCCESS,
      resource: AuditResource.AUTHENTICATION,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.INFO,
      details: {
        description: `User ${userEmail} logged in successfully`,
      },
      metadata,
    });
  }

  /**
   * Log failed login attempt
   */
  async logLoginFailed(
    email: string,
    reason: string,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId: 'unknown',
      userEmail: email,
      action: AuditAction.LOGIN_FAILED,
      resource: AuditResource.AUTHENTICATION,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.WARNING,
      details: {
        description: `Failed login attempt for ${email}`,
        reason,
      },
      metadata,
    });
  }

  /**
   * Log logout
   */
  async logLogout(
    userId: string,
    userEmail: string,
    userName: string,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      userName,
      userEmail,
      action: AuditAction.LOGOUT,
      resource: AuditResource.AUTHENTICATION,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.INFO,
      details: {
        description: `User ${userEmail} logged out`,
      },
      metadata,
    });
  }

  /**
   * Log password change
   */
  async logPasswordChanged(
    userId: string,
    userEmail: string,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      userEmail,
      action: AuditAction.PASSWORD_CHANGED,
      resource: AuditResource.AUTHENTICATION,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.INFO,
      details: {
        description: `Password changed for ${userEmail}`,
      },
      metadata,
    });
  }

  // ==========================================
  // Invoice Audit Methods
  // ==========================================

  /**
   * Log invoice creation
   */
  async logInvoiceCreated(
    userId: string,
    invoiceId: string,
    details: {
      invoiceNumber?: string;
      vendorName?: string;
      amount?: number;
      state?: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.INVOICE_CREATED,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      category: AuditCategory.INVOICE_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `Invoice created: ${details.invoiceNumber || invoiceId}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log invoice approval
   */
  async logInvoiceApproved(
    userId: string,
    userName: string,
    userRole: string,
    invoiceId: string,
    details: {
      invoiceNumber?: string;
      vendorName?: string;
      amount?: number;
      state?: string;
      reason?: string;
      thresholdExceeded?: boolean;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      userName,
      userRole,
      action: AuditAction.INVOICE_APPROVED,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      category: AuditCategory.APPROVAL_WORKFLOW,
      severity: AuditSeverity.INFO,
      details: {
        description: `Invoice ${details.invoiceNumber || invoiceId} approved by ${userName}`,
        approvalStatus: 'Approved',
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log invoice rejection
   */
  async logInvoiceRejected(
    userId: string,
    userName: string,
    userRole: string,
    invoiceId: string,
    details: {
      invoiceNumber?: string;
      vendorName?: string;
      amount?: number;
      state?: string;
      reason: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      userName,
      userRole,
      action: AuditAction.INVOICE_REJECTED,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      category: AuditCategory.APPROVAL_WORKFLOW,
      severity: AuditSeverity.INFO,
      details: {
        description: `Invoice ${details.invoiceNumber || invoiceId} rejected by ${userName}: ${details.reason}`,
        approvalStatus: 'Rejected',
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log invoice escalation
   */
  async logInvoiceEscalated(
    userId: string,
    invoiceId: string,
    details: {
      invoiceNumber?: string;
      vendorName?: string;
      amount?: number;
      escalationLevel: string;
      escalationReason: string;
      requiredRoles?: string[];
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.INVOICE_ESCALATED,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      category: AuditCategory.APPROVAL_WORKFLOW,
      severity: AuditSeverity.WARNING,
      details: {
        description: `Invoice ${details.invoiceNumber || invoiceId} escalated: ${details.escalationReason}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log invoice status change
   */
  async logInvoiceStatusChanged(
    userId: string,
    invoiceId: string,
    details: {
      invoiceNumber?: string;
      previousStatus: string;
      newStatus: string;
      reason?: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.INVOICE_STATUS_CHANGED,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      category: AuditCategory.INVOICE_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `Invoice ${details.invoiceNumber || invoiceId} status changed from ${details.previousStatus} to ${details.newStatus}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log invoice field edit
   */
  async logInvoiceFieldEdited(
    userId: string,
    invoiceId: string,
    details: {
      invoiceNumber?: string;
      fieldName: string;
      previousValue?: any;
      newValue: any;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.INVOICE_FIELD_EDITED,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      category: AuditCategory.INVOICE_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `Field '${details.fieldName}' edited on invoice ${details.invoiceNumber || invoiceId}`,
        changedFields: [details.fieldName],
        previousValue: { [details.fieldName]: details.previousValue },
        newValue: { [details.fieldName]: details.newValue },
      },
      metadata,
    });
  }

  /**
   * Log invoice CRM push
   */
  async logInvoiceCrmPushed(
    userId: string,
    invoiceId: string,
    details: {
      invoiceNumber?: string;
      vendorName?: string;
      amount?: number;
      crmStatus: string;
      disbursementId?: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.INVOICE_CRM_PUSHED,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      category: AuditCategory.CRM_INTEGRATION,
      severity: AuditSeverity.INFO,
      details: {
        description: `Invoice ${details.invoiceNumber || invoiceId} pushed to CRM`,
        ...details,
      },
      metadata,
    });
  }

  // ==========================================
  // Vendor Audit Methods
  // ==========================================

  /**
   * Log vendor creation
   */
  async logVendorCreated(
    userId: string,
    vendorId: string,
    details: {
      vendorName: string;
      vendorType?: string;
      email?: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.VENDOR_CREATED,
      resource: AuditResource.VENDOR,
      resourceId: vendorId,
      category: AuditCategory.VENDOR_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `Vendor created: ${details.vendorName}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log vendor update
   */
  async logVendorUpdated(
    userId: string,
    vendorId: string,
    details: {
      vendorName: string;
      changedFields: string[];
      previousValue?: Record<string, any>;
      newValue?: Record<string, any>;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.VENDOR_UPDATED,
      resource: AuditResource.VENDOR,
      resourceId: vendorId,
      category: AuditCategory.VENDOR_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `Vendor updated: ${details.vendorName}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log vendor W9 status change
   */
  async logVendorW9StatusChanged(
    userId: string,
    vendorId: string,
    details: {
      vendorName: string;
      previousStatus?: string;
      newStatus: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.VENDOR_W9_STATUS_CHANGED,
      resource: AuditResource.VENDOR,
      resourceId: vendorId,
      category: AuditCategory.VENDOR_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `W9 status changed for ${details.vendorName}: ${details.previousStatus || 'N/A'} -> ${details.newStatus}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log vendor 1099 status change
   */
  async logVendor1099StatusChanged(
    userId: string,
    vendorId: string,
    details: {
      vendorName: string;
      previousStatus?: string;
      newStatus: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.VENDOR_1099_STATUS_CHANGED,
      resource: AuditResource.VENDOR,
      resourceId: vendorId,
      category: AuditCategory.VENDOR_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `1099 status changed for ${details.vendorName}: ${details.previousStatus || 'N/A'} -> ${details.newStatus}`,
        ...details,
      },
      metadata,
    });
  }

  // ==========================================
  // User Management Audit Methods
  // ==========================================

  /**
   * Log user creation
   */
  async logUserCreated(
    performedByUserId: string,
    newUserId: string,
    details: {
      userName: string;
      userEmail: string;
      userRole: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId: performedByUserId,
      action: AuditAction.USER_CREATED,
      resource: AuditResource.USER,
      resourceId: newUserId,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `User created: ${details.userEmail} (${details.userRole})`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log user update
   */
  async logUserUpdated(
    performedByUserId: string,
    targetUserId: string,
    details: {
      userName: string;
      changedFields: string[];
      previousValue?: Record<string, any>;
      newValue?: Record<string, any>;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId: performedByUserId,
      action: AuditAction.USER_UPDATED,
      resource: AuditResource.USER,
      resourceId: targetUserId,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.INFO,
      details: {
        description: `User updated: ${details.userName}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log user deletion
   */
  async logUserDeleted(
    performedByUserId: string,
    targetUserId: string,
    details: {
      userName: string;
      userEmail: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId: performedByUserId,
      action: AuditAction.USER_DELETED,
      resource: AuditResource.USER,
      resourceId: targetUserId,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.WARNING,
      details: {
        description: `User deleted: ${details.userEmail}`,
        ...details,
      },
      metadata,
    });
  }

  /**
   * Log user role change
   */
  async logUserRoleChanged(
    performedByUserId: string,
    targetUserId: string,
    details: {
      userName: string;
      previousRole: string;
      newRole: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId: performedByUserId,
      action: AuditAction.USER_ROLE_CHANGED,
      resource: AuditResource.USER,
      resourceId: targetUserId,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.WARNING,
      details: {
        description: `Role changed for ${details.userName}: ${details.previousRole} -> ${details.newRole}`,
        ...details,
      },
      metadata,
    });
  }

  // ==========================================
  // Error and System Audit Methods
  // ==========================================

  /**
   * Log API error
   */
  async logApiError(
    userId: string | undefined,
    details: {
      endpoint: string;
      method: string;
      errorCode?: string;
      errorMessage: string;
      stackTrace?: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId: userId || 'system',
      action: AuditAction.API_ERROR,
      resource: AuditResource.SYSTEM,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.ERROR,
      details: {
        description: `API Error: ${details.method} ${details.endpoint} - ${details.errorMessage}`,
        ...details,
      },
      metadata: {
        ...metadata,
        endpoint: details.endpoint,
        method: details.method,
      },
    });
  }

  /**
   * Log access denied
   */
  async logAccessDenied(
    userId: string,
    details: {
      resource: string;
      action: string;
      reason: string;
    },
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.ACCESS_DENIED,
      resource: AuditResource.SYSTEM,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.WARNING,
      details: {
        description: `Access denied: ${details.action} on ${details.resource} - ${details.reason}`,
        ...details,
      },
      metadata,
    });
  }

  // ==========================================
  // Query Methods
  // ==========================================

  /**
   * Get all audit logs with optional filtering
   */
  async getAuditLogs(filter?: AuditLogFilter): Promise<AuditLogResult> {
    try {
      await initDb();
      const db = getDb();

      const limit = filter?.limit || 50;
      const offset = filter?.offset || 0;

      // Build conditions array
      const conditions: any[] = [];

      if (filter?.userId) {
        conditions.push(eq(auditLogs.userId, filter.userId));
      }

      if (filter?.action) {
        const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
        conditions.push(inArray(auditLogs.action, actions));
      }

      if (filter?.resource) {
        const resources = Array.isArray(filter.resource) ? filter.resource : [filter.resource];
        conditions.push(inArray(auditLogs.resource, resources));
      }

      if (filter?.resourceId) {
        conditions.push(eq(auditLogs.resourceId, filter.resourceId));
      }

      if (filter?.category) {
        const categories = Array.isArray(filter.category) ? filter.category : [filter.category];
        conditions.push(inArray(auditLogs.category, categories));
      }

      if (filter?.severity) {
        const severities = Array.isArray(filter.severity) ? filter.severity : [filter.severity];
        conditions.push(inArray(auditLogs.severity, severities));
      }

      if (filter?.startDate) {
        conditions.push(gte(auditLogs.timestamp, filter.startDate));
      }

      if (filter?.endDate) {
        conditions.push(lte(auditLogs.timestamp, filter.endDate));
      }

      if (filter?.searchTerm) {
        conditions.push(
          or(
            like(auditLogs.details, `%${filter.searchTerm}%`),
            like(auditLogs.userName, `%${filter.searchTerm}%`),
            like(auditLogs.userEmail, `%${filter.searchTerm}%`)
          )
        );
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = Number(countResult[0]?.count || 0);

      // Get paginated logs
      const logs = await db
        .select()
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);

      const parsedLogs = logs.map((log) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      }));

      return {
        logs: parsedLogs as AuditLogRecord[],
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      logger.error(
        'Failed to get audit logs',
        { filter },
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        logs: [],
        total: 0,
        page: 1,
        pageSize: filter?.limit || 50,
        hasMore: false,
      };
    }
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceAuditLogs(
    resource: AuditResource,
    resourceId: string,
    limit: number = 50
  ): Promise<AuditLogRecord[]> {
    const result = await this.getAuditLogs({
      resource,
      resourceId,
      limit,
    });
    return result.logs;
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(userId: string, limit: number = 100): Promise<AuditLogRecord[]> {
    const result = await this.getAuditLogs({
      userId,
      limit,
    });
    return result.logs;
  }

  /**
   * Get all audit logs (convenience method)
   */
  async getAllAuditLogs(limit: number = 1000): Promise<AuditLogRecord[]> {
    const result = await this.getAuditLogs({ limit });
    return result.logs;
  }

  // ==========================================
  // Legacy compatibility methods
  // ==========================================

  /**
   * @deprecated Use specific log methods instead
   * Log data edit with before/after values
   */
  async logDataEdit(
    userId: string,
    resource: AuditResource,
    resourceId: string,
    changes: Record<string, { old: any; new: any }>,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.INVOICE_FIELD_EDITED,
      resource,
      resourceId,
      category: getCategoryForAction(AuditAction.INVOICE_FIELD_EDITED),
      severity: AuditSeverity.INFO,
      details: {
        changedFields: Object.keys(changes),
        previousValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
        newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
        changeCount: Object.keys(changes).length,
      },
      metadata: ipAddress ? { ipAddress } : undefined,
    });

    // Also log to application logger with change details
    logger.logDataEdit(userId, resource, resourceId, changes);
  }

  /**
   * @deprecated Use logInvoiceApproved or logInvoiceRejected instead
   * Log invoice approval
   */
  async logApproval(
    userId: string,
    invoiceId: string,
    amount: number,
    approved: boolean,
    reason?: string,
    ipAddress?: string
  ): Promise<void> {
    if (approved) {
      await this.logInvoiceApproved(
        userId,
        userId,
        'unknown',
        invoiceId,
        { amount, reason },
        ipAddress ? { ipAddress } : undefined
      );
    } else {
      await this.logInvoiceRejected(
        userId,
        userId,
        'unknown',
        invoiceId,
        { amount, reason: reason || 'No reason provided' },
        ipAddress ? { ipAddress } : undefined
      );
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();
