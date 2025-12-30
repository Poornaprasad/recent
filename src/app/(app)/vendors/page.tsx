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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
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
  MoreHorizontal,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileText,
  Building2,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  Trash2,
  Edit,
  Copy,
} from "lucide-react";
import { getVendorsAction, deleteVendorAction, syncVendorTypesFromCrmAction } from '@/lib/actions/index';
import type { Vendor as DomainVendor } from "@/lib/domain/types";
import { cn } from '@/lib/utils/utils';
import { getStatusBadgeClass } from '@/lib/utils/status-utils';
import { useState, useEffect, useMemo, useCallback } from "react";
import { VendorForm } from "@/components/vendor/vendor-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableFilters } from "@/components/table/table-filters";
import { TablePagination } from "@/components/table/table-pagination";

type SortField = 'name' | 'type' | 'status' | 'email' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function VendorsPage() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<DomainVendor[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<DomainVendor | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<DomainVendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Advanced filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [requires1099Filter, setRequires1099Filter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setIsLoading(true);
    try {
      const result = await getVendorsAction();
      if (result.data) {
        setVendors(result.data);
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
        description: 'Failed to load vendors.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique vendor types for filter
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    vendors.forEach(v => {
      if (v.vendorType) types.add(v.vendorType);
    });
    return Array.from(types).sort();
  }, [vendors]);

  // Filter vendors
  const filteredVendors = useMemo(() => {
    let filtered = vendors;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(searchLower) ||
        (v.email && v.email.toLowerCase().includes(searchLower)) ||
        (v.vendorType && v.vendorType.toLowerCase().includes(searchLower)) ||
        (v.address && v.address.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(v => v.vendorType === typeFilter);
    }

    // 1099 filter
    if (requires1099Filter !== 'all') {
      const requires1099 = requires1099Filter === 'yes';
      filtered = filtered.filter(v => v.requires1099 === requires1099);
    }

    return filtered;
  }, [vendors, searchTerm, statusFilter, typeFilter, requires1099Filter]);

  // Sort vendors
  const sortedVendors = useMemo(() => {
    const sorted = [...filteredVendors];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = (a.vendorType || '').localeCompare(b.vendorType || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '');
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredVendors, sortField, sortDirection]);

  // Paginate vendors
  const paginatedVendors = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedVendors.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedVendors, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedVendors.length / rowsPerPage);

  // Calculate stats
  const stats = useMemo(() => {
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter(v => v.status === 'Active').length;
    const requires1099 = vendors.filter(v => v.requires1099).length;
    const vendorsWithTypes = vendors.filter(v => v.vendorType).length;

    return [
      {
        title: "Total Vendors",
        value: totalVendors.toString(),
        icon: Building2,
        footerText: `${filteredVendors.length} in current view`,
      },
      {
        title: "Active Vendors",
        value: activeVendors.toString(),
        icon: CheckCircle2,
        footerText: `${filteredVendors.filter(v => v.status === 'Active').length} in current view`,
      },
      {
        title: "Requires W9",
        value: requires1099.toString(),
        icon: AlertTriangle,
        footerText: `${filteredVendors.filter(v => v.requires1099).length} in current view`,
      },
      {
        title: "With Types",
        value: vendorsWithTypes.toString(),
        icon: FileText,
        footerText: `${filteredVendors.filter(v => v.vendorType).length} in current view`,
      },
    ];
  }, [vendors, filteredVendors]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedVendors(new Set(paginatedVendors.map(v => v.id)));
    } else {
      setSelectedVendors(new Set());
    }
  }, [paginatedVendors]);

  const handleSelectVendor = useCallback((vendorId: string, checked: boolean) => {
    setSelectedVendors(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(vendorId);
      } else {
        next.delete(vendorId);
      }
      return next;
    });
  }, []);

  const handleAddVendor = () => {
    setSelectedVendor(null);
    setIsFormOpen(true);
  };

  const handleEditVendor = (vendor: DomainVendor) => {
    setSelectedVendor(vendor);
    setIsFormOpen(true);
  };

  const handleDeleteVendor = (vendor: DomainVendor) => {
    setVendorToDelete(vendor);
    setIsDeleteAlertOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedVendors.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedVendors.size} vendor(s)?`);
    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const vendorId of selectedVendors) {
      const result = await deleteVendorAction(vendorId);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    toast({
      title: 'Bulk Delete Complete',
      description: `Successfully deleted ${successCount} vendor(s). ${failCount > 0 ? `${failCount} failed.` : ''}`,
    });

    setSelectedVendors(new Set());
    await loadVendors();
  };
  
  const confirmDelete = async () => {
    if (vendorToDelete) {
      const result = await deleteVendorAction(vendorToDelete.id);
      if (result.success) {
        toast({
          title: 'Vendor Deleted',
          description: 'The vendor has been removed.',
        });
        await loadVendors();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to delete vendor.',
        });
      }
      setVendorToDelete(null);
    }
    setIsDeleteAlertOpen(false);
  }

  const handleFormSubmit = async (vendorData: DomainVendor) => {
    const { saveVendorAction } = await import('@/lib/actions');
    const saveResult = await saveVendorAction(vendorData);
    if (saveResult.success) {
      toast({
        title: selectedVendor ? 'Vendor Updated' : 'Vendor Created',
        description: selectedVendor 
          ? 'The vendor has been updated successfully.'
          : 'The vendor has been created successfully.',
      });
      await loadVendors();
      setIsFormOpen(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: saveResult.error || `Failed to ${selectedVendor ? 'update' : 'create'} vendor.`,
      });
    }
  }

  const handleSyncVendorTypes = async () => {
    setIsSyncing(true);
    try {
      const result = await syncVendorTypesFromCrmAction();
      if (result.success) {
        toast({
          title: 'Vendor Types Synced',
          description: result.message || `Successfully synced ${result.synced} vendor type(s) from CRM.`,
        });
        await loadVendors();
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync Failed',
          description: result.message || result.errors.join(', ') || 'Failed to sync vendor types from CRM.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to sync vendor types from CRM.',
      });
    } finally {
      setIsSyncing(false);
    }
  }

  const handleExport = useCallback(() => {
    const headers = ['Name', 'Type', 'Email', 'Phone', 'Address', 'Status', 'Requires W9', 'W9 Status', 'Created At'];
    const rows = sortedVendors.map(v => [
      v.name,
      v.vendorType || '',
      v.email || '',
      v.phone || '',
      v.address || '',
      v.status,
      v.requires1099 ? 'Yes' : 'No',
      v.w9Status || '',
      new Date(v.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendors-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: `Exported ${sortedVendors.length} vendor(s) to CSV.`,
    });
  }, [sortedVendors, toast]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const isAllSelected = paginatedVendors.length > 0 && paginatedVendors.every(v => selectedVendors.has(v.id));
  const isSomeSelected = paginatedVendors.some(v => selectedVendors.has(v.id));

  return (
    <>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Vendors</h2>
            <p className="text-muted-foreground mt-1">
              Manage your vendor list, including vendor types, contact information, and W9 requirements
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSyncVendorTypes} 
              disabled={isSyncing}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
              {isSyncing ? 'Syncing...' : 'Sync Types'}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={sortedVendors.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleAddVendor}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        {/* Main Content Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Vendor Directory</CardTitle>
                <CardDescription>
                  {isLoading 
                    ? 'Loading vendors...' 
                    : `${sortedVendors.length} vendor${sortedVendors.length !== 1 ? 's' : ''} found`
                  }
                </CardDescription>
              </div>
              {selectedVendors.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedVendors.size} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : vendors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first vendor to the system.
                </p>
                <Button onClick={handleAddVendor}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Vendor
                </Button>
              </div>
            ) : (
              <>
                {/* Advanced Filters */}
                <TableFilters
                  searchPlaceholder="Search vendors by name, email, type..."
                  searchValue={searchTerm}
                  onSearchChange={setSearchTerm}
                  filters={[
                    {
                      value: statusFilter,
                      onChange: setStatusFilter,
                      config: {
                        placeholder: 'Status',
                        options: [
                          { value: 'all', label: 'All Statuses' },
                          { value: 'Active', label: 'Active' },
                          { value: 'Inactive', label: 'Inactive' },
                        ],
                        width: 'w-[140px]',
                      },
                    },
                    {
                      value: typeFilter,
                      onChange: setTypeFilter,
                      config: {
                        placeholder: 'Vendor Type',
                        options: [
                          { value: 'all', label: 'All Types' },
                          ...uniqueTypes.map(type => ({ value: type, label: type })),
                        ],
                        width: 'w-[180px]',
                      },
                    },
                    {
                      value: requires1099Filter,
                      onChange: setRequires1099Filter,
                      config: {
                        placeholder: 'W9 Required',
                        options: [
                          { value: 'all', label: 'All' },
                          { value: 'yes', label: 'Yes' },
                          { value: 'no', label: 'No' },
                        ],
                        width: 'w-[140px]',
                      },
                    },
                  ]}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(value) => {
                    setRowsPerPage(value);
                    setCurrentPage(1);
                  }}
                />

                {/* Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 -ml-3"
                            onClick={() => handleSort('name')}
                          >
                            Name
                            <SortIcon field="name" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 -ml-3"
                            onClick={() => handleSort('type')}
                          >
                            Contact Type
                            <SortIcon field="type" />
                          </Button>
                        </TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Tax ID</TableHead>
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
                        <TableHead>W9 Status</TableHead>
                        <TableHead className="w-[100px]">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedVendors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <Search className="h-8 w-8 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">
                                No vendors found matching your filters.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedVendors.map((vendor) => (
                          <TableRow 
                            key={vendor.id}
                            className={cn(
                              selectedVendors.has(vendor.id) && "bg-muted/50"
                            )}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedVendors.has(vendor.id)}
                                onCheckedChange={(checked) => 
                                  handleSelectVendor(vendor.id, checked as boolean)
                                }
                                aria-label={`Select ${vendor.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{vendor.name}</span>
                                {vendor.address && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3" />
                                    {vendor.address}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {vendor.vendorType ? (
                                <Badge variant="outline" className="font-normal">
                                  {vendor.vendorType}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {vendor.email && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="truncate max-w-[200px]">{vendor.email}</span>
                                  </div>
                                )}
                                {vendor.phone && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>{vendor.phone}</span>
                                  </div>
                                )}
                                {!vendor.email && !vendor.phone && (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {vendor.taxId ? (
                                <span className="text-sm font-mono">{vendor.taxId}</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  getStatusBadgeClass(vendor.status),
                                  "font-normal"
                                )}
                              >
                                {vendor.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {vendor.requires1099 && (
                                  <Badge variant="destructive" className="gap-1 w-fit">
                                    <AlertTriangle className="h-3 w-3" />
                                    W9 Required
                                  </Badge>
                                )}
                                {vendor.w9Status && vendor.w9Status !== 'Not Required' && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs w-fit",
                                      vendor.w9Status === 'Received' && "bg-green-50 text-green-700 border-green-200",
                                      vendor.w9Status === 'Expired' && "bg-red-50 text-red-700 border-red-200",
                                      vendor.w9Status === 'Pending' && "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    )}
                                  >
                                    W9: {vendor.w9Status}
                                  </Badge>
                                )}
                                {!vendor.requires1099 && !vendor.w9Status && (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    aria-haspopup="true" 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-8 w-8"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onSelect={() => handleEditVendor(vendor)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onSelect={() => {
                                      navigator.clipboard.writeText(vendor.id);
                                      toast({
                                        title: 'Copied',
                                        description: 'Vendor ID copied to clipboard.',
                                      });
                                    }}
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy ID
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onSelect={() => handleDeleteVendor(vendor)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    rowsPerPage={rowsPerPage}
                    totalItems={sortedVendors.length}
                    onPageChange={setCurrentPage}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <VendorForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        vendor={selectedVendor}
      />
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the vendor{' '}
              <strong>{vendorToDelete?.name}</strong> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
