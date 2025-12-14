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
import { AlertTriangle, CheckCircle, XCircle, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { getPendingVendorsAction, completeVendorSetupAction, rejectPendingVendorAction, getInvoiceByIdAction } from "@/lib/actions/index";
import { VendorSetupDialog } from "@/components/dialogs/vendor-setup-dialog";
import type { PendingVendor } from "@/lib/domain/types";
import Link from "next/link";
import { encodeId } from "@/lib/utils/id-utils";

export default function PendingVendorsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [pendingVendors, setPendingVendors] = useState<PendingVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<PendingVendor | null>(null);
  const [caseNumber, setCaseNumber] = useState<string | undefined>(undefined);
  const [invoiceId, setInvoiceId] = useState<string | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPendingVendors();
  }, []);

  const loadPendingVendors = async () => {
    setIsLoading(true);
    try {
      const result = await getPendingVendorsAction();
      if (result.data) {
        setPendingVendors(result.data);
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
        description: 'Failed to load pending vendors.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSetup = async (vendor: PendingVendor) => {
    setSelectedVendor(vendor);
    
    // Try to fetch invoice to get case number
    if (vendor.invoiceId) {
      try {
        const invoiceResult = await getInvoiceByIdAction(vendor.invoiceId);
        if (invoiceResult.data) {
          setCaseNumber(invoiceResult.data.caseNumber);
          setInvoiceId(invoiceResult.data.id);
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
      }
    }
    
    setIsDialogOpen(true);
  };

  const handleSubmitSetup = async (data: {
    vendorType: string;
    email: string;
    phone: string;
    address: string;
    requires1099: boolean;
  }) => {
    if (!selectedVendor) return;

    setIsProcessing(true);
    try {
      const result = await completeVendorSetupAction(selectedVendor.id, {
        vendorType: data.vendorType,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        requires1099: data.requires1099,
      });

      if (result.success) {
        toast({
          title: 'Vendor Setup Completed',
          description: 'The vendor has been added to your vendor list.',
        });
        setIsDialogOpen(false);
        await loadPendingVendors();
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to complete vendor setup.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to complete vendor setup.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (vendor: PendingVendor) => {
    if (!confirm(`Are you sure you want to reject vendor "${vendor.name}"?`)) {
      return;
    }

    try {
      const result = await rejectPendingVendorAction(vendor.id);
      if (result.success) {
        toast({
          title: 'Vendor Rejected',
          description: 'The pending vendor has been rejected.',
        });
        await loadPendingVendors();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to reject vendor.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to reject vendor.',
      });
    }
  };

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">1099 Requests</h2>
            <p className="text-muted-foreground mt-1">
              Vendors detected during invoice processing that require setup and 1099 handling
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Pending Vendor Setup</CardTitle>
            <CardDescription>
              These vendors were detected during invoice processing and need to be added to your vendor list before invoices can be processed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading pending vendors...</div>
            ) : pendingVendors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No pending vendors. All vendors are set up!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>
                        {vendor.invoiceId ? (
                          <Link 
                            href={`/invoices/${encodeId(vendor.invoiceId)}`}
                            className="text-primary hover:underline"
                          >
                            View Invoice
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{vendor.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">
                          {vendor.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {vendor.invoiceId && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link href={`/invoices/${encodeId(vendor.invoiceId)}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleCompleteSetup(vendor)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete Setup
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(vendor)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <VendorSetupDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setCaseNumber(undefined);
            setInvoiceId(undefined);
          }
        }}
        vendor={selectedVendor}
        caseNumber={caseNumber}
        invoiceId={invoiceId}
        isProcessing={isProcessing}
        onSubmit={handleSubmitSetup}
      />
    </>
  );
}





