/**
 * Dashboard statistics service
 * Aggregates and calculates dashboard statistics from invoice data
 */

import 'server-only';

import { findAllInvoices } from '../repositories/invoice.repository';
import { getOverallConfidence, parseInvoiceAmount } from '../utils/invoice-utils';
import type { DashboardStatsData, DashboardTimeComparisonData } from '../config/dashboard.config';
import { rbacService, type UserPermissions } from '../core/auth/rbac.service';
import { State } from '../core/state/state-detection.service';

/**
 * Filter invoices based on user permissions and state access
 */
function filterInvoicesByAccess(
  invoices: Awaited<ReturnType<typeof findAllInvoices>>,
  userPermissions?: UserPermissions
): Awaited<ReturnType<typeof findAllInvoices>> {
  if (!userPermissions) {
    // No user context - return all (for backward compatibility)
    return invoices;
  }

  // Admin, Director, Manager can see all invoices
  if (rbacService.isElevatedRole(userPermissions.role)) {
    return invoices;
  }

  // Account role - filter by assigned states
  if (userPermissions.role === 'account' && userPermissions.assignedStates) {
    return invoices.filter(inv => {
      const invoiceState = inv.state as State | undefined;
      return invoiceState && userPermissions.assignedStates?.includes(invoiceState);
    });
  }

  // User role - only see invoices they created or are assigned to
  if (userPermissions.role === 'user') {
    // This would need userId to filter - for now return all
    // TODO: Add userId parameter and filter by createdBy or assignedTo
    return invoices;
  }

  return invoices;
}

/**
 * Calculate dashboard statistics from invoice data
 * @param userPermissions Optional user permissions for role-based filtering
 */
export async function calculateDashboardStats(
  userPermissions?: UserPermissions
): Promise<DashboardStatsData> {
  const allInvoices = await findAllInvoices();
  const filteredInvoices = filterInvoicesByAccess(allInvoices, userPermissions);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStart = today.getTime();
  
  // Calculate processing time (days between createdAt and now for pending/review invoices)
  let totalProcessingDays = 0;
  let processingCount = 0;
  
  // Count invoices by status
  let pendingCount = 0;
  let reviewCount = 0;
  let totalAmountDue = 0;
  let overdueCount = 0;
  let processingToday = 0;
  let highValueCount = 0;
  let duplicateCount = 0;
  let urgentCount = 0;
  
  for (const invoice of filteredInvoices) {
    // Status counts
    if (invoice.status === 'Pending') {
      pendingCount++;
    } else if (invoice.status === 'Review') {
      reviewCount++;
      urgentCount++;
    }
    
    // Total amount due (pending + review invoices)
    if ((invoice.status === 'Pending' || invoice.status === 'Review') && invoice.totalAmount?.value) {
      const amount = parseInvoiceAmount(invoice.totalAmount.value);
      totalAmountDue += amount;
    }
    
    // Processing time calculation
    if ((invoice.status === 'Pending' || invoice.status === 'Review') && invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      totalProcessingDays += daysDiff;
      processingCount++;
    }
    
    // Processing today (invoices created today)
    if (invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      if (createdDate.getTime() >= todayStart) {
        processingToday++;
      }
    }
    
    // Overdue invoices (pending invoices older than 30 days)
    if (invoice.status === 'Pending' && invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      const daysOld = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 30) {
        overdueCount++;
        urgentCount++;
      }
    }
    
    // High value invoices (requires escalation)
    if (invoice.isHighValue || invoice.requiresEscalation) {
      highValueCount++;
    }
    
    // Duplicate alerts
    if (invoice.isDuplicate) {
      duplicateCount++;
    }
    
    // Urgent (high value, duplicates, or review status)
    if (invoice.isHighValue || invoice.isDuplicate || invoice.status === 'Review') {
      urgentCount++;
    }
  }
  
  const avgProcessingTime = processingCount > 0 ? totalProcessingDays / processingCount : 0;
  
  return {
    pendingInvoices: pendingCount,
    totalAmountDue,
    overdueInvoices: overdueCount,
    processingToday,
    avgProcessingTime: Math.round(avgProcessingTime * 10) / 10, // Round to 1 decimal
    highValueInvoices: highValueCount,
    duplicateAlerts: duplicateCount,
    urgentCount,
    pendingCount,
    reviewCount,
    totalInvoices: filteredInvoices.length,
  };
}

/**
 * Calculate time comparison data (vs last week)
 * @param userPermissions Optional user permissions for role-based filtering
 */
export async function calculateTimeComparison(
  userPermissions?: UserPermissions
): Promise<DashboardTimeComparisonData> {
  const allInvoices = await findAllInvoices();
  const filteredInvoices = filterInvoicesByAccess(allInvoices, userPermissions);
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Current week stats
  const currentPending = filteredInvoices.filter(inv => inv.status === 'Pending').length;
  const currentOverdue = filteredInvoices.filter(inv => {
    if (inv.status !== 'Pending' || !inv.createdAt) return false;
    const createdDate = inv.createdAt instanceof Date ? inv.createdAt : new Date(inv.createdAt);
    const daysOld = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld > 30;
  }).length;
  
  // Last week stats (invoices created before one week ago)
  const lastWeekInvoices = filteredInvoices.filter(inv => {
    if (!inv.createdAt) return false;
    const createdDate = inv.createdAt instanceof Date ? inv.createdAt : new Date(inv.createdAt);
    return createdDate.getTime() < oneWeekAgo.getTime();
  });
  
  const lastWeekPending = lastWeekInvoices.filter(inv => inv.status === 'Pending').length;
  const lastWeekOverdue = lastWeekInvoices.filter(inv => {
    if (inv.status !== 'Pending' || !inv.createdAt) return false;
    const createdDate = inv.createdAt instanceof Date ? inv.createdAt : new Date(inv.createdAt);
    const daysOld = (oneWeekAgo.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld > 30;
  }).length;
  
  // Calculate processing time change (simplified - would need historical data for accurate comparison)
  const processingTimeChange = 0;
  
  const pendingChange = lastWeekPending > 0 
    ? Math.round(((currentPending - lastWeekPending) / lastWeekPending) * 100)
    : 0;
  
  const overdueChange = lastWeekOverdue > 0
    ? Math.round(((currentOverdue - lastWeekOverdue) / lastWeekOverdue) * 100)
    : currentOverdue > 0 ? 100 : 0;
  
  return {
    pendingChange,
    overdueChange,
    processingTimeChange,
  };
}





