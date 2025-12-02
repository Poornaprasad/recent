/**
 * Dashboard server actions
 * Next.js server actions for dashboard data
 */

'use server';

import { getDashboardStats, getDashboardTimeComparison, getDuplicateAlerts, getOcrConfidenceData, getInvoiceUrgencyData } from '../services/dashboard.service';
import { calculateDashboardStats, calculateTimeComparison } from '../services/dashboard-stats.service';

/**
 * Get dashboard statistics
 */
export async function getDashboardStatsAction(): Promise<{
  data?: Awaited<ReturnType<typeof calculateDashboardStats>>;
  error?: string;
}> {
  try {
    const stats = await calculateDashboardStats();
    return { data: stats };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch dashboard statistics.';
    return { error: errorMessage };
  }
}

/**
 * Get dashboard time comparison data
 */
export async function getDashboardTimeComparisonAction(): Promise<{
  data?: Awaited<ReturnType<typeof calculateTimeComparison>>;
  error?: string;
}> {
  try {
    const comparison = await calculateTimeComparison();
    return { data: comparison };
  } catch (error) {
    console.error('Error fetching dashboard time comparison:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch time comparison data.';
    return { error: errorMessage };
  }
}

/**
 * Get duplicate alerts
 */
export async function getDuplicateAlertsAction(limit?: number): Promise<{
  data?: Awaited<ReturnType<typeof getDuplicateAlerts>>;
  error?: string;
}> {
  try {
    const alerts = await getDuplicateAlerts(limit);
    return { data: alerts };
  } catch (error) {
    console.error('Error fetching duplicate alerts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch duplicate alerts.';
    return { error: errorMessage };
  }
}

/**
 * Get OCR confidence data
 */
export async function getOcrConfidenceDataAction(): Promise<{
  data?: Awaited<ReturnType<typeof getOcrConfidenceData>>;
  error?: string;
}> {
  try {
    const data = await getOcrConfidenceData();
    return { data };
  } catch (error) {
    console.error('Error fetching OCR confidence data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch OCR confidence data.';
    return { error: errorMessage };
  }
}

/**
 * Get invoice urgency matrix data
 */
export async function getInvoiceUrgencyDataAction(): Promise<{
  data?: Awaited<ReturnType<typeof getInvoiceUrgencyData>>;
  error?: string;
}> {
  try {
    const data = await getInvoiceUrgencyData();
    return { data };
  } catch (error) {
    console.error('Error fetching invoice urgency data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoice urgency data.';
    return { error: errorMessage };
  }
}

