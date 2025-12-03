/**
 * Audit server actions
 * Next.js server actions for audit log operations
 */

'use server';

import { auditService } from '../core/audit/audit.service';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import type { AuditLog } from '../db/schema';

/**
 * Get all audit logs
 */
export async function getAllAuditLogsAction(
  limit: number = 1000
): Promise<ActionResult<AuditLog[]>> {
  return withActionHandler(
    async () => {
      const logs = await auditService.getAllAuditLogs(limit);
      return logs as AuditLog[];
    },
    'Failed to fetch audit logs'
  );
}

