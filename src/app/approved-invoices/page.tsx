'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileCheck,
  Search,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  DollarSign,
  Calendar,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from '@/lib/utils/utils';
import { getStatusBadgeClass, getDisplayStatus } from '@/lib/utils/status-utils';
import { getOverallConfidence, formatTotalAmount, parseInvoiceAmount } from '@/lib/utils/invoice-utils';
import Link from "next/link";
import { CircularProgressBadge } from "@/components/invoice/circular-progress-badge";
import { getInvoicesAction } from '@/lib/actions/index';
import type { StoredInvoice } from '@/lib/domain/types';
import { encodeId } from "@/lib/utils/id-utils";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { getDocumentTypeBadgeClass } from "@/lib/utils/document-type-utils";

interface CaseGroup {
  caseNumber: string;
  invoices: StoredInvoice[];
  totalAmount: number;
  invoiceCount: number;
  state?: string;
  clientName?: string;
}

export default function ApprovedInvoicesPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [caseFilter, setCaseFilter] = useState<string>('all');
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
          // Filter for approved invoices: approvalStatus is 'Approved' OR status is 'Pending' (approved invoices)
          const approvedInvoices = result.data.filter(inv => 
            inv.approvalStatus === 'Approved' || (inv.status === 'Pending' && inv.approvalStatus !== 'Rejected')
          );
          setInvoices(approvedInvoices);
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

  // Group invoices by case number
  const invoicesByCase = useMemo(() => {
    const grouped = new Map<string, StoredInvoice[]>();
    const noCase: StoredInvoice[] = [];

    invoices.forEach(inv => {
      if (inv.caseNumber) {
        if (!grouped.has(inv.caseNumber)) {
          grouped.set(inv.caseNumber, []);
        }
        grouped.get(inv.caseNumber)!.push(inv);
      } else {
        noCase.push(inv);
      }
    });

    return { grouped, noCase };
  }, [invoices]);

  // Create case groups with metadata
  const caseGroups = useMemo(() => {
    const groups: CaseGroup[] = [];

    // Add grouped cases
    invoicesByCase.grouped.forEach((caseInvoices, caseNumber) => {
      const totalAmount = caseInvoices.reduce((sum, inv) => {
        const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
        return sum + (amount || 0);
      }, 0);

      const state = caseInvoices[0]?.state;
      const clientName = caseInvoices[0]?.clientName?.value || caseInvoices[0]?.customerName?.value;

      groups.push({
        caseNumber,
        invoices: caseInvoices,
        totalAmount,
        invoiceCount: caseInvoices.length,
        state,
        clientName,
      });
    });

    // Add invoices without case numbers as a separate group
    if (invoicesByCase.noCase.length > 0) {
      const totalAmount = invoicesByCase.noCase.reduce((sum, inv) => {
        const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
        return sum + (amount || 0);
      }, 0);

      groups.push({
        caseNumber: 'No Case Number',
        invoices: invoicesByCase.noCase,
        totalAmount,
        invoiceCount: invoicesByCase.noCase.length,
      });
    }

    // Sort by case number (No Case Number at the end)
    return groups.sort((a, b) => {
      if (a.caseNumber === 'No Case Number') return 1;
      if (b.caseNumber === 'No Case Number') return -1;
      return a.caseNumber.localeCompare(b.caseNumber);
    });
  }, [invoicesByCase]);

  // Filter case groups
  const filteredCaseGroups = useMemo(() => {
    let filtered = caseGroups;

    // State filter
    if (stateFilter !== 'all') {
      filtered = filtered.filter(group => group.state === stateFilter);
    }

    // Case filter
    if (caseFilter !== 'all') {
      filtered = filtered.filter(group => group.caseNumber === caseFilter);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(group => {
        // Search in case number
        if (group.caseNumber.toLowerCase().includes(searchLower)) return true;
        // Search in client name
        if (group.clientName?.toLowerCase().includes(searchLower)) return true;
        // Search in invoices
        return group.invoices.some(inv =>
          (inv.invoiceNumber?.value || '').toLowerCase().includes(searchLower) ||
          (inv.vendorName?.value || '').toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [caseGroups, stateFilter, caseFilter, searchTerm]);

  // Get unique case numbers for filter
  const uniqueCases = useMemo(() => {
    return caseGroups
      .filter(g => g.caseNumber !== 'No Case Number')
      .map(g => g.caseNumber)
      .sort();
  }, [caseGroups]);

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

  // Calculate totals
  const totals = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => {
      const amount = parseInvoiceAmount(inv.totalAmount?.value || inv.amount?.value);
      return sum + (amount || 0);
    }, 0);
    const totalCases = caseGroups.filter(g => g.caseNumber !== 'No Case Number').length;

    return { totalInvoices, totalAmount, totalCases };
  }, [invoices, caseGroups]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading approved invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Approved Invoices</h2>
          <p className="text-muted-foreground mt-1">
            Approved invoices organized by case number
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {filteredCaseGroups.length} case{filteredCaseGroups.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatTotalAmount(totals.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Across all approved invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cases with Invoices</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalCases}</div>
            <p className="text-xs text-muted-foreground">
              {invoicesByCase.noCase.length > 0 && `${invoicesByCase.noCase.length} without case number`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="grid gap-2">
            <CardTitle>Invoices by Case Number</CardTitle>
            <CardDescription>
              {filteredCaseGroups.length} case{filteredCaseGroups.length !== 1 ? 's' : ''} with approved invoices
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cases, invoices, vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {availableStates.length > 0 && (
              <Select value={stateFilter} onValueChange={setStateFilter}>
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
            {uniqueCases.length > 0 && (
              <Select value={caseFilter} onValueChange={setCaseFilter}>
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
          </div>

          {filteredCaseGroups.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold">No Approved Invoices</h3>
              <p className="text-muted-foreground mt-2">
                {invoices.length === 0 
                  ? "There are currently no approved invoices."
                  : "No cases match your current filters."}
              </p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {filteredCaseGroups.map((group) => {
                const isNoCase = group.caseNumber === 'No Case Number';
                
                return (
                  <AccordionItem key={group.caseNumber} value={group.caseNumber}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          {isNoCase ? (
                            <Layers className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <FileCheck className="h-5 w-5 text-primary" />
                          )}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {isNoCase ? 'No Case Number' : `Case ${group.caseNumber}`}
                              </span>
                              {group.state && (
                                <Badge variant="outline" className="text-xs">
                                  {group.state}
                                </Badge>
                              )}
                            </div>
                            {group.clientName && (
                              <p className="text-sm text-muted-foreground">
                                {group.clientName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{group.invoiceCount} invoice{group.invoiceCount !== 1 ? 's' : ''}</span>
                          <span className="font-semibold text-foreground">
                            ${formatTotalAmount(group.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Vendor</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-center">Accuracy</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.invoices.map((invoice) => {
                              const confidence = getOverallConfidence(invoice);
                              const amount = parseInvoiceAmount(invoice.totalAmount?.value || invoice.amount?.value);

                              return (
                                <TableRow key={invoice.id}>
                                  <TableCell className="font-medium">
                                    <Link
                                      href={`/invoices/${encodeId(invoice.id)}?source=approved-invoices`}
                                      className="text-primary hover:underline"
                                    >
                                      {invoice.invoiceNumber?.value || invoice.id}
                                    </Link>
                                  </TableCell>
                                  <TableCell>{invoice.vendorName?.value || 'N/A'}</TableCell>
                                  <TableCell>{invoice.invoiceDate?.value || 'N/A'}</TableCell>
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
                                  <TableCell className="text-right font-semibold">
                                    ${formatTotalAmount(amount)}
                                  </TableCell>
                                  <TableCell className="flex justify-center">
                                    <CircularProgressBadge score={confidence} />
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
                                      <Link href={`/invoices/${encodeId(invoice.id)}?source=approved-invoices`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                      </Link>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

