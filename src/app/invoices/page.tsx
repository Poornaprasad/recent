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
import { getStatusBadgeClass } from '@/lib/utils/status-utils';
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
import { getDocumentTypeBadgeClass } from "@/lib/utils/document-type-utils";
import { useState, useMemo, useEffect } from "react";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
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
        const result = await getInvoicesAction();
        if (result.error) {
          console.error('Error loading invoices:', result.error);
          setInvoices([]);
        } else if (result.data) {
          setInvoices(result.data);
        }
      } catch (error) {
        console.error('Error loading invoices:', error);
        setInvoices([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadInvoices();
  }, []);

  // Get unique vendors for filter
  const uniqueVendors = useMemo(() => {
    return getUniqueVendors(invoices);
  }, [invoices]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return filterInvoices(invoices, {
      searchTerm,
      statusFilter,
      documentTypeFilter,
      vendorFilter,
    });
  }, [invoices, searchTerm, statusFilter, documentTypeFilter, vendorFilter]);

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
    const totalProcessed = invoices.length;
    const needsReview = invoices.filter(inv => inv.status === 'Review').length;
    const avgFields = invoices.length > 0 
      ? (invoices.reduce((acc, inv) => acc + getFieldsExtractedCount(inv), 0) / invoices.length).toFixed(1)
      : '0';
    const highConfidence = invoices.filter(inv => getOverallConfidence(inv) >= 0.95).length;

    return [
    {
      title: "Total Processed",
        value: totalProcessed.toString(),
      icon: CheckCircle2,
        footerText: `${invoices.filter(inv => inv.status !== 'Draft').length} active invoices`,
    },
    {
      title: "Needs Review",
        value: needsReview.toString(),
      icon: FileClock,
        footerText: `${filteredInvoices.filter(inv => inv.status === 'Review').length} in current view`,
    },
    {
      title: "Avg. Fields Extracted",
        value: avgFields,
      icon: ClipboardList,
        footerText: "Per invoice",
    },
    {
      title: "High Confidence",
        value: highConfidence.toString(),
      icon: Sparkles,
        footerText: "Above 95% confidence score",
      },
    ];
  }, [invoices, filteredInvoices]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(new Set(paginatedInvoices.map(inv => inv.id)));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    const newSelected = new Set(selectedInvoices);
    if (checked) {
      newSelected.add(invoiceId);
    } else {
      newSelected.delete(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const handleExport = () => {
    const dataToExport = selectedInvoices.size > 0
      ? invoices.filter(inv => selectedInvoices.has(inv.id))
      : filteredInvoices;

    exportInvoicesToCSVFile(dataToExport);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

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
        <h2 className="text-3xl font-bold tracking-tight">Invoice Management</h2>
        <Button onClick={handleExport} size="sm" className="gap-1">
          <FileDown className="h-4 w-4" />
          Export {selectedInvoices.size > 0 ? `(${selectedInvoices.size})` : 'All'}
        </Button>
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
                <SelectItem value="Draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={documentTypeFilter} onValueChange={(value) => {
              setDocumentTypeFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Invoice">Invoice</SelectItem>
                <SelectItem value="Receipt">Receipt</SelectItem>
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
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
                        {invoice.documentType ? (
                          <Badge 
                            variant="outline" 
                            className={cn(getDocumentTypeBadgeClass(invoice.documentType))}
                          >
                            {invoice.documentType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/invoices/${encodeId(invoice.id)}`}
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
                      <Badge
                        variant="outline"
                        className={cn(getStatusBadgeClass(invoice.status || ''))}
                      >
                        {invoice.status}
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
                        <Link href={`/invoices/${encodeId(invoice.id)}`}>
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
