/**
 * Audit Service
 * Tracks all data edits and user actions for audit trail
 */

import 'server-only';

import { logger } from '../logging/logger.service';
import { getDb, initDb } from '../../db';
import { auditLogs } from '../../db/schema';
import { sql, eq, and, like, desc } from 'drizzle-orm';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  VIEW = 'view',
  EXPORT = 'export',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

export enum AuditResource {
  INVOICE = 'invoice',
  USER = 'user',
  VENDOR = 'vendor',
  SETTINGS = 'settings',
  APPROVAL_RULE = 'approval_rule',
}

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

class AuditService {
  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await initDb();
      const db = getDb();

      const auditEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        user: entry.userId,
        action: entry.action,
        resource: entry.resource,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress || null,
        severity: entry.severity || 'INFO',
      };

      await db.insert(auditLogs).values(auditEntry);

      // Also log to application logger
      logger.info(`Audit: ${entry.action} ${entry.resource}`, {
        userId: entry.userId,
        resourceId: entry.resourceId,
        action: entry.action,
        resource: entry.resource,
      });
    } catch (error) {
      logger.error('Failed to log audit entry', { entry }, error instanceof Error ? error : new Error(String(error)));
      // Don't throw - audit logging should not break the application
    }
  }

  /**
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
      action: AuditAction.UPDATE,
      resource,
      resourceId,
      details: {
        changes,
        changeCount: Object.keys(changes).length,
      },
      ipAddress,
      severity: 'INFO',
    });

    // Also log to application logger with change details
    logger.logDataEdit(userId, resource, resourceId, changes);
  }

  /**
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
    await this.log({
      userId,
      action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
      resource: AuditResource.INVOICE,
      resourceId: invoiceId,
      details: {
        amount,
        reason,
      },
      ipAddress,
      severity: 'INFO',
    });
  }

  /**
   * Get audit logs for a resource
   */
  async getAuditLogs(
    resource: AuditResource,
    resourceId?: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      await initDb();
      const db = getDb();

      const conditions = [eq(auditLogs.resource, resource)];
      
      if (resourceId) {
        conditions.push(like(auditLogs.details, `%"${resourceId}"%`));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return logs.map((log) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
      }));
    } catch (error) {
      logger.error('Failed to get audit logs', { resource, resourceId }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(userId: string, limit: number = 100): Promise<any[]> {
    try {
      await initDb();
      const db = getDb();

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.user, userId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return logs.map((log) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
      }));
    } catch (error) {
      logger.error('Failed to get user audit logs', { userId }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get all audit logs
   */
  async getAllAuditLogs(limit: number = 1000): Promise<any[]> {
    try {
      await initDb();
      const db = getDb();

      const logs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return logs.map((log) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
      }));
    } catch (error) {
      logger.error('Failed to get all audit logs', {}, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();

