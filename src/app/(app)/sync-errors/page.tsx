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
  FileX,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Check,
  Download,
  X,
  Search,
  Filter,
  Loader2,
  Info,
  AlertCircle,
  FileDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Calendar,
  FileText,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils/utils';
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/hooks/use-auth-store";
import {
  getDocumentSyncErrorsAction,
  resolveDocumentSyncErrorAction,
  getDocumentSyncErrorStatsAction,
  getDocumentContentAction,
  deleteAllDocumentSyncErrorsAction,
  deleteResolvedDocumentSyncErrorsAction,
} from '@/lib/actions/document-sync-error.actions';
import type { DocumentSyncError } from '@/lib/db/schema';
import { InvoiceViewer } from '@/components/invoice/invoice-viewer';

export default function SyncErrorsPage() {
  const { user, token } = useAuthStore();
  const { toast } = useToast();
  const [errors, setErrors] = useState<DocumentSyncError[]>([]);
  const [allErrors, setAllErrors] = useState<DocumentSyncError[]>([]); // For client-side filtering
  const [stats, setStats] = useState<{
    total: number;
    resolved: number;
    unresolved: number;
    byErrorType: Record<string, number>;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('unresolved');
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('all');
  const [caseNumberFilter, setCaseNumberFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedError, setSelectedError] = useState<DocumentSyncError | null>(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [selectedErrors, setSelectedErrors] = useState<Set<string>>(new Set());
  const [documentDataUri, setDocumentDataUri] = useState<string | null>(null);
  const [documentContentType, setDocumentContentType] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'syncDate' | 'documentID' | 'errorType' | 'caseNumber'>('syncDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const statusAnnouncementRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const loadErrors = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const result = await getDocumentSyncErrorsAction({
        resolved: resolvedFilter === 'all' ? undefined : resolvedFilter === 'resolved',
        errorType: errorTypeFilter === 'all' ? undefined : errorTypeFilter,
        caseNumber: caseNumberFilter || undefined,
        limit: 1000, // Load more for client-side filtering
        offset: 0,
      });

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error Loading Errors",
          description: result.error,
        });
        setErrors([]);
        setAllErrors([]);
      } else if (result.data) {
        setAllErrors(result.data);
        // Filter and paginate client-side
        applyFiltersAndPagination(result.data);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load sync errors. Please try again.",
      });
      setErrors([]);
      setAllErrors([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [resolvedFilter, errorTypeFilter, caseNumberFilter, toast]);

  const applyFiltersAndPagination = useCallback((data: DocumentSyncError[]) => {
    // Apply search filter
    let filtered = data;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(error => {
        return (
          error.documentName?.toLowerCase().includes(searchLower) ||
          error.caseNumber?.toLowerCase().includes(searchLower) ||
          error.error.toLowerCase().includes(searchLower) ||
          error.documentID.toString().includes(searchTerm) ||
          error.saDocType?.toLowerCase().includes(searchLower) ||
          error.categoryName?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'syncDate':
          aVal = a.syncDate ? new Date(a.syncDate).getTime() : 0;
          bVal = b.syncDate ? new Date(b.syncDate).getTime() : 0;
          break;
        case 'documentID':
          aVal = a.documentID;
          bVal = b.documentID;
          break;
        case 'errorType':
          aVal = a.errorType;
          bVal = b.errorType;
          break;
        case 'caseNumber':
          aVal = a.caseNumber || '';
          bVal = b.caseNumber || '';
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    setErrors(filtered.slice(startIndex, endIndex));
  }, [searchTerm, sortField, sortDirection, currentPage, rowsPerPage]);

  useEffect(() => {
    if (allErrors.length > 0) {
      applyFiltersAndPagination(allErrors);
    }
  }, [allErrors, applyFiltersAndPagination]);

  const loadStats = useCallback(async () => {
    try {
      const result = await getDocumentSyncErrorStatsAction();
      if (result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  useEffect(() => {
    loadErrors();
    loadStats();
  }, [loadErrors, loadStats]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedErrors(new Set());
  }, [searchTerm, resolvedFilter, errorTypeFilter, caseNumberFilter, sortField, sortDirection]);

  const filteredCount = useCallback(() => {
    if (!searchTerm) return allErrors.length;
    const searchLower = searchTerm.toLowerCase();
    return allErrors.filter(error => {
      return (
        error.documentName?.toLowerCase().includes(searchLower) ||
        error.caseNumber?.toLowerCase().includes(searchLower) ||
        error.error.toLowerCase().includes(searchLower) ||
        error.documentID.toString().includes(searchTerm) ||
        error.saDocType?.toLowerCase().includes(searchLower) ||
        error.categoryName?.toLowerCase().includes(searchLower)
      );
    }).length;
  }, [allErrors, searchTerm]);

  const totalPages = Math.ceil(filteredCount() / rowsPerPage);

  const handleLoadDocument = async (error?: DocumentSyncError) => {
    const targetError = error || selectedError;
    if (!targetError) return;

    setIsLoadingDocument(true);
    setDocumentDataUri(null);
    setDocumentContentType(null);
    setDocumentLoadError(null);
    setShowDocumentViewer(false);
    
    try {
      const result = await getDocumentContentAction(targetError.documentID);
      if (result.error) {
        const errorMsg = result.error;
        setDocumentLoadError(errorMsg);
        toast({
          variant: "destructive",
          title: "Error Loading Document",
          description: errorMsg,
        });
      } else if (result.data) {
        // Store content type for proper document type detection
        const contentType = result.data.contentType;
        setDocumentContentType(contentType);
        
        // Use URL if provided (for large documents), otherwise use data URI
        let documentUri = result.data.url || result.data.dataUri;
        
        // If it's a URL (starts with /api/), append auth token for PDF viewer
        if (documentUri.startsWith('/api/') || documentUri.startsWith('http')) {
          // Append token to URL for authentication (PDF viewers can't send headers)
          if (token && documentUri.startsWith('/api/')) {
            const separator = documentUri.includes('?') ? '&' : '?';
            documentUri = `${documentUri}${separator}token=${encodeURIComponent(token)}`;
          }
          setDocumentDataUri(documentUri);
          setDocumentLoadError(null);
          setShowDocumentViewer(true);
          return;
        }
        
        // Otherwise, validate data URI format
        if (documentUri.startsWith('data:')) {
          const dataUriMatch = documentUri.match(/^data:([^;]+);base64,(.+)$/);
          if (!dataUriMatch || !dataUriMatch[2] || dataUriMatch[2].length === 0) {
            const errorMsg = "The document data is invalid or incomplete. The document may be corrupted or empty.";
            setDocumentLoadError(errorMsg);
            toast({
              variant: "destructive",
              title: "Invalid Document Data",
              description: errorMsg,
            });
            return;
          }
        }
        
        setDocumentDataUri(documentUri);
        setDocumentLoadError(null);
        setShowDocumentViewer(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load document. Please try again.';
      setDocumentLoadError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsLoadingDocument(false);
    }
  };

  const handleViewDocument = async (error: DocumentSyncError) => {
    setSelectedError(error);
    setIsResolveDialogOpen(true);
    setResolutionNotes('');
    // Automatically load the document when opening the dialog
    await handleLoadDocument(error);
  };

  const handleResolve = async () => {
    if (!selectedError || !user) return;

    setIsResolving(true);
    try {
      const result = await resolveDocumentSyncErrorAction(
        selectedError.id,
        user.id,
        resolutionNotes || undefined
      );

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error,
        });
      } else {
        toast({
          title: "Error Resolved",
          description: "The error has been marked as resolved.",
        });
        setIsResolveDialogOpen(false);
        setSelectedError(null);
        setResolutionNotes('');
        setDocumentDataUri(null);
        setShowDocumentViewer(false);
        await loadErrors(false);
        await loadStats();
        // Announce to screen readers
        if (statusAnnouncementRef.current) {
          statusAnnouncementRef.current.textContent = 'Error resolved successfully';
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resolve error.",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleBulkResolve = async () => {
    if (selectedErrors.size === 0 || !user) return;

    setIsResolving(true);
    try {
      const errorsToResolve = Array.from(selectedErrors);
      let successCount = 0;
      let failCount = 0;

      for (const errorId of errorsToResolve) {
        try {
          const result = await resolveDocumentSyncErrorAction(
            errorId,
            user.id,
            'Bulk resolved'
          );
          if (!result.error) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      toast({
        title: "Bulk Resolution Complete",
        description: `Successfully resolved ${successCount} error${successCount !== 1 ? 's' : ''}${failCount > 0 ? `. ${failCount} failed.` : '.'}`,
      });

      setSelectedErrors(new Set());
      await loadErrors(false);
      await loadStats();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resolve errors.",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleExport = useCallback(() => {
    const dataToExport = errors.length > 0 ? errors : allErrors;
    if (dataToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No errors to export.",
      });
      return;
    }

    const headers = [
      'Document ID',
      'Document Name',
      'Case Number',
      'Doc Type',
      'Error Type',
      'Error Message',
      'Content Type',
      'Category',
      'Sync Date',
      'Status',
      'Resolved At',
      'Resolved By',
    ];

    const rows = dataToExport.map(error => [
      error.documentID.toString(),
      error.documentName || '',
      error.caseNumber || '',
      error.saDocType || '',
      error.errorType,
      error.error,
      error.contentType || '',
      error.categoryName || '',
      error.syncDate ? new Date(error.syncDate).toLocaleString() : '',
      error.resolved ? 'Resolved' : 'Unresolved',
      error.resolvedAt ? new Date(error.resolvedAt).toLocaleString() : '',
      error.resolvedBy || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sync-errors-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: `Exported ${dataToExport.length} error${dataToExport.length !== 1 ? 's' : ''} to CSV.`,
    });
  }, [errors, allErrors, toast]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedErrors(new Set(errors.filter(e => !e.resolved).map(e => e.id)));
    } else {
      setSelectedErrors(new Set());
    }
  };

  const handleSelectError = (errorId: string, checked: boolean) => {
    setSelectedErrors(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(errorId);
      } else {
        newSet.delete(errorId);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setResolvedFilter('unresolved');
    setErrorTypeFilter('all');
    setCaseNumberFilter('');
    setCurrentPage(1);
    searchInputRef.current?.focus();
  };

  const getErrorTypeBadgeVariant = (errorType: string) => {
    switch (errorType) {
      case 'Unsupported File Type':
        return 'destructive';
      case 'Processing Error':
        return 'default';
      case 'API Error':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getErrorTypeIcon = (errorType: string) => {
    switch (errorType) {
      case 'Unsupported File Type':
        return <FileX className="h-3 w-3" aria-hidden="true" />;
      case 'Processing Error':
        return <AlertCircle className="h-3 w-3" aria-hidden="true" />;
      case 'API Error':
        return <AlertTriangle className="h-3 w-3" aria-hidden="true" />;
      default:
        return <Info className="h-3 w-3" aria-hidden="true" />;
    }
  };

  const activeFiltersCount = [
    resolvedFilter !== 'unresolved',
    errorTypeFilter !== 'all',
    caseNumberFilter !== '',
    searchTerm !== '',
  ].filter(Boolean).length;

  const statsData = stats ? [
    {
      title: "Total Errors",
      value: stats.total.toString(),
      icon: FileX,
      footerText: `${stats.unresolved} unresolved`,
    },
    {
      title: "Unresolved",
      value: stats.unresolved.toString(),
      icon: XCircle,
      footerText: "Requires attention",
    },
    {
      title: "Resolved",
      value: stats.resolved.toString(),
      icon: CheckCircle2,
      footerText: "Fixed",
    },
    {
      title: "Unsupported Files",
      value: (stats.byErrorType['Unsupported File Type'] || 0).toString(),
      icon: AlertTriangle,
      footerText: "File type issues",
    },
  ] : [];

  if (isLoading && !stats) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6" role="main" aria-label="Document Sync Errors">
        <div className="flex items-center justify-center h-64" aria-live="polite" aria-busy="true">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">Loading sync errors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6" role="main" aria-label="Document Sync Errors">
      {/* Screen reader announcements */}
      <div
        ref={statusAnnouncementRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />

      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Sync Errors</h1>
          <p className="text-muted-foreground mt-1">
            View and manage failed document syncs from SmartAdvocate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { loadErrors(false); loadStats(); }}
                  variant="outline"
                  size="sm"
                  aria-label="Refresh error list"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh the error list</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Clear errors menu">
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  if (confirm('Are you sure you want to delete all resolved errors? This action cannot be undone.')) {
                    try {
                      const result = await deleteResolvedDocumentSyncErrorsAction();
                      if (result.error) {
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: result.error,
                        });
                      } else {
                        toast({
                          title: "Success",
                          description: `Deleted ${result.data?.deletedCount || 0} resolved errors.`,
                        });
                        await loadErrors(false);
                        await loadStats();
                      }
                    } catch (error) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to delete resolved errors.",
                      });
                    }
                  }
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Clear Resolved Errors
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  if (confirm('Are you sure you want to delete ALL errors? This action cannot be undone.')) {
                    try {
                      const result = await deleteAllDocumentSyncErrorsAction();
                      if (result.error) {
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: result.error,
                        });
                      } else {
                        toast({
                          title: "Success",
                          description: `Deleted ${result.data?.deletedCount || 0} errors.`,
                        });
                        await loadErrors(false);
                        await loadStats();
                      }
                    } catch (error) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to delete all errors.",
                      });
                    }
                  }
                }}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Clear All Errors
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleExport}
                  variant="outline"
                  size="sm"
                  aria-label="Export errors to CSV"
                  disabled={allErrors.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export errors to CSV file</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Error statistics">
        {statsData.length > 0 ? (
          statsData.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Main Content */}
      <div id="main-content">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="grid gap-2">
              <CardTitle>Sync Errors</CardTitle>
              <CardDescription>
                <span aria-live="polite" aria-atomic="true">
                  {filteredCount()} error{filteredCount() !== 1 ? 's' : ''} shown
                  {stats && ` of ${stats.total} total`}
                  {selectedErrors.size > 0 && ` • ${selectedErrors.size} selected`}
                </span>
              </CardDescription>
            </div>
            {selectedErrors.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleBulkResolve}
                  size="sm"
                  disabled={isResolving}
                  aria-label={`Resolve ${selectedErrors.size} selected error${selectedErrors.size !== 1 ? 's' : ''}`}
                >
                  {isResolving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                  )}
                  Resolve {selectedErrors.size}
                </Button>
                <Button
                  onClick={() => setSelectedErrors(new Set())}
                  variant="outline"
                  size="sm"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="space-y-4 mb-6 pb-4 border-b" role="search" aria-label="Filter errors">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="relative flex-1 min-w-[200px]">
                  <Label htmlFor="search-input" className="sr-only">
                    Search errors
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="search-input"
                      ref={searchInputRef}
                      placeholder="Search by document name, case number, error, or ID..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearchTerm('');
                          searchInputRef.current?.blur();
                        }
                      }}
                      className="pl-9 pr-9"
                      aria-label="Search errors by document name, case number, error message, or document ID"
                      aria-describedby="search-description"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                        onClick={() => {
                          setSearchTerm('');
                          searchInputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <p id="search-description" className="sr-only">
                    Search errors by document name, case number, error message, document ID, document type, or category
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div>
                    <Label htmlFor="status-filter" className="sr-only">
                      Filter by status
                    </Label>
                    <Select
                      value={resolvedFilter}
                      onValueChange={(value) => {
                        setResolvedFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger id="status-filter" className="w-[150px]" aria-label="Filter by resolution status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="unresolved">Unresolved</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="error-type-filter" className="sr-only">
                      Filter by error type
                    </Label>
                    <Select
                      value={errorTypeFilter}
                      onValueChange={(value) => {
                        setErrorTypeFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger id="error-type-filter" className="w-[200px]" aria-label="Filter by error type">
                        <SelectValue placeholder="Error Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Unsupported File Type">Unsupported File Type</SelectItem>
                        <SelectItem value="Processing Error">Processing Error</SelectItem>
                        <SelectItem value="API Error">API Error</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="case-number-filter" className="sr-only">
                      Filter by case number
                    </Label>
                    <Input
                      id="case-number-filter"
                      placeholder="Case Number"
                      value={caseNumberFilter}
                      onChange={(e) => {
                        setCaseNumberFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setCaseNumberFilter('');
                        }
                      }}
                      className="w-[150px]"
                      aria-label="Filter by case number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rows-per-page" className="sr-only">
                      Rows per page
                    </Label>
                    <Select
                      value={rowsPerPage.toString()}
                      onValueChange={(value) => {
                        setRowsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger id="rows-per-page" className="w-[140px]" aria-label="Rows per page">
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

                  {activeFiltersCount > 0 && (
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                      aria-label={`Clear ${activeFiltersCount} active filter${activeFiltersCount !== 1 ? 's' : ''}`}
                    >
                      <X className="h-4 w-4 mr-2" aria-hidden="true" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Filter Chips */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2" role="list" aria-label="Active filters">
                  {resolvedFilter !== 'unresolved' && (
                    <Badge variant="secondary" className="gap-1" role="listitem">
                      Status: {resolvedFilter === 'resolved' ? 'Resolved' : 'All'}
                      <button
                        onClick={() => setResolvedFilter('unresolved')}
                        className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                        aria-label="Remove status filter"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  )}
                  {errorTypeFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1" role="listitem">
                      Type: {errorTypeFilter}
                      <button
                        onClick={() => setErrorTypeFilter('all')}
                        className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                        aria-label="Remove error type filter"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  )}
                  {caseNumberFilter && (
                    <Badge variant="secondary" className="gap-1" role="listitem">
                      Case: {caseNumberFilter}
                      <button
                        onClick={() => setCaseNumberFilter('')}
                        className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                        aria-label="Remove case number filter"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  )}
                  {searchTerm && (
                    <Badge variant="secondary" className="gap-1" role="listitem">
                      Search: {searchTerm}
                      <button
                        onClick={() => setSearchTerm('')}
                        className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                        aria-label="Remove search filter"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-2" aria-live="polite" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : errors.length === 0 ? (
              <div className="text-center py-12" role="status">
                <FileX className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2">No errors found</h3>
                <p className="text-muted-foreground mb-4">
                  {activeFiltersCount > 0
                    ? 'No errors match your current filters. Try adjusting your search criteria.'
                    : 'No sync errors have been recorded yet.'}
                </p>
                {activeFiltersCount > 0 && (
                  <Button onClick={clearFilters} variant="outline" size="sm">
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table ref={tableRef} aria-label="Document sync errors table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedErrors.size === errors.filter(e => !e.resolved).length && errors.filter(e => !e.resolved).length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          aria-label="Select all unresolved errors"
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 -ml-3"
                          onClick={() => handleSort('documentID')}
                          aria-label={`Sort by document ID ${sortField === 'documentID' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                        >
                          Document ID
                          {sortField === 'documentID' && (
                            <span className="ml-1" aria-hidden="true">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 -ml-3"
                          onClick={() => handleSort('caseNumber')}
                          aria-label={`Sort by case number ${sortField === 'caseNumber' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                        >
                          Case Number
                          {sortField === 'caseNumber' && (
                            <span className="ml-1" aria-hidden="true">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Doc Type</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 -ml-3"
                          onClick={() => handleSort('errorType')}
                          aria-label={`Sort by error type ${sortField === 'errorType' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                        >
                          Error Type
                          {sortField === 'errorType' && (
                            <span className="ml-1" aria-hidden="true">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Error Message</TableHead>
                      <TableHead>Content Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 -ml-3"
                          onClick={() => handleSort('syncDate')}
                          aria-label={`Sort by sync date ${sortField === 'syncDate' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                        >
                          Sync Date
                          {sortField === 'syncDate' && (
                            <span className="ml-1" aria-hidden="true">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>View Document</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((error, index) => {
                      const isSelected = selectedErrors.has(error.id);
                      const isUnresolved = !error.resolved;
                      return (
                        <TableRow
                          key={error.id}
                          className={cn(
                            isSelected && 'bg-muted/50',
                            'hover:bg-muted/30 focus-within:bg-muted/30',
                            !isUnresolved && 'opacity-60'
                          )}
                          aria-selected={isSelected}
                        >
                          <TableCell>
                            {isUnresolved ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleSelectError(error.id, e.target.checked)}
                                aria-label={`Select error ${index + 1}: ${error.documentName || `Document ${error.documentID}`}`}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            ) : (
                              <span className="sr-only">Resolved - cannot select</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <span className="font-mono text-sm">{error.documentID}</span>
                          </TableCell>
                          <TableCell>
                            {error.caseNumber ? (
                              <span className="font-medium">{error.caseNumber}</span>
                            ) : (
                              <span className="text-muted-foreground" aria-label="No case number">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[250px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block" title={error.documentName || undefined}>
                                    {error.documentName || (
                                      <span className="text-muted-foreground" aria-label="No document name">N/A</span>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                {error.documentName && (
                                  <TooltipContent>
                                    <p className="max-w-xs">{error.documentName}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            {error.saDocType ? (
                              <Badge variant="outline" className="font-mono text-xs">
                                {error.saDocType}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm" aria-label="No document type">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getErrorTypeBadgeVariant(error.errorType)}
                              className="gap-1"
                            >
                              {getErrorTypeIcon(error.errorType)}
                              {error.errorType}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block text-sm" title={error.error}>
                                    {error.error}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{error.error}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {error.contentType ? (
                              <span className="font-mono text-xs">{error.contentType}</span>
                            ) : (
                              <span aria-label="No content type">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {error.categoryName ? (
                              <div className="flex flex-col">
                                <span className="text-sm">{error.categoryName}</span>
                                {error.subCategoryName && (
                                  <span className="text-xs text-muted-foreground">{error.subCategoryName}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm" aria-label="No category">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {error.syncDate ? (
                              <time dateTime={new Date(error.syncDate).toISOString()}>
                                {new Date(error.syncDate).toLocaleDateString()}
                              </time>
                            ) : (
                              <span className="text-muted-foreground" aria-label="No sync date">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={error.resolved ? "default" : "destructive"}
                              className="gap-1"
                            >
                              {error.resolved ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  <span>Resolved</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3" aria-hidden="true" />
                                  <span>Unresolved</span>
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDocument(error)}
                                    disabled={isLoadingDocument && selectedError?.id === error.id}
                                    aria-label={`View document for ${error.documentName || `Document ${error.documentID}`}`}
                                  >
                                    {isLoadingDocument && selectedError?.id === error.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                                        <span className="sr-only sm:not-sr-only">Loading...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
                                        <span className="sr-only sm:not-sr-only">View</span>
                                      </>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View document</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Actions for error ${index + 1}: ${error.documentName || `Document ${error.documentID}`}`}
                                >
                                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedError(error);
                                    setIsResolveDialogOpen(true);
                                    setResolutionNotes('');
                                  }}
                                  disabled={error.resolved === true}
                                  aria-label={`View details and resolve error for ${error.documentName || `Document ${error.documentID}`}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                                  {error.resolved ? 'View Details' : 'View & Resolve'}
                                </DropdownMenuItem>
                                {!error.resolved && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedError(error);
                                        setIsResolveDialogOpen(true);
                                        setResolutionNotes('');
                                      }}
                                      aria-label={`Quick resolve error for ${error.documentName || `Document ${error.documentID}`}`}
                                    >
                                      <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                                      Quick Resolve
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                className="flex items-center justify-between mt-4 pt-4 border-t"
                aria-label="Pagination"
              >
                <div className="text-sm text-muted-foreground" aria-live="polite">
                  Showing{' '}
                  <span className="font-medium">
                    {(currentPage - 1) * rowsPerPage + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * rowsPerPage, filteredCount())}
                  </span>{' '}
                  of <span className="font-medium">{filteredCount()}</span> errors
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    aria-label="Go to previous page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Previous</span>
                  </Button>
                  <div className="text-sm text-muted-foreground px-2" aria-current="page">
                    Page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Go to next page"
                  >
                    <span className="sr-only sm:not-sr-only">Next</span>
                    <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resolve Dialog */}
      <Dialog 
        open={isResolveDialogOpen} 
        onOpenChange={(open) => {
          setIsResolveDialogOpen(open);
          if (!open) {
            setShowDocumentViewer(false);
            setDocumentDataUri(null);
            setDocumentContentType(null);
            setDocumentLoadError(null);
          }
        }}
      >
        <DialogContent className={cn(
          "max-h-[90vh] overflow-hidden flex flex-col",
          showDocumentViewer ? "sm:max-w-[95vw] w-[95vw] h-[90vh]" : "sm:max-w-[700px]"
        )}>
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
            <DialogDescription>
              {selectedError ? (
                <>
                  Document ID: {selectedError.documentID}
                  {selectedError.caseNumber && ` • Case: ${selectedError.caseNumber}`}
                </>
              ) : (
                'Loading error details...'
              )}
            </DialogDescription>
          </DialogHeader>
          
          {showDocumentViewer ? (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Document Viewer</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDocumentViewer(false);
                    setDocumentDataUri(null);
                    setDocumentContentType(null);
                    setDocumentLoadError(null);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Close Viewer
                </Button>
              </div>
              {documentLoadError ? (
                <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/40">
                  <div className="text-center space-y-4 p-8">
                    <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Document Cannot Be Loaded</h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-md">
                        {documentLoadError}
                      </p>
                    </div>
                  </div>
                </div>
              ) : documentDataUri ? (
                <div className="flex-1 overflow-hidden border rounded-lg" style={{ minHeight: 0, height: '100%' }}>
                  <InvoiceViewer
                    invoiceDataUri={documentDataUri}
                    invoiceId={selectedError?.documentID.toString() || ''}
                    highlightBox={null}
                    hoveredField={null}
                    hoveredConfidence={null}
                    fullWidth={true}
                    contentType={documentContentType || undefined}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/40">
                  <div className="text-center space-y-4 p-8">
                    <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Loading Document...</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        Please wait while we fetch the document content.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-4 overflow-y-auto flex-1" role="region" aria-label="Error details">
            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="detail-document-name" className="text-xs text-muted-foreground">
                    Document Name
                  </Label>
                  <p id="detail-document-name" className="text-sm font-medium mt-1">
                    {selectedError?.documentName || (
                      <span className="text-muted-foreground">Not available</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label htmlFor="detail-case-number" className="text-xs text-muted-foreground">
                    Case Number
                  </Label>
                  <p id="detail-case-number" className="text-sm font-medium mt-1">
                    {selectedError?.caseNumber || (
                      <span className="text-muted-foreground">Not available</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label htmlFor="detail-error-type" className="text-xs text-muted-foreground">
                    Error Type
                  </Label>
                  <div id="detail-error-type" className="mt-1">
                    <Badge variant={getErrorTypeBadgeVariant(selectedError?.errorType || '')} className="gap-1">
                      {selectedError?.errorType && getErrorTypeIcon(selectedError.errorType)}
                      {selectedError?.errorType}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label htmlFor="detail-status" className="text-xs text-muted-foreground">
                    Status
                  </Label>
                  <div id="detail-status" className="mt-1">
                    <Badge variant={selectedError?.resolved === true ? "default" : "destructive"} className="gap-1">
                      {selectedError?.resolved ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>Resolved</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                          <span>Unresolved</span>
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Error Details</h3>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Error Message</AlertTitle>
                <AlertDescription className="mt-2">
                  {selectedError?.error}
                </AlertDescription>
              </Alert>
            </div>

            {/* Document Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Document Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="detail-content-type" className="text-xs text-muted-foreground">
                    Content Type
                  </Label>
                  <p id="detail-content-type" className="text-sm mt-1">
                    {selectedError?.contentType || (
                      <span className="text-muted-foreground">Not available</span>
                    )}
                  </p>
                </div>
                {selectedError?.saDocType && (
                  <div>
                    <Label htmlFor="detail-doc-type" className="text-xs text-muted-foreground">
                      Document Type (SmartAdvocate)
                    </Label>
                    <div id="detail-doc-type" className="text-sm mt-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        {selectedError.saDocType}
                      </Badge>
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="detail-category" className="text-xs text-muted-foreground">
                    Category
                  </Label>
                  <p id="detail-category" className="text-sm mt-1">
                    {selectedError?.categoryName || (
                      <span className="text-muted-foreground">Not available</span>
                    )}
                    {selectedError?.subCategoryName && (
                      <span className="text-muted-foreground"> / {selectedError.subCategoryName}</span>
                    )}
                  </p>
                </div>
                {selectedError?.fileSize && (
                  <div>
                    <Label htmlFor="detail-file-size" className="text-xs text-muted-foreground">
                      File Size
                    </Label>
                    <p id="detail-file-size" className="text-sm mt-1">
                      {(selectedError.fileSize / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SmartAdvocate Metadata */}
            {(selectedError?.saFromContactName ||
              selectedError?.saToContactName ||
              selectedError?.saPriorityName ||
              selectedError?.saDirectionName ||
              selectedError?.saOriginName ||
              selectedError?.saDeliveryName) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">SmartAdvocate Metadata</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedError?.saFromContactName && (
                    <div>
                      <Label htmlFor="detail-from-contact" className="text-xs text-muted-foreground">
                        From Contact
                      </Label>
                      <p id="detail-from-contact" className="text-sm mt-1">
                        {selectedError.saFromContactName}
                      </p>
                    </div>
                  )}
                  {selectedError?.saToContactName && (
                    <div>
                      <Label htmlFor="detail-to-contact" className="text-xs text-muted-foreground">
                        To Contact
                      </Label>
                      <p id="detail-to-contact" className="text-sm mt-1">
                        {selectedError.saToContactName}
                      </p>
                    </div>
                  )}
                  {selectedError?.saPriorityName && (
                    <div>
                      <Label htmlFor="detail-priority" className="text-xs text-muted-foreground">
                        Priority
                      </Label>
                      <p id="detail-priority" className="text-sm mt-1">
                        {selectedError.saPriorityName}
                      </p>
                    </div>
                  )}
                  {selectedError?.saDirectionName && (
                    <div>
                      <Label htmlFor="detail-direction" className="text-xs text-muted-foreground">
                        Direction
                      </Label>
                      <p id="detail-direction" className="text-sm mt-1">
                        {selectedError.saDirectionName}
                      </p>
                    </div>
                  )}
                  {selectedError?.saOriginName && (
                    <div>
                      <Label htmlFor="detail-origin" className="text-xs text-muted-foreground">
                        Origin
                      </Label>
                      <p id="detail-origin" className="text-sm mt-1">
                        {selectedError.saOriginName}
                      </p>
                    </div>
                  )}
                  {selectedError?.saDeliveryName && (
                    <div>
                      <Label htmlFor="detail-delivery" className="text-xs text-muted-foreground">
                        Delivery Method
                      </Label>
                      <p id="detail-delivery" className="text-sm mt-1">
                        {selectedError.saDeliveryName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Information */}
            {(selectedError?.description || selectedError?.comments) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Additional Information</h3>
                {selectedError?.description && (
                  <div>
                    <Label htmlFor="detail-description" className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <p id="detail-description" className="text-sm mt-1">
                      {selectedError.description}
                    </p>
                  </div>
                )}
                {selectedError?.comments && (
                  <div>
                    <Label htmlFor="detail-comments" className="text-xs text-muted-foreground">
                      Comments
                    </Label>
                    <p id="detail-comments" className="text-sm mt-1">
                      {selectedError.comments}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Resolution Section */}
            {!selectedError?.resolved ? (
              <div className="space-y-3">
                <Label htmlFor="resolution-notes" className="text-sm font-semibold">
                  Resolution Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about how this error was resolved..."
                  className="min-h-[100px]"
                  aria-describedby="resolution-notes-description"
                />
                <p id="resolution-notes-description" className="text-xs text-muted-foreground">
                  Optional notes about how this error was resolved or why it occurred.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Resolution Information</h3>
                <div>
                  <Label htmlFor="detail-resolution-notes" className="text-xs text-muted-foreground">
                    Resolution Notes
                  </Label>
                  <p id="detail-resolution-notes" className="text-sm mt-1">
                    {selectedError.resolutionNotes || (
                      <span className="text-muted-foreground italic">No notes provided</span>
                    )}
                  </p>
                </div>
                {selectedError.resolvedAt && (
                  <div>
                    <Label htmlFor="detail-resolved-at" className="text-xs text-muted-foreground">
                      Resolved On
                    </Label>
                    <p id="detail-resolved-at" className="text-sm mt-1">
                      <time dateTime={new Date(selectedError.resolvedAt).toISOString()}>
                        {new Date(selectedError.resolvedAt).toLocaleString()}
                      </time>
                    </p>
                  </div>
                )}
                {selectedError.resolvedBy && (
                  <div>
                    <Label htmlFor="detail-resolved-by" className="text-xs text-muted-foreground">
                      Resolved By
                    </Label>
                    <p id="detail-resolved-by" className="text-sm mt-1">
                      User ID: {selectedError.resolvedBy}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Timestamps */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold text-foreground">Timestamps</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
                {selectedError?.createdDate && (
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    <time dateTime={new Date(selectedError.createdDate).toISOString()}>
                      {new Date(selectedError.createdDate).toLocaleString()}
                    </time>
                  </div>
                )}
                {selectedError?.modifiedDate && (
                  <div>
                    <span className="font-medium">Modified:</span>{' '}
                    <time dateTime={new Date(selectedError.modifiedDate).toISOString()}>
                      {new Date(selectedError.modifiedDate).toLocaleString()}
                    </time>
                  </div>
                )}
                {selectedError?.syncDate && (
                  <div>
                    <span className="font-medium">Synced:</span>{' '}
                    <time dateTime={new Date(selectedError.syncDate).toISOString()}>
                      {new Date(selectedError.syncDate).toLocaleString()}
                    </time>
                  </div>
                )}
                {selectedError?.saDocumentDate && (
                  <div>
                    <span className="font-medium">Document Date:</span>{' '}
                    <time dateTime={new Date(selectedError.saDocumentDate).toISOString()}>
                      {new Date(selectedError.saDocumentDate).toLocaleString()}
                    </time>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
          <DialogFooter>
            {!showDocumentViewer && (
              <Button
                variant="outline"
                onClick={() => handleLoadDocument()}
                disabled={isLoadingDocument || !selectedError}
                aria-label="View document"
              >
                {isLoadingDocument ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
                    View Document
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setIsResolveDialogOpen(false);
                setSelectedError(null);
                setResolutionNotes('');
                setShowDocumentViewer(false);
                setDocumentDataUri(null);
                setDocumentContentType(null);
                setDocumentLoadError(null);
              }}
              aria-label="Close dialog"
            >
              Close
            </Button>
            {!selectedError?.resolved && (
              <Button
                onClick={handleResolve}
                disabled={isResolving}
                aria-label="Mark error as resolved"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                    Mark as Resolved
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
