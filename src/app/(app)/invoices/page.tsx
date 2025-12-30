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
  FileClock,
  CheckCircle2,
  Sparkles,
  FileDown,
  Eye,
  ClipboardList,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  RefreshCw,
  MapPin,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils/utils';
import Link from "next/link";
import { CircularProgressBadge } from "@/components/invoice/circular-progress-badge";
import { getInvoicesAction } from '@/lib/actions/index';
import type { StoredInvoice } from '@/lib/domain/types';
import { getStatusBadgeClass, getDisplayStatus } from '@/lib/utils/status-utils';
import {
  getOverallConfidence,
  getFieldsExtractedCount,
  formatTotalAmount,
  filterInvoices,
  sortInvoices,
  getUniqueVendors,
  type SortField,
  type SortDirection
} from '@/lib/utils/invoice-utils';
import { exportInvoicesToCSVFile } from "@/lib/utils/export-utils";
import { encodeId } from "@/lib/utils/id-utils";
import { DocumentTypeCell } from "@/components/invoice/document-type-cell";
import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { 
  useStateFilter, 
  STATE_OPTIONS, 
  type StateFilterValue,
  type DocumentTypeFilterValue,
  DOCUMENT_TYPE_OPTIONS,
  getEffectiveStateFilter,
  shouldShowStateFilter,
  getStateOptionsForUser,
  getStateDisplayName,
  getUserPrimaryState,
  getUserSecondaryState,
  hasPrimaryAndSecondaryStates,
  getOppositeState
} from "@/hooks/use-state-filter";

export default function InvoicesPage() {
  const { user } = useAuthStore();
  const { selectedState, setSelectedState, documentType, setDocumentType } = useStateFilter();
  const effectiveStateFilter = getEffectiveStateFilter(user, selectedState);
  const showStateFilter = shouldShowStateFilter(user);
  const stateOptions = getStateOptionsForUser(user);
  const hasBothStates = hasPrimaryAndSecondaryStates(user);
  const primaryState = getUserPrimaryState(user);
  const secondaryState = getUserSecondaryState(user);
  const oppositeState = getOppositeState(user, effectiveStateFilter);
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInvoices = async () => {
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
          // Include all invoices (including Drafts) - they may be accessible from other pages like W9
          setInvoices(result.data);
          
          // Debug: Check if invoice 2818-23 is in the results
          const targetInvoice = result.data.find(inv => inv.id === '2818-23' || inv.invoiceNumber?.value === '2818-23');
          if (targetInvoice) {
            console.log('✅ Invoice 2818-23 found in getInvoicesAction results');
          } else {
            console.log('❌ Invoice 2818-23 NOT found in getInvoicesAction results');
            console.log('User permissions:', userPermissions);
            console.log('Total invoices returned:', result.data.length);
            console.log('Invoice states:', [...new Set(result.data.map(inv => inv.state))]);
          }
        }
      } catch (error) {
        setInvoices([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadInvoices();
  }, [user]);

  // Get unique vendors for filter
  const uniqueVendors = useMemo(() => {
    return getUniqueVendors(invoices);
  }, [invoices]);

  // Filter invoices by effective state filter
  const stateFilteredInvoices = useMemo(() => {
    if (effectiveStateFilter === 'all') {
      return invoices;
    }
    // Include invoices that match the state OR have no state (null/undefined)
    // This ensures invoices without a state are still visible
    return invoices.filter(inv => inv.state === effectiveStateFilter || !inv.state);
  }, [invoices, effectiveStateFilter]);

  // Filter invoices by other filters
  const filteredInvoices = useMemo(() => {
    return filterInvoices(stateFilteredInvoices, {
      searchTerm,
      statusFilter,
      documentTypeFilter: documentType,
      vendorFilter,
    });
  }, [stateFilteredInvoices, searchTerm, statusFilter, documentType, vendorFilter]);

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
    const totalProcessed = stateFilteredInvoices.length;
    const needsReview = stateFilteredInvoices.filter(inv => inv.status === 'Review').length;
    const avgFields = stateFilteredInvoices.length > 0
      ? (stateFilteredInvoices.reduce((acc, inv) => acc + getFieldsExtractedCount(inv), 0) / stateFilteredInvoices.length).toFixed(1)
      : '0';
    const highConfidence = stateFilteredInvoices.filter(inv => getOverallConfidence(inv) >= 0.95).length;

    // Footer shows count within filtered state only
    const stateLabel = effectiveStateFilter === 'all' ? '' : ` (${effectiveStateFilter})`;
    const reviewInView = filteredInvoices.filter(inv => inv.status === 'Review').length;

    return [
    {
      title: "Total Processed",
        value: totalProcessed.toString(),
      icon: CheckCircle2,
        footerText: `${totalProcessed} processed invoices${stateLabel}`,
    },
    {
      title: "Needs Review",
        value: needsReview.toString(),
      icon: FileClock,
        footerText: `${reviewInView} in current view`,
    },
    {
      title: "Avg. Fields Extracted",
        value: avgFields,
      icon: ClipboardList,
        footerText: `Per invoice${stateLabel}`,
    },
    {
      title: "High Confidence",
        value: highConfidence.toString(),
      icon: Sparkles,
        footerText: `Above 95% confidence${stateLabel}`,
      },
    ];
  }, [stateFilteredInvoices, filteredInvoices, effectiveStateFilter]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedInvoices(new Set(paginatedInvoices.map(inv => inv.id)));
    } else {
      setSelectedInvoices(new Set());
    }
  }, [paginatedInvoices]);

  const handleSelectInvoice = useCallback((invoiceId: string, checked: boolean) => {
    setSelectedInvoices(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(invoiceId);
      } else {
        newSelected.delete(invoiceId);
      }
      return newSelected;
    });
  }, []);

  const handleExport = useCallback(() => {
    const dataToExport = selectedInvoices.size > 0
      ? invoices.filter(inv => selectedInvoices.has(inv.id))
      : filteredInvoices;

    exportInvoicesToCSVFile(dataToExport);
  }, [selectedInvoices, invoices, filteredInvoices]);

  const SortIcon = memo(({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  });
  SortIcon.displayName = 'SortIcon';

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">All Invoices</h2>
            <p className="text-muted-foreground mt-1">
              View and manage all invoices including drafts
            </p>
          </div>
          {!showStateFilter && effectiveStateFilter !== 'all' && (
            <Badge variant="outline" className="text-sm">
              {getStateDisplayName(effectiveStateFilter)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* State Switcher Button - Show when user has both primary and secondary states */}
          {hasBothStates && oppositeState && (
            <Button
              onClick={() => {
                setSelectedState(oppositeState);
                setCurrentPage(1);
              }}
              variant={effectiveStateFilter === primaryState ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">
                {effectiveStateFilter === primaryState 
                  ? `Load ${secondaryState} First` 
                  : `Load ${primaryState} First`}
              </span>
              <span className="sm:hidden">
                {effectiveStateFilter === primaryState ? secondaryState : primaryState}
              </span>
            </Button>
          )}
          <Button onClick={handleExport} size="sm" className="gap-1">
            <FileDown className="h-4 w-4" />
            Export {selectedInvoices.size > 0 ? `(${selectedInvoices.size})` : 'All'}
          </Button>
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
            <CardTitle>Invoices</CardTitle>
            <CardDescription>
              {filteredInvoices.length} of {invoices.length} invoices
              {selectedInvoices.size > 0 && ` • ${selectedInvoices.size} selected`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
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
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Review">Review</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vendorFilter} onValueChange={(value) => {
              setVendorFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {uniqueVendors.map(vendor => (
                  <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedInvoices.size === paginatedInvoices.length && paginatedInvoices.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Type</TableHead>
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
                <TableHead>Fields</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-3"
                    onClick={() => handleSort('caseNumber')}
                  >
                    Case #
                    <SortIcon field="caseNumber" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-3"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    <SortIcon field="status" />
                  </Button>
                </TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No invoices found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInvoices.map((invoice) => {
                const confidence = getOverallConfidence(invoice);
                  const fieldsExtracted = getFieldsExtractedCount(invoice);
                  const isSelected = selectedInvoices.has(invoice.id);

                return (
                    <TableRow key={invoice.id} className={isSelected ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectInvoice(invoice.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <DocumentTypeCell 
                          documentType={invoice.documentType}
                          state={invoice.state}
                          user={user}
                        />
                      </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/invoices/${encodeId(invoice.id)}?source=invoices`}
                        className="text-primary hover:underline"
                      >
                        {invoice.invoiceNumber?.value || invoice.id}
                      </Link>
                    </TableCell>
                      <TableCell>{invoice.vendorName?.value || 'N/A'}</TableCell>
                    <TableCell>{invoice.invoiceDate?.value || 'N/A'}</TableCell>
                      <TableCell>${formatTotalAmount(invoice.totalAmount?.value)}</TableCell>
                    <TableCell className="flex justify-center">
                      <CircularProgressBadge score={confidence} />
                    </TableCell>
                    <TableCell>{fieldsExtracted}</TableCell>
                    <TableCell>
                      {invoice.caseNumber ? (
                        <span className="font-medium">{invoice.caseNumber}</span>
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
                    <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                        <Link href={`/invoices/${encodeId(invoice.id)}?source=invoices`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                        </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExport()}>
                              <FileDown className="mr-2 h-4 w-4" />
                              Export
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
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
        </CardContent>
      </Card>
    </div>
  );
}
