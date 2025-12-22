'use client';

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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatCard } from "@/components/dashboard/stat-card";
import { 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  DollarSign,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Building2,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  X,
  ArrowUpDown,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Permission, UserRole } from "@/lib/core/auth/rbac.types";
import { 
  getVendorInvoicesFor1099Action, 
  updateVendor1099StatusAction,
  saveVendorAction,
} from "@/lib/actions/index";
import { useAuthStore } from "@/hooks/use-auth-store";
import { VendorSetupDialog } from "@/components/dialogs/vendor-setup-dialog";
import Link from "next/link";
import { encodeId } from "@/lib/utils/id-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import type { StoredInvoice } from "@/lib/domain/types";
import type { Vendor } from "@/lib/domain/types";

type VendorInvoiceGroup = {
  vendorName: string;
  vendor?: Vendor;
  totalAmount: number;
  isBelowThreshold: boolean;
  invoices: Array<{
    invoice: StoredInvoice;
    caseNumber?: string;
    amount: number;
  }>;
  form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
  w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
  canProcessInvoices: boolean;
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
};

type SortField = 'name' | 'amount' | 'invoices' | 'status';
type SortDirection = 'asc' | 'desc';

export default function W9RequestsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendorGroups, setVendorGroups] = useState<VendorInvoiceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);
  const [selectedVendorInfo, setSelectedVendorInfo] = useState<{
    address?: string;
    email?: string;
    phone?: string;
    caseNumber?: string;
    invoiceId?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [thresholdFilter, setThresholdFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showW9Received, setShowW9Received] = useState(false); // Hide W9 received vendors by default

  // Check if user can manage W9 status
  // Admin has all permissions by default
  const canManageW9Status = user?.role === UserRole.ADMIN || 
    (user?.role && [UserRole.DIRECTOR, UserRole.MANAGER].includes(user.role as UserRole));

  useEffect(() => {
    loadVendorInvoices();
  }, []);

  const loadVendorInvoices = async () => {
    setIsLoading(true);
    try {
      const result = await getVendorInvoicesFor1099Action();
      if (result.data) {
        setVendorGroups(result.data);
        // Expand all vendors by default
        setExpandedVendors(new Set(result.data.map(v => v.vendorName)));
      } else if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load vendor invoices.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalVendors = vendorGroups.length;
    const vendorsInList = vendorGroups.filter(v => v.vendor).length;
    const vendorsNotInList = totalVendors - vendorsInList;
    const totalAmount = vendorGroups.reduce((sum, v) => sum + v.totalAmount, 0);
    const belowThreshold = vendorGroups.filter(v => v.isBelowThreshold).length;
    const canProcess = vendorGroups.filter(v => v.canProcessInvoices).length;
    const needsAttention = vendorGroups.filter(v => !v.vendor || !v.canProcessInvoices).length;
    const totalInvoices = vendorGroups.reduce((sum, v) => sum + v.invoices.length, 0);
    
    return {
      totalVendors,
      vendorsInList,
      vendorsNotInList,
      totalAmount,
      belowThreshold,
      canProcess,
      needsAttention,
      totalInvoices,
    };
  }, [vendorGroups]);

  // Filter and sort vendors
  const filteredAndSortedVendors = useMemo(() => {
    let filtered = vendorGroups.filter(group => {
      // W9 Received filter - exclude vendors with W9 received or tax ID unless showW9Received is true
      if (!showW9Received) {
        const hasW9Received = group.w9Status === 'Received';
        const hasTaxId = group.vendor?.taxId && group.vendor.taxId.trim() !== '';
        if (hasW9Received || hasTaxId) {
          return false;
        }
      }
      
      // Search filter
      const matchesSearch = !searchTerm || 
        group.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.invoices.some(inv => 
          inv.caseNumber?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'not-in-list' && !group.vendor) ||
        (statusFilter === 'in-list' && group.vendor) ||
        (statusFilter === 'can-process' && group.canProcessInvoices) ||
        (statusFilter === 'needs-attention' && (!group.vendor || !group.canProcessInvoices));
      
      // Threshold filter
      const matchesThreshold = thresholdFilter === 'all' ||
        (thresholdFilter === 'below' && group.isBelowThreshold) ||
        (thresholdFilter === 'above' && !group.isBelowThreshold);
      
      return matchesSearch && matchesStatus && matchesThreshold;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.vendorName.localeCompare(b.vendorName);
          break;
        case 'amount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'invoices':
          comparison = a.invoices.length - b.invoices.length;
          break;
        case 'status':
          const aStatus = a.vendor ? (a.canProcessInvoices ? 2 : 1) : 0;
          const bStatus = b.vendor ? (b.canProcessInvoices ? 2 : 1) : 0;
          comparison = aStatus - bStatus;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [vendorGroups, searchTerm, statusFilter, thresholdFilter, sortField, sortDirection, showW9Received]);

  const toggleVendor = (vendorName: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorName)) {
      newExpanded.delete(vendorName);
    } else {
      newExpanded.add(vendorName);
    }
    setExpandedVendors(newExpanded);
  };

  const expandAll = () => {
    setExpandedVendors(new Set(filteredAndSortedVendors.map(v => v.vendorName)));
  };

  const collapseAll = () => {
    setExpandedVendors(new Set());
  };

  const handleAddVendor = async (group: VendorInvoiceGroup) => {
    setSelectedVendorName(group.vendorName);
    // Get the first invoice for case number and invoice ID
    const firstInvoice = group.invoices[0];
    setSelectedVendorInfo({
      address: group.vendorAddress,
      email: group.vendorEmail,
      phone: group.vendorPhone,
      caseNumber: firstInvoice?.caseNumber,
      invoiceId: firstInvoice?.invoice.id,
    });
    setIsDialogOpen(true);
  };

  const handleSubmitSetup = async (data: {
    vendorType: string;
    email: string;
    phone: string;
    address: string;
    requires1099: boolean;
  }) => {
    if (!selectedVendorName) return;

    setIsProcessing(true);
    try {
      // Create vendor directly
      const vendorId = `vendor-${Date.now()}`;
      const result = await saveVendorAction({
        id: vendorId,
        name: selectedVendorName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        vendorType: data.vendorType || undefined,
        requires1099: data.requires1099,
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (result.success) {
        toast({
          title: 'Vendor Added',
          description: `${selectedVendorName} has been added to your vendor list.`,
        });
        setIsDialogOpen(false);
        setSelectedVendorName(null);
        setSelectedVendorInfo(null);
        await loadVendorInvoices();
        router.refresh();
      } else {
        throw new Error(result.error || 'Failed to add vendor');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add vendor.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateW9Status = async (
    vendorId: string,
    status: string
  ) => {
    setUpdatingStatus(prev => new Set(prev).add(vendorId));
    try {
      const updateData: {
        w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
      } = {
        w9Status: status as 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired',
      };

      const result = await updateVendor1099StatusAction(
        vendorId, 
        updateData,
        user?.role,
        user?.id
      );
      if (result.success) {
        toast({
          title: 'Status Updated',
          description: 'W9 status has been updated.',
        });
        await loadVendorInvoices();
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to update status.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update status.',
      });
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(vendorId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status || status === 'Not Required') {
      return <Badge variant="outline" className="gap-1">
        <X className="h-3 w-3" />
        Not Required
      </Badge>;
    }
    if (status === 'Received') {
      return <Badge className="bg-green-500 hover:bg-green-600 gap-1">
        <CheckCircle className="h-3 w-3" />
        {status}
      </Badge>;
    }
    if (status === 'Required' || status === 'Pending') {
      return <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {status}
      </Badge>;
    }
    if (status === 'Expired') {
      return <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {status}
      </Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getStatusColor = (group: VendorInvoiceGroup) => {
    if (!group.vendor) return 'border-l-red-500';
    if (group.canProcessInvoices) return 'border-l-green-500';
    return 'border-l-yellow-500';
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">W9 Requests</h2>
            <p className="text-muted-foreground mt-1">
            Track and manage W9 forms for vendors.
            </p>
          </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadVendorInvoices} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {!isLoading && vendorGroups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Vendors"
            value={stats.totalVendors.toString()}
            icon={Building2}
            footerText={`${stats.vendorsInList} in list, ${stats.vendorsNotInList} pending`}
          />
          <StatCard
            title="Total Amount"
            value={`$${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            footerText={`${stats.totalInvoices} invoices`}
          />
          <StatCard
            title="Below $600"
            value={stats.belowThreshold.toString()}
            icon={TrendingDown}
            footerText="Requires monitoring"
          />
          <StatCard
            title="Ready to Process"
            value={stats.canProcess.toString()}
            icon={CheckCircle}
            footerText={`${stats.needsAttention} need attention`}
          />
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mb-4" />
              <p>Loading vendor invoices...</p>
            </div>
          </CardContent>
        </Card>
      ) : vendorGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">No vendors requiring W9 forms</h3>
              <p>All vendors are properly set up and tracked.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters and Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vendors, case numbers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="not-in-list">Not in List</SelectItem>
                    <SelectItem value="in-list">In Vendor List</SelectItem>
                    <SelectItem value="can-process">Ready to Process</SelectItem>
                    <SelectItem value="needs-attention">Needs Attention</SelectItem>
                  </SelectContent>
                </Select>

                {/* Threshold Filter */}
                <Select value={thresholdFilter} onValueChange={setThresholdFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Amount" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Amounts</SelectItem>
                    <SelectItem value="below">Below $600</SelectItem>
                    <SelectItem value="above">Above $600</SelectItem>
                  </SelectContent>
                </Select>

                {/* Show W9 Received Toggle */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-w9-received"
                    checked={showW9Received}
                    onCheckedChange={(checked) => setShowW9Received(checked === true)}
                  />
                  <Label
                    htmlFor="show-w9-received"
                    className="text-sm font-normal cursor-pointer whitespace-nowrap"
                  >
                    Show W9 Received
                  </Label>
                </div>

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[140px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setSortField('name'); setSortDirection('asc'); }}>
                      Name {sortField === 'name' && sortDirection === 'asc' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortField('name'); setSortDirection('desc'); }}>
                      Name (Z-A) {sortField === 'name' && sortDirection === 'desc' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortField('amount'); setSortDirection('desc'); }}>
                      Amount (High) {sortField === 'amount' && sortDirection === 'desc' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortField('amount'); setSortDirection('asc'); }}>
                      Amount (Low) {sortField === 'amount' && sortDirection === 'asc' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortField('invoices'); setSortDirection('desc'); }}>
                      Most Invoices {sortField === 'invoices' && sortDirection === 'desc' && '✓'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Expand/Collapse All */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Expand All
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Collapse All
                  </Button>
                </div>
              </div>

              {/* Results count */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{filteredAndSortedVendors.length}</span> of{' '}
                  <span className="font-medium text-foreground">{vendorGroups.length}</span> vendors
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Cards */}
          <div className="space-y-4">
            {filteredAndSortedVendors.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No vendors match your filters.</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setThresholdFilter('all');
                    }}>
                      Clear Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredAndSortedVendors.map((group) => (
                <Card 
                  key={group.vendorName} 
                  className={cn("transition-all hover:shadow-md border-l-4", getStatusColor(group))}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Collapsible open={expandedVendors.has(group.vendorName)}>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleVendor(group.vendorName)}
                              className="h-8 w-8 p-0 mt-1"
                            >
                              {expandedVendors.has(group.vendorName) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </Collapsible>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <CardTitle className="text-xl">{group.vendorName}</CardTitle>
                            {!group.vendor && (
                              <>
                                <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
                                  Not in List
                                </Badge>
                                <Button
                                  size="sm"
                                  onClick={() => handleAddVendor(group)}
                                  className="ml-auto"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add to Vendor List
                                </Button>
                              </>
                            )}
                            {group.vendor && group.canProcessInvoices && (
                              <Badge className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ready
                              </Badge>
                            )}
                          </div>
                          
                          {/* Vendor Info */}
                          {(group.vendorAddress || group.vendorEmail || group.vendorPhone) && (
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                              {group.vendorAddress && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate max-w-[200px]">{group.vendorAddress}</span>
                                </div>
                              )}
                              {group.vendorEmail && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <span>{group.vendorEmail}</span>
                                </div>
                              )}
                              {group.vendorPhone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{group.vendorPhone}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Amount</div>
                          <div className="text-2xl font-bold flex items-center gap-2 mt-1">
                            <DollarSign className="h-5 w-5" />
                            {group.totalAmount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {group.invoices.length} invoice{group.invoices.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      {/* W9 Status - Simplified */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          W9 Status
                        </label>
                        {group.vendor?.id ? (
                          <div className="flex flex-col gap-1">
                            <Select
                              value={group.w9Status || 'Not Required'}
                              onValueChange={(value) => 
                                handleUpdateW9Status(group.vendor!.id, value)
                              }
                              disabled={updatingStatus.has(group.vendor.id) || !canManageW9Status}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Not Required">Not Required</SelectItem>
                                <SelectItem value="Required">Required</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Received">Received</SelectItem>
                                <SelectItem value="Expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                            {!canManageW9Status && (
                              <p className="text-xs text-muted-foreground">
                                Contact administrator for W9 status updates
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>{getStatusBadge(group.w9Status)}</div>
                        )}
                      </div>

                      {/* Simplified Status Info */}
                      {!group.vendor && (
                        <div className="text-sm text-muted-foreground">
                          Add vendor to track W9 status
                        </div>
                      )}
                      
                      {group.isBelowThreshold && group.vendor && (
                        <div className="text-sm text-orange-600 dark:text-orange-400">
                          Below $600 threshold (${group.totalAmount.toFixed(2)} / $600.00)
                        </div>
                      )}

                      {group.vendor && !group.canProcessInvoices && (
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">
                          W9 form required to process invoices
                        </div>
                      )}

                      {/* Invoices List */}
                      <Collapsible open={expandedVendors.has(group.vendorName)}>
                        <CollapsibleContent>
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Invoices ({group.invoices.length})
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                Total: ${group.totalAmount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Badge>
                            </div>
                            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Case Number</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                                  {group.invoices.map(({ invoice, caseNumber, amount }) => (
                                    <TableRow key={invoice.id} className="hover:bg-muted/50">
                                      <TableCell className="font-medium">
                                        {typeof invoice.invoiceNumber === 'object' && invoice.invoiceNumber?.value 
                                          ? invoice.invoiceNumber.value 
                                          : invoice.id.slice(0, 8)}
                                      </TableCell>
                                      <TableCell>
                                        {typeof invoice.invoiceDate === 'object' && invoice.invoiceDate?.value 
                                          ? invoice.invoiceDate.value 
                                          : '-'}
                                      </TableCell>
                      <TableCell>
                                        {caseNumber ? (
                                          <Badge variant="outline">{caseNumber}</Badge>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">No Case</span>
                        )}
                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        ${amount.toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </TableCell>
                      <TableCell>
                                        <Badge variant="outline" className={cn(
                                          invoice.status === 'Paid' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                                          invoice.status === 'Pending' && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                                          invoice.status === 'Review' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        )}>
                                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                            <Button
                                          variant="ghost"
                              size="sm"
                              asChild
                            >
                                          <Link href={`/invoices/${encodeId(invoice.id)}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
      </div>
        </>
      )}

      <VendorSetupDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedVendorName(null);
            setSelectedVendorInfo(null);
          }
        }}
        vendor={selectedVendorName ? {
          id: `temp-${selectedVendorName}`,
          name: selectedVendorName,
          email: selectedVendorInfo?.email,
          phone: selectedVendorInfo?.phone,
          address: selectedVendorInfo?.address,
          status: 'Pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        } : null}
        caseNumber={selectedVendorInfo?.caseNumber}
        invoiceId={selectedVendorInfo?.invoiceId}
        isProcessing={isProcessing}
        onSubmit={handleSubmitSetup}
      />
    </div>
  );
}

