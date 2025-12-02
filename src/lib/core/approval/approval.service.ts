/**
 * Approval Service
 * Handles invoice approval workflow with amount thresholds
 */

import 'server-only';

import { getDb, initDb } from '../../db';
import { approvalRules } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { rbacService, UserRole, type UserPermissions } from '../auth/rbac.service';
import { auditService, AuditAction, AuditResource } from '../audit/audit.service';
import { logger } from '../logging/logger.service';
import { State } from '../state/state-detection.service';

export interface ApprovalResult {
  canApprove: boolean;
  requiresElevatedApproval: boolean;
  reason?: string;
  requiredRoles?: string[];
}

export interface ApprovalRuleConfig {
  state: State | 'ALL';
  thresholdAmount: number;
  requiresRoles: UserRole[];
  isActive: boolean;
}

class ApprovalService {
  /**
   * Check if user can approve an invoice amount
   */
  async canApprove(
    userPermissions: UserPermissions,
    amount: number,
    state: State,
    invoiceId: string
  ): Promise<ApprovalResult> {
    try {
      await initDb();
      const db = getDb();

      // Get approval rule for this state (or ALL)
      const rules = await db
        .select()
        .from(approvalRules)
        .where(
          and(
            eq(approvalRules.isActive, true),
            eq(approvalRules.state, state)
          )
        )
        .limit(1);

      // If no state-specific rule, try ALL
      let rule = rules[0];
      if (!rule) {
        const allRules = await db
          .select()
          .from(approvalRules)
          .where(
            and(
              eq(approvalRules.isActive, true),
              eq(approvalRules.state, 'ALL')
            )
          )
          .limit(1);
        rule = allRules[0];
      }

      // Default threshold if no rule exists
      const threshold = rule?.thresholdAmount || 5000;
      const requiredRoles = rule?.requiresRoles 
        ? JSON.parse(rule.requiresRoles) as UserRole[]
        : [UserRole.DIRECTOR, UserRole.ADMIN];

      // Check if amount exceeds threshold
      const exceedsThreshold = amount > threshold;

      // Admin and Director can always approve
      if ([UserRole.ADMIN, UserRole.DIRECTOR].includes(userPermissions.role)) {
        return {
          canApprove: true,
          requiresElevatedApproval: false,
        };
      }

      // If amount is below threshold, user can approve
      if (!exceedsThreshold) {
        return {
          canApprove: true,
          requiresElevatedApproval: false,
        };
      }

      // Amount exceeds threshold - check if user has required role
      const hasRequiredRole = requiredRoles.includes(userPermissions.role);

      if (hasRequiredRole) {
        return {
          canApprove: true,
          requiresElevatedApproval: true,
          reason: `Amount ($${amount.toFixed(2)}) exceeds threshold ($${threshold.toFixed(2)})`,
        };
      }

      // User cannot approve - requires elevated approval
      return {
        canApprove: false,
        requiresElevatedApproval: true,
        reason: `Amount ($${amount.toFixed(2)}) exceeds threshold ($${threshold.toFixed(2)}). Requires approval from: ${requiredRoles.join(', ')}`,
        requiredRoles,
      };
    } catch (error) {
      logger.error('Error checking approval permission', { userId: userPermissions.role, amount, state }, error instanceof Error ? error : new Error(String(error)));
      
      // Default to allowing approval if there's an error (fail open for now)
      return {
        canApprove: true,
        requiresElevatedApproval: false,
      };
    }
  }

  /**
   * Approve an invoice
   */
  async approveInvoice(
    userId: string,
    invoiceId: string,
    amount: number,
    state: State,
    userPermissions: UserPermissions,
    reason?: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user can approve
      const approvalCheck = await this.canApprove(userPermissions, amount, state, invoiceId);

      if (!approvalCheck.canApprove) {
        return {
          success: false,
          error: approvalCheck.reason || 'You do not have permission to approve this invoice.',
        };
      }

      // Log approval
      await auditService.logApproval(userId, invoiceId, amount, true, reason, ipAddress);

      logger.info(`Invoice approved: ${invoiceId}`, {
        userId,
        invoiceId,
        amount,
        state,
        requiresElevatedApproval: approvalCheck.requiresElevatedApproval,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error approving invoice', { userId, invoiceId }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve invoice',
      };
    }
  }

  /**
   * Reject an invoice
   */
  async rejectInvoice(
    userId: string,
    invoiceId: string,
    amount: number,
    reason: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Log rejection
      await auditService.logApproval(userId, invoiceId, amount, false, reason, ipAddress);

      logger.info(`Invoice rejected: ${invoiceId}`, {
        userId,
        invoiceId,
        amount,
        reason,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error rejecting invoice', { userId, invoiceId }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject invoice',
      };
    }
  }

  /**
   * Get approval rule for a state
   */
  async getApprovalRule(state: State | 'ALL'): Promise<ApprovalRuleConfig | null> {
    try {
      await initDb();
      const db = getDb();

      const rules = await db
        .select()
        .from(approvalRules)
        .where(
          and(
            eq(approvalRules.isActive, true),
            eq(approvalRules.state, state)
          )
        )
        .limit(1);

      if (!rules[0]) {
        return null;
      }

      return {
        state: rules[0].state as State | 'ALL',
        thresholdAmount: rules[0].thresholdAmount,
        requiresRoles: JSON.parse(rules[0].requiresRoles || '[]') as UserRole[],
        isActive: rules[0].isActive || false,
      };
    } catch (error) {
      logger.error('Error getting approval rule', { state }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Create or update approval rule
   */
  async setApprovalRule(
    config: ApprovalRuleConfig,
    createdBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await initDb();
      const db = getDb();

      const ruleId = `rule-${config.state}-${Date.now()}`;

      await db
        .insert(approvalRules)
        .values({
          id: ruleId,
          state: config.state,
          thresholdAmount: config.thresholdAmount,
          requiresRoles: JSON.stringify(config.requiresRoles),
          isActive: config.isActive,
          createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: approvalRules.id,
          set: {
            thresholdAmount: config.thresholdAmount,
            requiresRoles: JSON.stringify(config.requiresRoles),
            isActive: config.isActive,
            updatedAt: new Date(),
          },
        });

      logger.info(`Approval rule updated`, {
        createdBy,
        state: config.state,
        thresholdAmount: config.thresholdAmount,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error setting approval rule', { config }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set approval rule',
      };
    }
  }
}

// Export singleton instance
export const approvalService = new ApprovalService();

