/**
 * Dashboard server actions
 * Next.js server actions for dashboard data
 */

'use server';

import {
  calculateDashboardStats,
  calculateTimeComparison,
  getDuplicateAlerts,
  getOcrConfidenceData,
  getInvoiceUrgencyData,
  type StateFilterValue
} from '../services/dashboard-stats.service';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';

/**
 * Get dashboard statistics
 * @param stateFilter Optional state filter (all, CA, NY)
 */
export async function getDashboardStatsAction(
  stateFilter?: StateFilterValue
): Promise<ActionResult<Awaited<ReturnType<typeof calculateDashboardStats>>>> {
  return withActionHandler(
    () => calculateDashboardStats(undefined, stateFilter),
    'Failed to fetch dashboard statistics'
  );
}

/**
 * Get dashboard time comparison data
 * @param stateFilter Optional state filter (all, CA, NY)
 */
export async function getDashboardTimeComparisonAction(
  stateFilter?: StateFilterValue
): Promise<ActionResult<Awaited<ReturnType<typeof calculateTimeComparison>>>> {
  return withActionHandler(
    () => calculateTimeComparison(undefined, stateFilter),
    'Failed to fetch time comparison data'
  );
}

/**
 * Get duplicate alerts
 * @param limit Maximum number of alerts to return
 * @param stateFilter Optional state filter (all, CA, NY)
 */
export async function getDuplicateAlertsAction(
  limit?: number,
  stateFilter?: StateFilterValue
): Promise<ActionResult<Awaited<ReturnType<typeof getDuplicateAlerts>>>> {
  return withActionHandler(
    () => getDuplicateAlerts(limit, undefined, stateFilter),
    'Failed to fetch duplicate alerts'
  );
}

/**
 * Get OCR confidence data
 * @param stateFilter Optional state filter (all, CA, NY)
 */
export async function getOcrConfidenceDataAction(
  stateFilter?: StateFilterValue
): Promise<ActionResult<Awaited<ReturnType<typeof getOcrConfidenceData>>>> {
  return withActionHandler(
    () => getOcrConfidenceData(undefined, stateFilter),
    'Failed to fetch OCR confidence data'
  );
}

/**
 * Get invoice urgency matrix data
 * @param stateFilter Optional state filter (all, CA, NY)
 */
export async function getInvoiceUrgencyDataAction(
  stateFilter?: StateFilterValue
): Promise<ActionResult<Awaited<ReturnType<typeof getInvoiceUrgencyData>>>> {
  return withActionHandler(
    () => getInvoiceUrgencyData(undefined, stateFilter),
    'Failed to fetch invoice urgency data'
  );
}

