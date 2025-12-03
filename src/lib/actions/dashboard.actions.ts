/**
 * Dashboard server actions
 * Next.js server actions for dashboard data
 */

'use server';

import { calculateDashboardStats, calculateTimeComparison, getDuplicateAlerts, getOcrConfidenceData, getInvoiceUrgencyData } from '../services/dashboard-stats.service';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

/**
 * Get dashboard statistics
 */
export async function getDashboardStatsAction(): Promise<ActionResult<Awaited<ReturnType<typeof calculateDashboardStats>>>> {
  return withActionHandler(
    () => calculateDashboardStats(),
    'Failed to fetch dashboard statistics'
  );
}

/**
 * Get dashboard time comparison data
 */
export async function getDashboardTimeComparisonAction(): Promise<ActionResult<Awaited<ReturnType<typeof calculateTimeComparison>>>> {
  return withActionHandler(
    () => calculateTimeComparison(),
    'Failed to fetch time comparison data'
  );
}

/**
 * Get duplicate alerts
 */
export async function getDuplicateAlertsAction(limit?: number): Promise<ActionResult<Awaited<ReturnType<typeof getDuplicateAlerts>>>> {
  return withActionHandler(
    () => getDuplicateAlerts(limit),
    'Failed to fetch duplicate alerts'
  );
}

/**
 * Get OCR confidence data
 */
export async function getOcrConfidenceDataAction(): Promise<ActionResult<Awaited<ReturnType<typeof getOcrConfidenceData>>>> {
  return withActionHandler(
    () => getOcrConfidenceData(),
    'Failed to fetch OCR confidence data'
  );
}

/**
 * Get invoice urgency matrix data
 */
export async function getInvoiceUrgencyDataAction(): Promise<ActionResult<Awaited<ReturnType<typeof getInvoiceUrgencyData>>>> {
  return withActionHandler(
    () => getInvoiceUrgencyData(),
    'Failed to fetch invoice urgency data'
  );
}

