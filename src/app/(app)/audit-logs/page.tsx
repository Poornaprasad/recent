'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getAuditLogsAction, getAuditCategoriesAction, getAuditSeveritiesAction } from '@/lib/actions';
import { cn } from '@/lib/utils/utils';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertCircle,
  User,
  FileText,
  Building2,
  Settings,
  RefreshCw,
  Calendar,
  Filter,
  X,
} from "lucide-react";
import type { AuditLogRecord, AuditLogFilter } from '@/lib/core/audit/audit.types';

// Action labels for display
const ACTION_LABELS: Record<string, string> = {
  login_success: 'Login Successful',
  login_failed: 'Login Failed',
  logout: 'Logged Out',
  password_changed: 'Password Changed',
  password_change_failed: 'Password Change Failed',
  session_expired: 'Session Expired',
  invoice_created: 'Invoice Created',
  invoice_updated: 'Invoice Updated',
  invoice_deleted: 'Invoice Deleted',
  invoice_viewed: 'Invoice Viewed',
  invoice_approved: 'Invoice Approved',
  invoice_rejected: 'Invoice Rejected',
  invoice_escalated: 'Invoice Escalated',
  invoice_status_changed: 'Status Changed',
  invoice_field_edited: 'Field Edited',
  invoice_comment_added: 'Comment Added',
  invoice_flagged_for_review: 'Flagged for Review',
  invoice_crm_pushed: 'Pushed to CRM',
  invoice_assigned: 'Invoice Assigned',
  invoice_bulk_processed: 'Bulk Processed',
  approval_requested: 'Approval Requested',
  approval_threshold_exceeded: 'Threshold Exceeded',
  approval_rule_created: 'Approval Rule Created',
  approval_rule_updated: 'Approval Rule Updated',
  escalation_triggered: 'Escalation Triggered',
  escalation_resolved: 'Escalation Resolved',
  escalation_level_changed: 'Escalation Level Changed',
  vendor_created: 'Vendor Created',
  vendor_updated: 'Vendor Updated',
  vendor_deleted: 'Vendor Deleted',
  vendor_w9_status_changed: 'W9 Status Changed',
  vendor_1099_status_changed: '1099 Status Changed',
  vendor_paused: 'Vendor Paused',
  vendor_resumed: 'Vendor Resumed',
  vendor_type_created: 'Vendor Type Created',
  pending_vendor_completed: 'Vendor Setup Completed',
  pending_vendor_rejected: 'Pending Vendor Rejected',
  user_created: 'User Created',
  user_updated: 'User Updated',
  user_deleted: 'User Deleted',
  user_role_changed: 'Role Changed',
  user_status_changed: 'Status Changed',
  user_states_assigned: 'States Assigned',
  permission_updated: 'Permission Updated',
  settings_changed: 'Settings Changed',
  data_exported: 'Data Exported',
  report_generated: 'Report Generated',
  api_error: 'API Error',
  system_error: 'System Error',
  validation_error: 'Validation Error',
  access_denied: 'Access Denied',
  rate_limit_exceeded: 'Rate Limit Exceeded',
  crm_sync_started: 'CRM Sync Started',
  crm_sync_completed: 'CRM Sync Completed',
  crm_sync_failed: 'CRM Sync Failed',
  disbursement_created: 'Disbursement Created',
  bulk_approval: 'Bulk Approval',
  bulk_status_update: 'Bulk Status Update',
  bulk_delete: 'Bulk Delete',
};

// Category icons with accessibility labels
const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  authentication: { icon: <Shield className="h-4 w-4" aria-hidden="true" />, label: "Authentication" },
  invoice_management: { icon: <FileText className="h-4 w-4" aria-hidden="true" />, label: "Invoice Management" },
  approval_workflow: { icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />, label: "Approval Workflow" },
  vendor_management: { icon: <Building2 className="h-4 w-4" aria-hidden="true" />, label: "Vendor Management" },
  user_management: { icon: <User className="h-4 w-4" aria-hidden="true" />, label: "User Management" },
  system: { icon: <Settings className="h-4 w-4" aria-hidden="true" />, label: "System" },
  security: { icon: <Shield className="h-4 w-4" aria-hidden="true" />, label: "Security" },
  data_export: { icon: <FileText className="h-4 w-4" aria-hidden="true" />, label: "Data Export" },
  crm_integration: { icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />, label: "CRM Integration" },
};

export default function AuditLogsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [severities, setSeverities] = useState<Array<{ value: string; label: string }>>([]);
  const [activeTab, setActiveTab] = useState('all');
  const statusMessageRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Check access - only admin, director, and manager can view audit logs
  const hasAccess = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    return ['admin', 'director', 'manager'].includes(user.role);
  }, [isAuthenticated, user]);

  // Redirect if no access
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (!hasAccess) {
      router.push('/');
    }
  }, [isAuthenticated, hasAccess, router]);

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      const [categoriesResult, severitiesResult] = await Promise.all([
        getAuditCategoriesAction(),
        getAuditSeveritiesAction(),
      ]);
      if (categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
      if (severitiesResult.data) {
        setSeverities(severitiesResult.data);
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!hasAccess) return;

    setIsLoading(true);
    try {
      const filter: AuditLogFilter = {
        limit: rowsPerPage,
        offset: (currentPage - 1) * rowsPerPage,
      };

      if (searchTerm) {
        filter.searchTerm = searchTerm;
      }

      if (severityFilter !== 'all') {
        filter.severity = severityFilter as any;
      }

      if (categoryFilter !== 'all') {
        filter.category = categoryFilter as any;
      }

      // Tab-specific filters
      if (activeTab === 'auth') {
        filter.category = 'authentication' as any;
      } else if (activeTab === 'approvals') {
        filter.category = 'approval_workflow' as any;
      } else if (activeTab === 'errors') {
        filter.severity = ['ERROR', 'CRITICAL'] as any;
      }

      const result = await getAuditLogsAction(filter);
      if (result.data) {
        setLogs(result.data.logs);
        setTotalLogs(result.data.total);
        // Announce results to screen readers
        if (statusMessageRef.current) {
          statusMessageRef.current.textContent = `Loaded ${result.data.logs.length} of ${result.data.total} audit log entries`;
        }
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      if (statusMessageRef.current) {
        statusMessageRef.current.textContent = 'Error loading audit logs. Please try again.';
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasAccess, rowsPerPage, currentPage, searchTerm, severityFilter, categoryFilter, activeTab]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, severityFilter, categoryFilter, activeTab]);

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return "bg-red-600 text-white border-red-700 dark:bg-red-800 dark:text-red-100";
      case "ERROR":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
      case "WARNING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800";
      case "INFO":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800";
      case "DEBUG":
        return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/50 dark:text-gray-400 dark:border-gray-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800";
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "authentication":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300";
      case "invoice_management":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300";
      case "approval_workflow":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300";
      case "vendor_management":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300";
      case "user_management":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300";
      case "security":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300";
      case "system":
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300";
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDetails = (details: Record<string, any> | null | undefined) => {
    if (!details) return '-';
    if (details.description) return details.description;
    return JSON.stringify(details).substring(0, 100) + '...';
  };

  const totalPages = Math.ceil(totalLogs / rowsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSeverityFilter('all');
    setCategoryFilter('all');
    setActiveTab('all');
  };

  const hasActiveFilters = searchTerm || severityFilter !== 'all' || categoryFilter !== 'all' || activeTab !== 'all';

  if (!hasAccess) {
    return (
      <main className="flex-1 flex items-center justify-center p-8" role="main" aria-label="Audit Logs">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600" role="alert">
              <Shield className="h-5 w-5" aria-hidden="true" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have permission to view audit logs. This feature is only available to administrators, directors, and managers.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-4 p-4 md:p-8 pt-6" role="main" aria-label="Audit Logs">
      {/* Skip link for keyboard navigation */}
      <a 
        href="#audit-logs-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      
      {/* Status message for screen readers */}
      <div 
        ref={statusMessageRef}
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      />
      
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Security and compliance audit trail</p>
        </div>
        <Button 
          onClick={fetchLogs} 
          variant="outline" 
          size="sm"
          aria-label="Refresh audit logs"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList role="tablist" aria-label="Filter audit logs by category">
          <TabsTrigger value="all" role="tab" aria-controls="all-logs-panel" id="all-logs-tab">All Logs</TabsTrigger>
          <TabsTrigger value="auth" role="tab" aria-controls="auth-logs-panel" id="auth-logs-tab">Authentication</TabsTrigger>
          <TabsTrigger value="approvals" role="tab" aria-controls="approvals-logs-panel" id="approvals-logs-tab">Approvals</TabsTrigger>
          <TabsTrigger value="errors" role="tab" aria-controls="errors-logs-panel" id="errors-logs-tab">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4" id={`${activeTab}-logs-panel`} role="tabpanel" aria-labelledby={`${activeTab}-logs-tab`} tabIndex={0}>
          <Card id="audit-logs-content">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="secondary" aria-label={`Total audit logs: ${totalLogs.toLocaleString()}`}>{totalLogs.toLocaleString()}</Badge>
                  <span>Audit Trail</span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter audit logs">
                  <div className="relative">
                    <label htmlFor="search-logs-input" className="sr-only">Search audit logs</label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="search-logs-input"
                      type="search"
                      placeholder="Search logs..."
                      className="pl-8 w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label="Search audit logs"
                    />
                  </div>
                  <div>
                    <label htmlFor="category-filter" className="sr-only">Filter by category</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger id="category-filter" className="w-[160px]" aria-label="Filter by category">
                        <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="severity-filter" className="sr-only">Filter by severity</label>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger id="severity-filter" className="w-[140px]" aria-label="Filter by severity">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        {severities.map((sev) => (
                          <SelectItem key={sev.value} value={sev.value}>
                            {sev.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      aria-label="Clear all filters"
                    >
                      <X className="h-4 w-4 mr-1" aria-hidden="true" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12" role="status" aria-live="polite" aria-label="Loading audit logs">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-muted-foreground">Loading audit logs...</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="rounded-md border">
                  <Table ref={tableRef}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]" scope="col">Timestamp</TableHead>
                        <TableHead className="w-[120px]" scope="col">User</TableHead>
                        <TableHead className="w-[160px]" scope="col">Action</TableHead>
                        <TableHead className="w-[140px]" scope="col">Category</TableHead>
                        <TableHead scope="col">Details</TableHead>
                        <TableHead className="w-[90px]" scope="col">Severity</TableHead>
                        <TableHead className="w-[60px] text-right" scope="col">
                          <span className="sr-only">View details</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log, index) => (
                        <TableRow 
                          key={log.id} 
                          className="cursor-pointer hover:bg-muted/50 focus-within:bg-muted/50" 
                          onClick={() => setSelectedLog(log)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedLog(log);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View details for audit log ${index + 1}: ${ACTION_LABELS[log.action] || log.action} by ${log.userName || log.userId} at ${formatTimestamp(log.timestamp)}`}
                        >
                          <TableCell className="font-mono text-xs">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm truncate max-w-[100px]">
                                {log.userName || log.userId}
                              </span>
                              {log.userRole && (
                                <span className="text-xs text-muted-foreground">
                                  {log.userRole}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {CATEGORY_ICONS[log.category]?.icon || <Settings className="h-4 w-4" aria-hidden="true" />}
                              <span className="text-sm">
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getCategoryBadgeClass(log.category))}
                              aria-label={`Category: ${categories.find(c => c.value === log.category)?.label || log.category}`}
                            >
                              {categories.find(c => c.value === log.category)?.label || log.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <span className="text-sm text-muted-foreground truncate block">
                              {formatDetails(log.details)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getSeverityBadgeClass(log.severity))}
                              aria-label={`Severity: ${log.severity}`}
                            >
                              {log.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              aria-label={`View details for ${ACTION_LABELS[log.action] || log.action} audit log`}
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12" role="status" aria-live="polite">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">No Logs Found</h2>
                  <p className="text-muted-foreground mt-2">
                    {hasActiveFilters
                      ? "No audit logs match your search criteria."
                      : "There are no audit logs yet."}
                  </p>
                  {hasActiveFilters && (
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={clearFilters}
                      aria-label="Clear all filters to show all audit logs"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
            {logs.length > 0 && (
              <nav className="flex items-center justify-between py-4 px-6 border-t" aria-label="Pagination">
                <div className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
                  Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, totalLogs)} of {totalLogs} entries
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="rows-per-page" className="text-sm sr-only">Rows per page</label>
                    <span className="text-sm" aria-hidden="true">Rows</span>
                    <Select
                      value={`${rowsPerPage}`}
                      onValueChange={(value) => {
                        setRowsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger id="rows-per-page" className="h-8 w-[70px]" aria-label="Select number of rows per page">
                        <SelectValue placeholder={rowsPerPage} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 50, 100].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      aria-label={`Go to previous page, page ${currentPage - 1}`}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Previous</span>
                      <span aria-hidden="true">Previous</span>
                    </Button>
                    <span className="text-sm font-medium px-2" aria-label={`Current page ${currentPage} of ${totalPages || 1}`}>
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages}
                      aria-label={`Go to next page, page ${currentPage + 1}`}
                    >
                      <span className="sr-only">Next</span>
                      <span aria-hidden="true">Next</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </nav>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent 
            className="max-w-2xl max-h-[80vh] overflow-y-auto"
            aria-labelledby="audit-log-dialog-title"
            aria-describedby="audit-log-dialog-description"
          >
            <DialogHeader>
              <div className="flex items-center gap-2">
                {CATEGORY_ICONS[selectedLog.category]?.icon}
                <DialogTitle id="audit-log-dialog-title">
                  {ACTION_LABELS[selectedLog.action] || selectedLog.action || 'Audit Log Details'}
                </DialogTitle>
              </div>
              <span className="sr-only">
                {CATEGORY_ICONS[selectedLog.category]?.label || 'Category'}
              </span>
              <DialogDescription id="audit-log-dialog-description">
                {formatTimestamp(selectedLog.timestamp)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4" role="region" aria-label="Audit log details">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">User</dt>
                  <dd className="mt-1">{selectedLog.userName || selectedLog.userId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Role</dt>
                  <dd className="mt-1">{selectedLog.userRole || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                  <dd className="mt-1">{selectedLog.userEmail || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Category</dt>
                  <dd className="mt-1">
                    <Badge 
                      variant="outline" 
                      className={cn(getCategoryBadgeClass(selectedLog.category))}
                      aria-label={`Category: ${categories.find(c => c.value === selectedLog.category)?.label || selectedLog.category}`}
                    >
                      {categories.find(c => c.value === selectedLog.category)?.label || selectedLog.category}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Severity</dt>
                  <dd className="mt-1">
                    <Badge 
                      variant="outline" 
                      className={cn(getSeverityBadgeClass(selectedLog.severity))}
                      aria-label={`Severity: ${selectedLog.severity}`}
                    >
                      {selectedLog.severity}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Resource</dt>
                  <dd className="mt-1">{selectedLog.resource} {selectedLog.resourceId ? `(${selectedLog.resourceId})` : ''}</dd>
                </div>
              </dl>

              {selectedLog.details && (
                <section className="pt-4 border-t" aria-labelledby="details-heading">
                  <h3 id="details-heading" className="text-sm font-medium text-muted-foreground mb-2">Details</h3>
                  <div className="p-4 rounded-md bg-muted/50 border">
                    <dl className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedLog.details).map(([key, value]) => {
                        // Format key: convert camelCase to Title Case
                        const formattedKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .trim();
                        
                        // Format value
                        const formattedValue = typeof value === 'object' && value !== null
                          ? JSON.stringify(value)
                          : String(value);
                        
                        return (
                          <div key={key}>
                            <dt className="text-sm font-medium text-muted-foreground">{formattedKey}</dt>
                            <dd className="mt-1">{formattedValue}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                </section>
              )}

              {selectedLog.metadata && (
                <section className="pt-4 border-t" aria-labelledby="metadata-heading">
                  <h3 id="metadata-heading" className="text-sm font-medium text-muted-foreground mb-2">Metadata</h3>
                  <div className="p-4 rounded-md bg-muted/50 border">
                    <dl className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedLog.metadata).map(([key, value]) => {
                        // Format key: convert camelCase to Title Case
                        const formattedKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .trim();
                        
                        // Format value
                        const formattedValue = typeof value === 'object' && value !== null
                          ? JSON.stringify(value)
                          : String(value);
                        
                        return (
                          <div key={key}>
                            <dt className="text-sm font-medium text-muted-foreground">{formattedKey}</dt>
                            <dd className="mt-1">{formattedValue}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                </section>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
