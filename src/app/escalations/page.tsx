'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Clock,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils/utils';
import { getStatusBadgeClass, getDisplayStatus } from '@/lib/utils/status-utils';
import { getOverallConfidence, formatTotalAmount, sortInvoices, type SortField, type SortDirection } from '@/lib/utils/invoice-utils';
import Link from "next/link";
import { CircularProgressBadge } from "@/components/invoice/circular-progress-badge";
import { getInvoicesAction } from '@/lib/actions/index';
import type { StoredInvoice } from '@/lib/domain/types';
import { encodeId } from "@/lib/utils/id-utils";
import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useAuthStore } from "@/hooks/use-auth-store";
import {
  useStateFilter,
  type StateFilterValue,
  type DocumentTypeFilterValue,
  DOCUMENT_TYPE_OPTIONS,
  getEffectiveStateFilter,
  shouldShowStateFilter,
  getStateOptionsForUser,
  getStateDisplayName,
  getUserAccessibleStates
} from "@/hooks/use-state-filter";
import { MapPin } from "lucide-react";
import { parseInvoiceAmount } from '@/lib/utils/invoice-utils';

export default function EscalationsPage() {
  const { user } = useAuthStore();
  const { selectedState, setSelectedState, documentType, setDocumentType } = useStateFilter();
  const effectiveStateFilter = getEffectiveStateFilter(user, selectedState);
  const showStateFilter = shouldShowStateFilter(user);
  const stateOptions = getStateOptionsForUser(user);
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [escalationLevelFilter, setEscalationLevelFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const loadInvoices = useCallback(async () => {
      setIsLoading(true);
      try {
        // Get user permissions for state-based filtering
        const userPermissions = user ? {
          role: user.role,
          assignedStates: user.assignedStates
        } : undefined;
        
        const result = await getInvoicesAction(userPermissions);
        if (result.error) {
          setInvoices([]);
        } else if (result.data) {
          // Filter for invoices that require escalation
          const escalatedInvoices = result.data.filter(inv => 
            inv.requiresEscalation === true
          );
          setInvoices(escalatedInvoices);
        }
      } catch (error) {
        setInvoices([]);
      } finally {
        setIsLoading(false);
      }
    }, [user]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Filter invoices by effective state filter first
  const stateFilteredInvoices = useMemo(() => {
    if (effectiveStateFilter === 'all') {
      return invoices;
    }
    return invoices.filter(inv => inv.state === effectiveStateFilter);
  }, [invoices, effectiveStateFilter]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    let filtered = stateFilteredInvoices;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        (inv.invoiceNumber?.value || '').toLowerCase().includes(searchLower) ||
        (inv.vendorName?.value || '').toLowerCase().includes(searchLower) ||
        (inv.caseNumber || '').toLowerCase().includes(searchLower)
      );
    }

    // Escalation level filter
    if (escalationLevelFilter !== 'all') {
      filtered = filtered.filter(inv => inv.escalationLevel === escalationLevelFilter);
    }

    // Document type filter
    if (documentType !== 'all') {
      filtered = filtered.filter(inv => inv.documentType === documentType);
    }

    return filtered;
  }, [stateFilteredInvoices, searchTerm, escalationLevelFilter, documentType]);

  // Sort invoices
  const sortedInvoices = useMemo(() => {
    return sortInvoices(filteredInvoices, sortField, sortDirection);
  }, [filteredInvoices, sortField, sortDirection]);

  // Paginate invoices
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedInvoices.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedInvoices, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedInvoices.length / rowsPerPage);

  // Stats - calculated from state-filtered invoices
  const stats = useMemo(() => {
    const totalEscalated = stateFilteredInvoices.length;
    const critical = stateFilteredInvoices.filter(inv => inv.escalationLevel === 'critical').length;
    const high = stateFilteredInvoices.filter(inv => inv.escalationLevel === 'high').length;

    const totalAmount = stateFilteredInvoices.reduce((sum, inv) => {
      const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
      return sum + (amount || 0);
    }, 0);

    const stateLabel = effectiveStateFilter === 'all' ? '' : ` (${effectiveStateFilter})`;

    return [
      {
        title: "Total Escalated",
        value: totalEscalated.toString(),
        icon: AlertTriangle,
        footerText: `${critical} critical, ${high} high${stateLabel}`,
      },
      {
        title: "Critical",
        value: critical.toString(),
        icon: TrendingUp,
        footerText: `Requires executive approval${stateLabel}`,
      },
      {
        title: "High Priority",
        value: high.toString(),
        icon: Clock,
        footerText: `Requires manager approval${stateLabel}`,
      },
      {
        title: "Total Amount",
        value: `$${(totalAmount / 1000).toFixed(0)}K`,
        icon: DollarSign,
        footerText: `Across escalated${stateLabel}`,
      },
    ];
  }, [stateFilteredInvoices, effectiveStateFilter]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const SortIcon = memo(({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  });
  SortIcon.displayName = 'SortIcon';

  const getEscalationBadgeClass = (level?: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700';
      case 'standard':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading escalations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Escalations</h2>
            <p className="text-muted-foreground mt-1">
              Invoices that require elevated approval based on amount thresholds
            </p>
          </div>
          {!showStateFilter && effectiveStateFilter !== 'all' && (
            <Badge variant="outline" className="text-sm">
              {getStateDisplayName(effectiveStateFilter)}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="grid gap-2">
            <CardTitle>Escalated Invoices</CardTitle>
            <CardDescription>
              {filteredInvoices.length} of {invoices.length} escalated invoices
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices, cases..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={escalationLevelFilter} onValueChange={(value) => {
              setEscalationLevelFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
              </SelectContent>
            </Select>
            {showStateFilter && (
              <Select value={selectedState} onValueChange={(value) => {
                setSelectedState(value as StateFilterValue);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={documentType} onValueChange={(value) => {
              setDocumentType(value as DocumentTypeFilterValue);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rowsPerPage.toString()} onValueChange={(value) => {
              setRowsPerPage(Number(value));
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paginatedInvoices.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold">No Escalations</h3>
              <p className="text-muted-foreground mt-2">
                {invoices.length === 0 
                  ? "There are currently no invoices that require escalation."
                  : "No invoices match your current filters."}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort('invoiceNumber')}
                      >
                        Invoice #
                        <SortIcon field="invoiceNumber" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort('vendor')}
                      >
                        Vendor
                        <SortIcon field="vendor" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort('date')}
                      >
                        Date
                        <SortIcon field="date" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort('amount')}
                      >
                        Amount
                        <SortIcon field="amount" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => handleSort('confidence')}
                      >
                        Accuracy
                        <SortIcon field="confidence" />
                      </Button>
                    </TableHead>
                    <TableHead>Escalation Level</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Case #</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice) => {
                    const confidence = getOverallConfidence(invoice);
                    const amount = parseInvoiceAmount(invoice.totalAmount?.value || invoice.amount?.value);

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/invoices/${encodeId(invoice.id)}?source=escalations`}
                            className="text-primary hover:underline"
                          >
                            {invoice.invoiceNumber?.value || invoice.id}
                          </Link>
                        </TableCell>
                        <TableCell>{invoice.vendorName?.value || 'N/A'}</TableCell>
                        <TableCell>{invoice.invoiceDate?.value || 'N/A'}</TableCell>
                        <TableCell className="font-semibold">
                          ${formatTotalAmount(amount)}
                        </TableCell>
                        <TableCell className="flex justify-center">
                          <CircularProgressBadge score={confidence} />
                        </TableCell>
                        <TableCell>
                          {invoice.escalationLevel && (
                            <Badge 
                              variant="outline" 
                              className={cn(getEscalationBadgeClass(invoice.escalationLevel))}
                            >
                              {invoice.escalationLevel.toUpperCase()}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            {invoice.highValueReason ? (
                              <p className="text-sm text-muted-foreground truncate" title={invoice.highValueReason}>
                                {invoice.highValueReason}
                              </p>
                            ) : invoice.escalationReason ? (
                              <p className="text-sm text-muted-foreground">
                                {invoice.escalationReason}
                              </p>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {invoice.caseNumber ? (
                            <span className="font-medium">{invoice.caseNumber}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.state ? (
                            <Badge variant="outline">
                              {invoice.state}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(getStatusBadgeClass(getDisplayStatus(invoice)))}
                          >
                            {getDisplayStatus(invoice)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/invoices/${encodeId(invoice.id)}?source=escalations`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Review
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, sortedInvoices.length)} of {sortedInvoices.length} invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

