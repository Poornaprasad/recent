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
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Copy,
  AlertTriangle,
  FileText,
  Layers,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils/utils';
import { getStatusBadgeClass, hasDisbursementBeenSent, canPushToCrm } from '@/lib/utils/status-utils';
import { getOverallConfidence, formatTotalAmount, filterInvoices, sortInvoices, getUniqueVendors, type SortField, type SortDirection, parseInvoiceAmount } from '@/lib/utils/invoice-utils';
import Link from "next/link";
import { CircularProgressBadge } from "@/components/invoice/circular-progress-badge";
import { getInvoicesAction, updateInvoiceStatusAction } from '@/lib/actions/index';
import type { StoredInvoice } from '@/lib/domain/types';
import { encodeId } from "@/lib/utils/id-utils";
import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { ApprovalActions } from "./_components/approval-actions";
import { useToast } from "@/hooks/use-toast";
import { DisbursementFormModal } from "@/components/invoice/disbursement-form-modal";
import { 
  useStateFilter, 
  STATE_OPTIONS, 
  type StateFilterValue,
  getEffectiveStateFilter,
  shouldShowStateFilter,
  getStateOptionsForUser,
  getStateDisplayName
} from "@/hooks/use-state-filter";

export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { selectedState, setSelectedState } = useStateFilter();
  const effectiveStateFilter = getEffectiveStateFilter(user, selectedState);
  const showStateFilter = shouldShowStateFilter(user);
  const stateOptions = getStateOptionsForUser(user);
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [caseFilter, setCaseFilter] = useState<string>('all');
  const [duplicateFilter, setDuplicateFilter] = useState<string>('all'); // 'all', 'duplicates', 'same-case'
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false);
  const [selectedInvoiceForDisbursement, setSelectedInvoiceForDisbursement] = useState<StoredInvoice | null>(null);

  // Ensure modal opens when invoice is set
  useEffect(() => {
    if (selectedInvoiceForDisbursement) {
      console.log('=== useEffect: Invoice set for disbursement ===');
      console.log('Invoice ID:', selectedInvoiceForDisbursement.id);
      console.log('Current modal state:', isDisbursementModalOpen);
      if (!isDisbursementModalOpen) {
        console.log('Opening modal from useEffect...');
        setIsDisbursementModalOpen(true);
      }
    }
  }, [selectedInvoiceForDisbursement]);
  
  // Debug: Log modal state changes
  useEffect(() => {
    console.log('Modal state changed - isOpen:', isDisbursementModalOpen, 'invoice:', selectedInvoiceForDisbursement?.id);
  }, [isDisbursementModalOpen, selectedInvoiceForDisbursement]);

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
          // Filter for invoices that need review: all uploaded/ingested invoices that are not approved
          // Include all statuses (Review, Pending, Draft) except Paid, and include escalated invoices
          const invoicesForReview = result.data.filter(inv => 
            inv.status !== 'Paid' && 
            inv.approvalStatus !== 'Approved'
          );
          setInvoices(invoicesForReview);
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

  // Get unique vendors for filter
  const uniqueVendors = useMemo(() => {
    return getUniqueVendors(invoices);
  }, [invoices]);

  // Get unique case numbers for filter
  const uniqueCases = useMemo(() => {
    const cases = new Set<string>();
    invoices.forEach(inv => {
      if (inv.caseNumber) cases.add(inv.caseNumber);
    });
    return Array.from(cases).sort();
  }, [invoices]);

  // Group invoices by case number for duplicate detection
  const invoicesByCase = useMemo(() => {
    const grouped = new Map<string, StoredInvoice[]>();
    invoices.forEach(inv => {
      if (inv.caseNumber) {
        if (!grouped.has(inv.caseNumber)) {
          grouped.set(inv.caseNumber, []);
        }
        grouped.get(inv.caseNumber)!.push(inv);
      }
    });
    return grouped;
  }, [invoices]);

  // Find invoices with same case that are duplicates
  const sameCaseDuplicates = useMemo(() => {
    const duplicates = new Set<string>();
    invoicesByCase.forEach((caseInvoices, caseNumber) => {
      if (caseInvoices.length > 1) {
        // Check if any are marked as duplicates
        const hasDuplicates = caseInvoices.some(inv => inv.isDuplicate);
        if (hasDuplicates) {
          caseInvoices.forEach(inv => duplicates.add(inv.id));
        }
      }
    });
    return duplicates;
  }, [invoicesByCase]);

  // Filter invoices by effective state filter
  const stateFilteredInvoices = useMemo(() => {
    if (effectiveStateFilter === 'all') {
      return invoices;
    }
    return invoices.filter(inv => inv.state === effectiveStateFilter);
  }, [invoices, effectiveStateFilter]);

  // Filter invoices by other filters
  const filteredInvoices = useMemo(() => {
    let filtered = filterInvoices(stateFilteredInvoices, {
      searchTerm,
      statusFilter: 'all', // Show all statuses (Review, Pending, Draft) - already filtered in loadInvoices
      documentTypeFilter,
      vendorFilter,
    });

    // Apply case filter
    if (caseFilter !== 'all') {
      filtered = filtered.filter(inv => inv.caseNumber === caseFilter);
    }

    // Apply duplicate filter
    if (duplicateFilter === 'duplicates') {
      filtered = filtered.filter(inv => inv.isDuplicate);
    } else if (duplicateFilter === 'same-case') {
      filtered = filtered.filter(inv => sameCaseDuplicates.has(inv.id));
    }

    return filtered;
  }, [stateFilteredInvoices, searchTerm, documentTypeFilter, vendorFilter, caseFilter, duplicateFilter, sameCaseDuplicates]);

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
    const totalPending = stateFilteredInvoices.length;
    const highPriority = stateFilteredInvoices.filter(inv => {
      const confidence = getOverallConfidence(inv);
      return confidence < 0.7; // Low confidence = high priority
    }).length;
    const avgConfidence = stateFilteredInvoices.length > 0
      ? (stateFilteredInvoices.reduce((acc, inv) => acc + getOverallConfidence(inv), 0) / stateFilteredInvoices.length * 100).toFixed(1)
      : '0';
    const duplicatesCount = stateFilteredInvoices.filter(inv => inv.isDuplicate).length;

    // Calculate same case duplicates for the filtered invoices
    const stateFilteredSameCaseDuplicates = new Set<string>();
    const groupedByCase = new Map<string, StoredInvoice[]>();
    stateFilteredInvoices.forEach(inv => {
      if (inv.caseNumber) {
        if (!groupedByCase.has(inv.caseNumber)) {
          groupedByCase.set(inv.caseNumber, []);
        }
        groupedByCase.get(inv.caseNumber)!.push(inv);
      }
    });
    groupedByCase.forEach((caseInvoices) => {
      if (caseInvoices.length > 1 && caseInvoices.some(inv => inv.isDuplicate)) {
        caseInvoices.forEach(inv => stateFilteredSameCaseDuplicates.add(inv.id));
      }
    });
    const sameCaseDuplicatesCount = stateFilteredSameCaseDuplicates.size;

    // Footer shows count within filtered state only
    const stateLabel = effectiveStateFilter === 'all' ? '' : ` (${effectiveStateFilter})`;

    return [
      {
        title: "Pending Approval",
        value: totalPending.toString(),
        icon: FileClock,
        footerText: `${filteredInvoices.length} in current view${stateLabel}`,
      },
      {
        title: "High Priority",
        value: highPriority.toString(),
        icon: AlertCircle,
        footerText: `Low confidence (< 70%)${stateLabel}`,
      },
      {
        title: "Duplicates",
        value: duplicatesCount.toString(),
        icon: Copy,
        footerText: `${sameCaseDuplicatesCount} same case${stateLabel}`,
      },
      {
        title: "Avg. Confidence",
        value: `${avgConfidence}%`,
        icon: Clock,
        footerText: `Across pending${stateLabel}`,
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

  const SortIcon = memo(({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  });
  SortIcon.displayName = 'SortIcon';


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

  const handleBulkAction = useCallback((action: 'approve' | 'reject') => {
    if (selectedInvoices.size === 0) {
      toast({
        variant: 'destructive',
        title: 'No Selection',
        description: 'Please select at least one invoice.',
      });
      return;
    }

    // Check if any selected invoices are duplicates with same case
    const selectedInvoicesList = invoices.filter(inv => selectedInvoices.has(inv.id));
    const hasSameCaseDuplicates = selectedInvoicesList.some(inv => sameCaseDuplicates.has(inv.id));

    if (action === 'approve' && hasSameCaseDuplicates) {
      // Require approval reason for same-case duplicates
      setBulkAction(action);
      setIsBulkDialogOpen(true);
    } else {
      // For reject or non-duplicate approve, proceed without reason
      setBulkAction(action);
      setIsBulkDialogOpen(true);
      if (action === 'reject') {
        setApprovalReason('Bulk rejection');
      }
    }
  }, [selectedInvoices, invoices, sameCaseDuplicates, toast]);

  const handleBulkSubmit = useCallback(async () => {
    if (selectedInvoices.size === 0) return;

    const selectedInvoicesList = invoices.filter(inv => selectedInvoices.has(inv.id));
    const hasSameCaseDuplicates = selectedInvoicesList.some(inv => sameCaseDuplicates.has(inv.id));

    // Require reason for approving same-case duplicates
    if (bulkAction === 'approve' && hasSameCaseDuplicates && !approvalReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Approval Reason Required',
        description: 'Please provide a reason for approving duplicate invoices with the same case number.',
      });
      return;
    }

    setIsProcessingBulk(true);
    try {
      const status = bulkAction === 'approve' ? 'Pending' : 'Draft';
      const promises = Array.from(selectedInvoices).map(id => 
        updateInvoiceStatusAction(id, status)
      );

      await Promise.all(promises);

      toast({
        title: `Bulk ${bulkAction === 'approve' ? 'Approval' : 'Rejection'} Successful`,
        description: `${selectedInvoices.size} invoice(s) ${bulkAction === 'approve' ? 'approved' : 'rejected'}.`,
      });

      setSelectedInvoices(new Set());
      setIsBulkDialogOpen(false);
      setApprovalReason('');
      await loadInvoices();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Bulk Action Failed',
        description: 'Failed to process bulk action. Please try again.',
      });
    } finally {
      setIsProcessingBulk(false);
    }
  }, [selectedInvoices, invoices, sameCaseDuplicates, bulkAction, approvalReason, toast, loadInvoices]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading approval queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Review Pending Invoices</h2>
            <p className="text-muted-foreground mt-1">
              Invoices that require manual review and approval before processing
            </p>
          </div>
          {!showStateFilter && effectiveStateFilter !== 'all' && (
            <Badge variant="outline" className="text-sm">
              {getStateDisplayName(effectiveStateFilter)}
            </Badge>
          )}
        </div>
        {selectedInvoices.size > 0 && (
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm"
              onClick={() => handleBulkAction('approve')}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Approve Selected ({selectedInvoices.size})
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => handleBulkAction('reject')}
            >
              <Square className="mr-2 h-4 w-4" />
              Reject Selected ({selectedInvoices.size})
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="grid gap-2">
            <CardTitle>Invoice Approval Queue</CardTitle>
            <CardDescription>
              {filteredInvoices.length} of {invoices.length} invoices pending approval
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
                placeholder="Search invoices, cases..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
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
                <SelectItem value="Per Diem">Per Diem</SelectItem>
                <SelectItem value="Estate">Estate</SelectItem>
                <SelectItem value="Reimbursement">Reimbursement</SelectItem>
                <SelectItem value="Office Credit Card Bill">Office Credit Card Bill</SelectItem>
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
            {uniqueCases.length > 0 && (
              <Select value={caseFilter} onValueChange={(value) => {
                setCaseFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Case #" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cases</SelectItem>
                  {uniqueCases.map(caseNum => (
                    <SelectItem key={caseNum} value={caseNum}>{caseNum}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={duplicateFilter} onValueChange={(value) => {
              setDuplicateFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Duplicates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="duplicates">Duplicates Only</SelectItem>
                <SelectItem value="same-case">Same Case Duplicates</SelectItem>
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
              <h3 className="text-lg font-semibold">Approval Queue is Empty</h3>
              <p className="text-muted-foreground mt-2">
                {invoices.length === 0 
                  ? "There are currently no invoices that require manual approval."
                  : "No invoices match your current filters."}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedInvoices.size === paginatedInvoices.length && paginatedInvoices.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
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
                    <TableHead>State</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>CRM Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice) => {
                    const confidence = getOverallConfidence(invoice);
                    const isSelected = selectedInvoices.has(invoice.id);
                    const isSameCaseDuplicate = sameCaseDuplicates.has(invoice.id);
                    const caseInvoiceCount = invoice.caseNumber ? invoicesByCase.get(invoice.caseNumber)?.length || 0 : 0;

                    return (
                      <TableRow key={invoice.id} className={isSelected ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectInvoice(invoice.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/invoices/${encodeId(invoice.id)}?source=approvals&autoAdvance=true`}
                            className="text-primary hover:underline"
                          >
                            {invoice.invoiceNumber?.value || invoice.id}
                          </Link>
                        </TableCell>
                        <TableCell>{invoice.vendorName?.value || 'N/A'}</TableCell>
                        <TableCell>{invoice.invoiceDate?.value || 'N/A'}</TableCell>
                        <TableCell>
                          ${formatTotalAmount(invoice.totalAmount?.value || invoice.amount?.value)}
                        </TableCell>
                        <TableCell className="flex justify-center">
                          <CircularProgressBadge score={confidence} />
                        </TableCell>
                        <TableCell>
                          {invoice.caseNumber ? (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{invoice.caseNumber}</span>
                              {caseInvoiceCount > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  {caseInvoiceCount}
                                </Badge>
                              )}
                            </div>
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
                          <div className="flex gap-1 flex-wrap">
                            {invoice.isDuplicate && (
                              <Badge variant="destructive" className="text-xs">
                                <Copy className="h-3 w-3 mr-1" />
                                Duplicate
                              </Badge>
                            )}
                            {isSameCaseDuplicate && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Same Case
                              </Badge>
                            )}
                            {confidence < 0.7 && (
                              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
                                Low Confidence
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {invoice.crmStatus === 'Duplicate' ? (
                            <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Duplicate
                            </Badge>
                          ) : hasDisbursementBeenSent(invoice) ? (
                            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 border-green-300 text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Sent to CRM
                            </Badge>
                          ) : canPushToCrm(invoice) ? (
                            <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 text-yellow-700 dark:text-yellow-400">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canPushToCrm(invoice) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (invoice && invoice.id) {
                                    setSelectedInvoiceForDisbursement(invoice);
                                    setIsDisbursementModalOpen(true);
                                    toast({
                                      title: 'Opening Disbursement Form',
                                      description: `Preparing form for invoice ${invoice.invoiceNumber?.value || invoice.id}`,
                                    });
                                  }
                                }}
                              >
                                <Layers className="h-4 w-4 mr-2" />
                                Push to CRM
                              </Button>
                            )}
                            <ApprovalActions 
                            invoiceId={invoice.id} 
                            onApprovalChange={loadInvoices}
                            isSameCaseDuplicate={isSameCaseDuplicate}
                            caseNumber={invoice.caseNumber}
                            invoice={invoice}
                            onOpenDisbursementModal={(inv) => {
                              console.log('=== MODAL CALLBACK TRIGGERED ===');
                              console.log('Setting up disbursement modal for invoice:', inv?.id);
                              console.log('Invoice object keys:', inv ? Object.keys(inv) : 'null');
                              
                              if (inv && inv.id) {
                                // Set both states together using functional updates
                                setSelectedInvoiceForDisbursement(() => {
                                  console.log('Setting selected invoice:', inv.id);
                                  return inv;
                                });
                                setIsDisbursementModalOpen(() => {
                                  console.log('Setting modal open state to true');
                                  return true;
                                });
                                console.log('✅ Modal state set to open for invoice:', inv.id);
                                
                                // Show toast to confirm
                                toast({
                                  title: 'Disbursement Form Opening',
                                  description: `Preparing form for invoice ${inv.invoiceNumber?.value || inv.id}`,
                                });
                              } else {
                                console.error('❌ No invoice or invoice.id provided to openDisbursementModal');
                                console.error('Invoice received:', inv);
                                toast({
                                  variant: 'destructive',
                                  title: 'Error',
                                  description: 'Invalid invoice data. Cannot open disbursement form.',
                                });
                              }
                            }}
                          />
                          </div>
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

      {/* Bulk Action Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'approve' ? 'Bulk Approve Invoices' : 'Bulk Reject Invoices'}
            </DialogTitle>
            <DialogDescription>
              {bulkAction === 'approve' 
                ? `You are about to approve ${selectedInvoices.size} invoice(s).`
                : `You are about to reject ${selectedInvoices.size} invoice(s).`}
            </DialogDescription>
          </DialogHeader>
          {bulkAction === 'approve' && invoices.filter(inv => selectedInvoices.has(inv.id)).some(inv => sameCaseDuplicates.has(inv.id)) && (
            <div className="space-y-2">
              <Label htmlFor="approval-reason">
                Approval Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="approval-reason"
                placeholder="Please provide a reason for approving duplicate invoices with the same case number..."
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                A reason is required when approving duplicate invoices with the same case number.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsBulkDialogOpen(false);
              setApprovalReason('');
            }} disabled={isProcessingBulk}>
              Cancel
            </Button>
            <Button onClick={handleBulkSubmit} disabled={isProcessingBulk}>
              {isProcessingBulk ? 'Processing...' : (bulkAction === 'approve' ? 'Approve' : 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement Form Modal - Always render, control visibility with isOpen */}
      {selectedInvoiceForDisbursement ? (
        <DisbursementFormModal
          isOpen={isDisbursementModalOpen}
          onOpenChange={(open) => {
            console.log('Disbursement modal onOpenChange called with:', open);
            setIsDisbursementModalOpen(open);
            if (!open) {
              setSelectedInvoiceForDisbursement(null);
              // Reload invoices after modal closes
              loadInvoices();
            }
          }}
          invoice={selectedInvoiceForDisbursement}
        />
      ) : null}
    </div>
  );
}
