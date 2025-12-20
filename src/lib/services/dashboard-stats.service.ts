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

export type StateFilterValue = 'all' | 'CA' | 'NY';

/**
 * Filter invoices by selected state filter (UI-level filtering)
 */
function filterBySelectedState(
  invoices: Awaited<ReturnType<typeof findAllInvoices>>,
  stateFilter?: StateFilterValue
): Awaited<ReturnType<typeof findAllInvoices>> {
  if (!stateFilter || stateFilter === 'all') {
    return invoices;
  }
  return invoices.filter(inv => inv.state === stateFilter);
}

/**
 * Filter invoices based on user permissions and state access
 */
function filterInvoicesByAccess(
  invoices: Awaited<ReturnType<typeof findAllInvoices>>,
  userPermissions?: UserPermissions
): Awaited<ReturnType<typeof findAllInvoices>> {
  if (!userPermissions) {
    return invoices;
  }

  if (rbacService.isElevatedRole(userPermissions.role)) {
    return invoices;
  }

  // Senior Accountant has access to all states
  if (userPermissions.role === 'senior_accountant') {
    return invoices;
  }

  // NY Accountant - has access to NY by default, and other states if assigned
  if (userPermissions.role === 'ny_accountant') {
    return invoices.filter(inv => {
      const invoiceState = inv.state as State | undefined;
      if (invoiceState === 'NY') return true;
      return invoiceState && userPermissions.assignedStates?.includes(invoiceState);
    });
  }

  // CA Accountant - has access to CA by default, and other states if assigned
  if (userPermissions.role === 'ca_accountant') {
    return invoices.filter(inv => {
      const invoiceState = inv.state as State | undefined;
      if (invoiceState === 'CA') return true;
      return invoiceState && userPermissions.assignedStates?.includes(invoiceState);
    });
  }

  return invoices;
}

/**
 * Calculate dashboard statistics from invoice data
 * @param userPermissions Optional user permissions for role-based filtering
 * @param stateFilter Optional state filter for UI-level filtering
 */
export async function calculateDashboardStats(
  userPermissions?: UserPermissions,
  stateFilter?: StateFilterValue
): Promise<DashboardStatsData> {
  const allInvoices = await findAllInvoices();
  const accessFilteredInvoices = filterInvoicesByAccess(allInvoices, userPermissions);
  const filteredInvoices = filterBySelectedState(accessFilteredInvoices, stateFilter);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStart = today.getTime();
  
  // Calculate processing time (days between createdAt and now for pending/review invoices)
  let totalProcessingDays = 0;
  let processingCount = 0;
  let pendingCount = 0;
  let reviewCount = 0;
  let totalAmountDue = 0;
  let overdueCount = 0;
  let processingToday = 0;
  let highValueCount = 0;
  let duplicateCount = 0;
  let urgentCount = 0;

  for (const invoice of filteredInvoices) {
    if (invoice.status === 'Pending') {
      pendingCount++;
    } else if (invoice.status === 'Review') {
      reviewCount++;
      urgentCount++;
    }

    if ((invoice.status === 'Pending' || invoice.status === 'Review') && invoice.totalAmount?.value) {
      const amount = parseInvoiceAmount(invoice.totalAmount.value);
      totalAmountDue += amount;
    }

    if ((invoice.status === 'Pending' || invoice.status === 'Review') && invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      totalProcessingDays += daysDiff;
      processingCount++;
    }

    if (invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      if (createdDate.getTime() >= todayStart) {
        processingToday++;
      }
    }

    // Overdue: pending invoices older than 30 days
    if (invoice.status === 'Pending' && invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      const daysOld = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 30) {
        overdueCount++;
        urgentCount++;
      }
    }

    if (invoice.isHighValue || invoice.requiresEscalation) {
      highValueCount++;
    }

    if (invoice.isDuplicate) {
      duplicateCount++;
    }

    // Urgent: high value, duplicates, or review status
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
 * @param stateFilter Optional state filter for UI-level filtering
 */
export async function calculateTimeComparison(
  userPermissions?: UserPermissions,
  stateFilter?: StateFilterValue
): Promise<DashboardTimeComparisonData> {
  const allInvoices = await findAllInvoices();
  const accessFilteredInvoices = filterInvoicesByAccess(allInvoices, userPermissions);
  const filteredInvoices = filterBySelectedState(accessFilteredInvoices, stateFilter);
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

export interface DuplicateAlert {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  date: string;
  confidence: number;
  duplicateReason?: string;
}

export interface OcrConfidenceData {
  high: number; // >90%
  medium: number; // 70-90%
  low: number; // <70%
  failed: number; // 0% or null
  total: number;
  actionRequired: number;
}

export interface InvoiceUrgencyData {
  days: number; // Days until due (negative = overdue)
  amount: number;
  urgency: 'Overdue' | 'Due Soon' | 'Due Today' | 'This Week' | '>7 Days';
}

/**
 * Get duplicate alerts for dashboard
 * @param limit Maximum number of alerts to return
 * @param userPermissions Optional user permissions for role-based filtering
 * @param stateFilter Optional state filter for UI-level filtering
 */
export async function getDuplicateAlerts(
  limit: number = 5,
  userPermissions?: UserPermissions,
  stateFilter?: StateFilterValue
): Promise<DuplicateAlert[]> {
  const allInvoices = await findAllInvoices();
  const accessFilteredInvoices = filterInvoicesByAccess(allInvoices, userPermissions);
  const filteredInvoices = filterBySelectedState(accessFilteredInvoices, stateFilter);

  const duplicates = filteredInvoices
    .filter(inv => inv.isDuplicate)
    .slice(0, limit)
    .map(inv => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber?.value || 'N/A',
      vendorName: inv.vendorName?.value || 'Unknown',
      amount: parseInvoiceAmount(inv.totalAmount?.value),
      date: inv.invoiceDate?.value || 'N/A',
      confidence: getOverallConfidence(inv),
      duplicateReason: inv.duplicateReason,
    }));

  return duplicates;
}

/**
 * Get OCR confidence distribution
 * @param userPermissions Optional user permissions for role-based filtering
 * @param stateFilter Optional state filter for UI-level filtering
 */
export async function getOcrConfidenceData(
  userPermissions?: UserPermissions,
  stateFilter?: StateFilterValue
): Promise<OcrConfidenceData> {
  const allInvoices = await findAllInvoices();
  const accessFilteredInvoices = filterInvoicesByAccess(allInvoices, userPermissions);
  const filteredInvoices = filterBySelectedState(accessFilteredInvoices, stateFilter);

  let high = 0;
  let medium = 0;
  let low = 0;
  let failed = 0;
  let actionRequired = 0;

  for (const invoice of filteredInvoices) {
    const confidence = getOverallConfidence(invoice);

    if (confidence === 0 || isNaN(confidence)) {
      failed++;
      actionRequired++;
    } else if (confidence < 0.7) {
      low++;
      actionRequired++;
    } else if (confidence < 0.9) {
      medium++;
      actionRequired++;
    } else {
      high++;
    }
  }

  return {
    high,
    medium,
    low,
    failed,
    total: filteredInvoices.length,
    actionRequired,
  };
}

/**
 * Get invoice urgency matrix data
 * @param userPermissions Optional user permissions for role-based filtering
 * @param stateFilter Optional state filter for UI-level filtering
 */
export async function getInvoiceUrgencyData(
  userPermissions?: UserPermissions,
  stateFilter?: StateFilterValue
): Promise<InvoiceUrgencyData[]> {
  const allInvoices = await findAllInvoices();
  const accessFilteredInvoices = filterInvoicesByAccess(allInvoices, userPermissions);
  const filteredInvoices = filterBySelectedState(accessFilteredInvoices, stateFilter);
  const now = new Date();

  const urgencyData: InvoiceUrgencyData[] = [];

  for (const invoice of filteredInvoices) {
    if (invoice.status !== 'Pending' && invoice.status !== 'Review') {
      continue;
    }

    let daysUntilDue = 30;
    if (invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      daysUntilDue = 30 - daysSinceCreation;
    }

    const amount = parseInvoiceAmount(invoice.totalAmount?.value);

    let urgency: InvoiceUrgencyData['urgency'];
    if (daysUntilDue < 0) {
      urgency = 'Overdue';
    } else if (daysUntilDue === 0) {
      urgency = 'Due Today';
    } else if (daysUntilDue <= 3) {
      urgency = 'Due Soon';
    } else if (daysUntilDue <= 7) {
      urgency = 'This Week';
    } else {
      urgency = '>7 Days';
    }

    urgencyData.push({
      days: daysUntilDue,
      amount,
      urgency,
    });
  }

  return urgencyData;
}

