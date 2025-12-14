
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
import { Eye, AlertTriangle } from "lucide-react";

export default async function DuplicatesPage() {
    const allInvoices = await findAllInvoices();
    const duplicateInvoices = allInvoices.filter(inv => inv.isDuplicate);

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
          {duplicateInvoices.length > 0 ? (
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason for Flag</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicateInvoices.map((invoice) => (
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
                        <TableCell>{invoice.invoiceDate?.value || 'N/A'}</TableCell>
                        <TableCell>
                            <Badge variant="destructive" className="whitespace-nowrap">
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                {invoice.duplicateReason}
                            </Badge>
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
