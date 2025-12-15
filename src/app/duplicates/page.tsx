
'use server';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { findAllInvoices } from "@/lib/repositories/invoice.repository";
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
import { Eye, AlertTriangle, AlertCircle } from "lucide-react";

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

export default async function DuplicatesPage() {
    const allInvoices = await findAllInvoices();
    const duplicateInvoices = allInvoices.filter(inv => inv.isDuplicate);
    
    // Find approved invoices
    const approvedInvoices = allInvoices.filter(inv => 
      inv.approvalStatus === 'Approved' || (inv.status === 'Pending' && inv.approvalStatus !== 'Rejected')
    );
    
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
    
    // Find conflicts for each duplicate invoice
    const duplicatesWithConflicts: DuplicateWithConflict[] = duplicateInvoices.map(duplicate => {
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

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Duplicates</h2>
          <p className="text-muted-foreground mt-1">
            Review invoices that have been flagged as potential duplicates
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Potential Duplicate Invoices</CardTitle>
          <CardDescription>
            These invoices were flagged as potential duplicates. Please review them to avoid double payment.
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
                <p className="text-muted-foreground mt-2">There are currently no invoices flagged as duplicates.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
