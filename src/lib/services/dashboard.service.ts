/**
 * Dashboard service
 * Business logic for dashboard statistics and aggregations
 * 
 * @deprecated Use dashboard-stats.service.ts for stats calculation
 * This file is kept for backward compatibility and additional dashboard features
 */

import 'server-only';

import { findAllInvoices } from '../repositories/invoice.repository';
import { getOverallConfidence, parseInvoiceAmount } from '../utils/invoice-utils';
import type { StoredInvoice } from '../domain/types';
import { calculateDashboardStats, calculateTimeComparison } from './dashboard-stats.service';
import type { DashboardStatsData, DashboardTimeComparisonData } from '../config/dashboard.config';

// Re-export types for backward compatibility
export type DashboardStats = DashboardStatsData;
export type DashboardTimeComparison = DashboardTimeComparisonData;

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
 * Calculate dashboard statistics from invoice data
 * @deprecated Use calculateDashboardStats from dashboard-stats.service.ts
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  return await calculateDashboardStats();
}

/**
 * Get time comparison data (vs last week)
 * @deprecated Use calculateTimeComparison from dashboard-stats.service.ts
 */
export async function getDashboardTimeComparison(): Promise<DashboardTimeComparison> {
  return await calculateTimeComparison();
}

/**
 * Get duplicate alerts for dashboard
 * @param limit Maximum number of alerts to return
 * @param userPermissions Optional user permissions for role-based filtering
 */
export async function getDuplicateAlerts(
  limit: number = 5,
  userPermissions?: import('../core/auth/rbac.service').UserPermissions
): Promise<DuplicateAlert[]> {
  const allInvoices = await findAllInvoices();
  
  // Filter by user access if permissions provided
  let filteredInvoices = allInvoices;
  if (userPermissions) {
    const { rbacService } = await import('../core/auth/rbac.service');
    if (rbacService.isElevatedRole(userPermissions.role)) {
      // Admin/Director/Manager see all
      filteredInvoices = allInvoices;
    } else if (userPermissions.role === 'account' && userPermissions.assignedStates) {
      filteredInvoices = allInvoices.filter(inv => {
        const invoiceState = inv.state as string | undefined;
        return invoiceState && userPermissions.assignedStates?.includes(invoiceState);
      });
    }
    // User role would filter by createdBy/assignedTo - TODO: implement with userId
  }
  
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
 */
export async function getOcrConfidenceData(
  userPermissions?: import('../core/auth/rbac.service').UserPermissions
): Promise<OcrConfidenceData> {
  const allInvoices = await findAllInvoices();
  
  // Filter by user access if permissions provided
  let filteredInvoices = allInvoices;
  if (userPermissions) {
    const { rbacService } = await import('../core/auth/rbac.service');
    if (rbacService.isElevatedRole(userPermissions.role)) {
      filteredInvoices = allInvoices;
    } else if (userPermissions.role === 'account' && userPermissions.assignedStates) {
      filteredInvoices = allInvoices.filter(inv => {
        const invoiceState = inv.state as string | undefined;
        return invoiceState && userPermissions.assignedStates?.includes(invoiceState);
      });
    }
  }
  
  let high = 0; // >90%
  let medium = 0; // 70-90%
  let low = 0; // <70%
  let failed = 0; // 0% or null
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
 */
export async function getInvoiceUrgencyData(
  userPermissions?: import('../core/auth/rbac.service').UserPermissions
): Promise<InvoiceUrgencyData[]> {
  const allInvoices = await findAllInvoices();
  
  // Filter by user access if permissions provided
  let filteredInvoices = allInvoices;
  if (userPermissions) {
    const { rbacService } = await import('../core/auth/rbac.service');
    if (rbacService.isElevatedRole(userPermissions.role)) {
      filteredInvoices = allInvoices;
    } else if (userPermissions.role === 'account' && userPermissions.assignedStates) {
      filteredInvoices = allInvoices.filter(inv => {
        const invoiceState = inv.state as string | undefined;
        return invoiceState && userPermissions.assignedStates?.includes(invoiceState);
      });
    }
  }
  const now = new Date();
  
  const urgencyData: InvoiceUrgencyData[] = [];
  
  for (const invoice of filteredInvoices) {
    // Only include pending and review invoices
    if (invoice.status !== 'Pending' && invoice.status !== 'Review') {
      continue;
    }
    
    // Calculate days until due (simplified - using 30 days from creation as default)
    let daysUntilDue = 30;
    if (invoice.createdAt) {
      const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      daysUntilDue = 30 - daysSinceCreation;
    }
    
    // Get amount
    const amount = parseInvoiceAmount(invoice.totalAmount?.value);
    
    // Determine urgency
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

