
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
import { cn } from '@/lib/utils/utils';
import { getStatusBadgeClass } from '@/lib/utils/status-utils';
import { getOverallConfidence } from '@/lib/utils/invoice-utils';
import Link from "next/link";
import { CircularProgressBadge } from "@/components/invoice/circular-progress-badge";
import { Eye, Check, X } from "lucide-react";
import { ApprovalActions } from "./_components/approval-actions";

export default async function ApprovalsPage() {
    const allInvoices = await findAllInvoices();
    const invoicesForReview = allInvoices.filter(inv => inv.status === 'Review');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Approvals</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Invoice Approval Queue</CardTitle>
          <CardDescription>
            Review and approve invoices that were automatically flagged due to low extraction confidence or other issues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesForReview.length > 0 ? (
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Accuracy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesForReview.map((invoice) => {
                    const confidence = getOverallConfidence(invoice);
                    return (
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
                        <TableCell className="flex justify-center">
                          <CircularProgressBadge score={confidence} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(getStatusBadgeClass(invoice.status))}
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <ApprovalActions invoiceId={invoice.id} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
          ) : (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold">Approval Queue is Empty</h3>
                <p className="text-muted-foreground mt-2">There are currently no invoices that require manual approval.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    