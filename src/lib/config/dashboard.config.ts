/**
 * Dashboard configuration
 * Centralized configuration for dashboard stat cards and layout
 */

import {
  DollarSign,
  AlertTriangle,
  Timer,
  Copy,
  Activity,
  TrendingUp,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StatCardProps } from "@/components/dashboard/stat-card";

/**
 * Stat card configuration
 * Defines which stats to display and how to format them
 */
export interface StatCardConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  dataKey: keyof DashboardStatsData;
  format?: (value: any) => string;
  showChange?: boolean;
  changeKey?: keyof DashboardTimeComparisonData;
  footerKey?: keyof DashboardStatsData;
    footerFormat?: (value: any, stats?: DashboardStatsData) => string;
  enabled?: boolean; // Allow enabling/disabling individual cards
}

/**
 * Dashboard statistics data structure
 */
export interface DashboardStatsData {
  pendingInvoices: number;
  totalAmountDue: number;
  overdueInvoices: number;
  processingToday: number;
  avgProcessingTime: number;
  highValueInvoices: number;
  duplicateAlerts: number;
  urgentCount: number;
  pendingCount: number;
  reviewCount: number;
  totalInvoices: number;
}

/**
 * Time comparison data structure
 */
export interface DashboardTimeComparisonData {
  pendingChange: number;
  overdueChange: number;
  processingTimeChange: number;
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  } else {
    return `$${amount.toFixed(0)}`;
  }
}

/**
 * Format processing time
 */
export function formatProcessingTime(days: number): string {
  return `${days} days`;
}

/**
 * Default dashboard stat card configurations
 * Add, remove, or modify cards here to customize the dashboard
 */
export const DASHBOARD_STAT_CARDS: StatCardConfig[] = [
  {
    id: 'pending-invoices',
    title: 'Pending Invoices',
    icon: FileText,
    dataKey: 'pendingInvoices',
    showChange: true,
    changeKey: 'pendingChange',
    enabled: true,
  },
  {
    id: 'total-amount-due',
    title: 'Total Amount Due',
    icon: DollarSign,
    dataKey: 'totalAmountDue',
    format: formatAmount,
    footerKey: 'reviewCount',
    footerFormat: (value, stats) => `${(stats?.pendingInvoices || 0) + (stats?.reviewCount || 0)} invoices`,
    enabled: true,
  },
  {
    id: 'overdue-invoices',
    title: 'Overdue Invoices',
    icon: AlertTriangle,
    dataKey: 'overdueInvoices',
    showChange: true,
    changeKey: 'overdueChange',
    enabled: true,
  },
  {
    id: 'processing-today',
    title: 'Processing Today',
    icon: Activity,
    dataKey: 'processingToday',
    footerKey: 'urgentCount',
    footerFormat: (value) => `${value} urgent`,
    enabled: true,
  },
  {
    id: 'avg-processing-time',
    title: 'Avg Processing Time',
    icon: Timer,
    dataKey: 'avgProcessingTime',
    format: formatProcessingTime,
    showChange: true,
    changeKey: 'processingTimeChange',
    enabled: true,
  },
  {
    id: 'high-value-invoices',
    title: 'High Value Invoices',
    icon: TrendingUp,
    dataKey: 'highValueInvoices',
    footerKey: 'highValueInvoices',
    footerFormat: () => 'Requires escalation',
    enabled: true,
  },
  {
    id: 'duplicate-alerts',
    title: 'Duplicate Alerts',
    icon: Copy,
    dataKey: 'duplicateAlerts',
    footerKey: 'duplicateAlerts',
    footerFormat: () => 'Review required',
    enabled: true,
  },
];

/**
 * Get enabled stat card configurations
 */
export function getEnabledStatCards(): StatCardConfig[] {
  return DASHBOARD_STAT_CARDS.filter(card => card.enabled !== false);
}

/**
 * Build stat card props from configuration and data
 */
export function buildStatCardProps(
  config: StatCardConfig,
  stats: DashboardStatsData,
  comparison?: DashboardTimeComparisonData
): StatCardProps {
  const rawValue = stats[config.dataKey];
  const formattedValue = config.format ? config.format(rawValue) : String(rawValue);

  const props: StatCardProps = {
    title: config.title,
    value: formattedValue,
    icon: config.icon,
  };

  // Add change indicator if configured
  if (config.showChange && comparison && config.changeKey) {
    const changeValue = comparison[config.changeKey];
    if (changeValue !== undefined) {
      props.change = changeValue;
      props.changeText = config.changeKey === 'pendingChange' 
        ? 'vs last week'
        : config.changeKey === 'overdueChange'
        ? 'urgent attention'
        : 'improvement';
    }
  }

  // Add footer text if configured
  if (config.footerKey) {
    const footerValue = stats[config.footerKey];
    if (config.footerFormat) {
      props.footerText = config.footerFormat(footerValue, stats);
    } else {
      props.footerText = String(footerValue);
    }
  }

  return props;
}

