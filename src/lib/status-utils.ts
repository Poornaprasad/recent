/**
 * Shared utilities for status badge styling and status-related operations
 */

export type StatusBadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary';

export interface StatusBadgeConfig {
  className: string;
  variant: StatusBadgeVariant;
}

/**
 * Maps status strings to badge styling classes
 */
export function getStatusBadgeClass(status: string): string {
  const normalizedStatus = status.toLowerCase();
  
  const statusMap: Record<string, string> = {
    // Invoice statuses
    paid: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800",
    review: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800",
    draft: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800",
    
    // User/Vendor statuses
    active: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
    invited: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800",
    inactive: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800",
  };

  return statusMap[normalizedStatus] || "bg-secondary text-secondary-foreground";
}





