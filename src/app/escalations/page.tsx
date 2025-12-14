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
import { parseInvoiceAmount } from '@/lib/utils/invoice-utils';

export default function EscalationsPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [escalationLevelFilter, setEscalationLevelFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
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

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

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

    // State filter
    if (stateFilter !== 'all') {
      filtered = filtered.filter(inv => inv.state === stateFilter);
    }

    return filtered;
  }, [invoices, searchTerm, escalationLevelFilter, stateFilter]);

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

  // Stats
  const stats = useMemo(() => {
    const totalEscalated = invoices.length;
    const critical = invoices.filter(inv => inv.escalationLevel === 'critical').length;
    const high = invoices.filter(inv => inv.escalationLevel === 'high').length;
    const standard = invoices.filter(inv => inv.escalationLevel === 'standard').length;
    
    const totalAmount = invoices.reduce((sum, inv) => {
      const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
      return sum + (amount || 0);
    }, 0);

    return [
      {
        title: "Total Escalated",
        value: totalEscalated.toString(),
        icon: AlertTriangle,
        footerText: `${critical} critical, ${high} high`,
      },
      {
        title: "Critical",
        value: critical.toString(),
        icon: TrendingUp,
        footerText: "Requires executive approval",
      },
      {
        title: "High Priority",
        value: high.toString(),
        icon: Clock,
        footerText: "Requires manager approval",
      },
      {
        title: "Total Amount",
        value: `$${(totalAmount / 1000).toFixed(0)}K`,
        icon: DollarSign,
        footerText: `Across all escalated`,
      },
    ];
  }, [invoices]);

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

  // Get available states based on user permissions
  const availableStates = useMemo(() => {
    if (!user) return ['CA', 'NY'];
    
    // Elevated roles can see all states
    if (['admin', 'director', 'manager', 'senior_accountant'].includes(user.role)) {
      return ['CA', 'NY'];
    }
    
    // State accountants can see their state + assigned states
    const states: string[] = [];
    if (user.role === 'ny_accountant') {
      states.push('NY');
    } else if (user.role === 'ca_accountant') {
      states.push('CA');
    }
    
    // Add assigned states
    if (user.assignedStates) {
      user.assignedStates.forEach(state => {
        if (!states.includes(state)) {
          states.push(state);
        }
      });
    }
    
    return states;
  }, [user]);

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
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Escalations</h2>
          <p className="text-muted-foreground mt-1">
            Invoices that require elevated approval based on amount thresholds
          </p>
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
            {availableStates.length > 0 && (
              <Select value={stateFilter} onValueChange={(value) => {
                setStateFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {availableStates.map(state => (
                    <SelectItem key={state} value={state}>
                      {state === 'CA' ? 'California' : state === 'NY' ? 'New York' : state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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

