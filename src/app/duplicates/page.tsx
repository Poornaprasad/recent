'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import type { StoredInvoice } from '@/lib/domain/types';
import { encodeId } from "@/lib/utils/id-utils";
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
import Link from "next/link";
import { Eye, AlertTriangle, AlertCircle, Copy, MapPin } from "lucide-react";
import { getInvoicesAction } from '@/lib/actions/index';
import { 
  useStateFilter, 
  STATE_OPTIONS, 
  type StateFilterValue,
  getEffectiveStateFilter,
  shouldShowStateFilter,
  getStateOptionsForUser,
  getStateDisplayName
} from "@/hooks/use-state-filter";
import { useAuthStore } from "@/hooks/use-auth-store";

interface DuplicateWithConflict extends StoredInvoice {
  conflictInfo?: {
    hasConflict: boolean;
    approvedInvoices: Array<{
      id: string;
      invoiceNumber?: string;
      caseNumber?: string;
      approvedAt?: Date;
    }>;
  };
}

export default function DuplicatesPage() {
  const { user } = useAuthStore();
  const { selectedState, setSelectedState } = useStateFilter();
  const effectiveStateFilter = getEffectiveStateFilter(user, selectedState);
  const showStateFilter = shouldShowStateFilter(user);
  const stateOptions = getStateOptionsForUser(user);
  const [allInvoices, setAllInvoices] = useState<StoredInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const userPermissions = user ? {
        role: user.role,
        assignedStates: user.assignedStates
      } : undefined;

      const result = await getInvoicesAction(userPermissions);
      if (result.data) {
        setAllInvoices(result.data);
      } else {
        setAllInvoices([]);
      }
    } catch (error) {
      setAllInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Helper to extract string value from ExtractedField
  const extractValue = (field: any): string | null => {
    if (!field) return null;
    if (typeof field === 'string') return field.trim() || null;
    if (typeof field === 'object' && field !== null && 'value' in field) {
      const val = field.value;
      if (typeof val === 'string') return val.trim() || null;
    }
    return null;
  };

  // Filter invoices by effective state filter
  const filteredInvoices = useMemo(() => {
    if (effectiveStateFilter === 'all') {
      return allInvoices;
    }
    return allInvoices.filter(inv => inv.state === effectiveStateFilter);
  }, [allInvoices, effectiveStateFilter]);

  // Get duplicate invoices with conflict info
  const duplicatesWithConflicts = useMemo(() => {
    const duplicateInvoices = filteredInvoices.filter(inv => inv.isDuplicate);

    // Find approved invoices (also filtered by state)
    const approvedInvoices = filteredInvoices.filter(inv =>
      inv.approvalStatus === 'Approved' || (inv.status === 'Pending' && inv.approvalStatus !== 'Rejected')
    );

    // Find conflicts for each duplicate invoice
    const result: DuplicateWithConflict[] = duplicateInvoices.map(duplicate => {
      const duplicateInvoiceNumber = extractValue(duplicate.invoiceNumber);
      const duplicateVendorName = extractValue(duplicate.vendorName);
      const duplicateCaseNumber = duplicate.caseNumber;

      // Find approved invoices that match this duplicate
      const conflictingApproved = approvedInvoices.filter(approved => {
        // Skip if it's the same invoice
        if (approved.id === duplicate.id) return false;

        // Check if same case number
        if (duplicateCaseNumber && approved.caseNumber === duplicateCaseNumber) {
          return true;
        }

        // Check if same invoice number and vendor
        const approvedInvoiceNumber = extractValue(approved.invoiceNumber);
        const approvedVendorName = extractValue(approved.vendorName);

        if (duplicateInvoiceNumber && approvedInvoiceNumber &&
            duplicateInvoiceNumber === approvedInvoiceNumber &&
            duplicateVendorName && approvedVendorName &&
            duplicateVendorName === approvedVendorName) {
          return true;
        }

        return false;
      });

      return {
        ...duplicate,
        conflictInfo: {
          hasConflict: conflictingApproved.length > 0,
          approvedInvoices: conflictingApproved.map(inv => ({
            id: inv.id,
            invoiceNumber: extractValue(inv.invoiceNumber) || undefined,
            caseNumber: inv.caseNumber,
            approvedAt: inv.approvedAt,
          })),
        },
      };
    });

    return result;
  }, [filteredInvoices]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalDuplicates = duplicatesWithConflicts.length;
    const withConflicts = duplicatesWithConflicts.filter(d => d.conflictInfo?.hasConflict).length;
    const noConflicts = totalDuplicates - withConflicts;

    // Footer shows count within filtered state only
    const stateLabel = effectiveStateFilter === 'all' ? '' : ` (${effectiveStateFilter})`;

    return [
      {
        title: "Total Duplicates",
        value: totalDuplicates.toString(),
        icon: Copy,
        footerText: `${totalDuplicates} flagged invoices${stateLabel}`,
      },
      {
        title: "With Conflicts",
        value: withConflicts.toString(),
        icon: AlertCircle,
        footerText: `Have approved matches${stateLabel}`,
      },
      {
        title: "No Conflicts",
        value: noConflicts.toString(),
        icon: AlertTriangle,
        footerText: `Pending review${stateLabel}`,
      },
    ];
  }, [duplicatesWithConflicts, effectiveStateFilter]);

  const handleStateChange = (value: string) => {
    setSelectedState(value as StateFilterValue);
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading duplicates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Duplicates</h2>
            <p className="text-muted-foreground mt-1">
              Review invoices that have been flagged as potential duplicates
            </p>
          </div>
          {!showStateFilter && effectiveStateFilter !== 'all' && (
            <Badge variant="outline" className="text-sm">
              {getStateDisplayName(effectiveStateFilter)}
            </Badge>
          )}
        </div>
        {showStateFilter && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedState} onValueChange={handleStateChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Potential Duplicate Invoices</CardTitle>
          <CardDescription>
            {duplicatesWithConflicts.length > 0
              ? `${duplicatesWithConflicts.length} invoice${duplicatesWithConflicts.length !== 1 ? 's' : ''} flagged as potential duplicates. Please review them to avoid double payment.`
              : 'No potential duplicates found for the selected state.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {duplicatesWithConflicts.length > 0 ? (
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Case Number</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason for Flag</TableHead>
                    <TableHead>Conflict Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicatesWithConflicts.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/invoices/${encodeId(invoice.id)}`}
                            className="text-primary hover:underline"
                          >
                            {invoice.invoiceNumber?.value || invoice.id}
                          </Link>
                        </TableCell>
                        <TableCell>{invoice.vendorName?.value || 'N/A'}</TableCell>
                        <TableCell>
                          {invoice.caseNumber ? (
                            <Badge variant="outline">{invoice.caseNumber}</Badge>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.state ? (
                            <Badge variant="outline">{invoice.state}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{invoice.invoiceDate?.value || 'N/A'}</TableCell>
                        <TableCell>
                            <Badge variant="destructive" className="whitespace-nowrap">
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                {invoice.duplicateReason}
                            </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.conflictInfo?.hasConflict ? (
                            <div className="space-y-1">
                              <Badge variant="destructive" className="whitespace-nowrap">
                                <AlertCircle className="mr-2 h-4 w-4" />
                                Conflict with {invoice.conflictInfo.approvedInvoices.length} approved
                              </Badge>
                              {invoice.conflictInfo.approvedInvoices.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  {invoice.conflictInfo.approvedInvoices.map((conflict) => (
                                    <Link
                                      key={conflict.id}
                                      href={`/invoices/${encodeId(conflict.id)}`}
                                      className="block truncate text-primary hover:underline"
                                    >
                                      {conflict.invoiceNumber || conflict.caseNumber || 'Approved Invoice'}
                                      {conflict.caseNumber && conflict.invoiceNumber && ` (${conflict.caseNumber})`}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="whitespace-nowrap">
                              No Conflict
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm" className="mr-2">
                                <Link href={`/invoices/${encodeId(invoice.id)}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Review
                                </Link>
                            </Button>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
          ) : (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold">No Duplicates Found</h3>
                <p className="text-muted-foreground mt-2">
                  {selectedState === 'all'
                    ? 'There are currently no invoices flagged as duplicates.'
                    : `There are no duplicates for ${selectedState === 'CA' ? 'California' : 'New York'}.`}
                </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
