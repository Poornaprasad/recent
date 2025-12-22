'use client';

import {
  Card,
  CardContent,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  DollarSign,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/hooks/use-auth-store";
import { 
  getVendorInvoicesFor1099Action, 
  updateVendor1099StatusAction,
  saveVendorAction,
} from "@/lib/actions/index";
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

type VendorInvoiceGroup = {
  vendorName: string;
  vendor?: {
    id: string;
    name: string;
    form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
    w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
  };
  totalAmount: number;
  isBelowThreshold: boolean;
  invoices: Array<{
    invoice: {
      id: string;
      invoiceNumber?: { value?: string };
      invoiceDate?: { value?: string };
      status: string;
    };
    caseNumber?: string;
    amount: number;
  }>;
  form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
  w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
  canProcessInvoices: boolean;
};

export function Vendor1099RequestsTab() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendorGroups, setVendorGroups] = useState<VendorInvoiceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const toggleVendor = (vendorName: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorName)) {
      newExpanded.delete(vendorName);
    } else {
      newExpanded.add(vendorName);
    }
    setExpandedVendors(newExpanded);
  };

  const handleAddVendor = async (vendorName: string, invoiceId?: string) => {
    setSelectedVendorName(vendorName);
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

  const handleUpdate1099Status = async (
    vendorId: string,
    statusType: 'form1099' | 'w9',
    status: string
  ) => {
    setUpdatingStatus(prev => new Set(prev).add(vendorId));
    try {
      const updateData: {
        form1099Status?: 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
        w9Status?: 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
      } = {};
      
      if (statusType === 'form1099') {
        updateData.form1099Status = status as 'Not Required' | 'Required' | 'Received' | 'Tracked' | 'Pending';
      } else {
        updateData.w9Status = status as 'Not Required' | 'Required' | 'Received' | 'Pending' | 'Expired';
      }

      const result = await updateVendor1099StatusAction(
        vendorId, 
        updateData,
        user?.role,
        user?.id
      );
      if (result.success) {
        toast({
          title: 'Status Updated',
          description: `${statusType === 'form1099' ? '1099' : 'W9'} status has been updated.`,
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

  const getStatusBadge = (status?: string, type: '1099' | 'W9' = '1099') => {
    if (!status || status === 'Not Required') {
      return <Badge variant="outline">Not Required</Badge>;
    }
    if (status === 'Received' || status === 'Tracked') {
      return <Badge className="bg-green-500">{status}</Badge>;
    }
    if (status === 'Required' || status === 'Pending') {
      return <Badge variant="destructive">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <>
      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading vendor invoices...</div>
          </CardContent>
        </Card>
      ) : vendorGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>No vendors requiring 1099 forms.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vendorGroups.map((group) => (
            <Card key={group.vendorName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Collapsible open={expandedVendors.has(group.vendorName)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleVendor(group.vendorName)}
                          className="h-8 w-8 p-0"
                        >
                          {expandedVendors.has(group.vendorName) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </Collapsible>
                    <CardTitle className="text-xl">{group.vendorName}</CardTitle>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total Amount</div>
                      <div className="text-2xl font-bold flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        {group.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* $600 Threshold Warning */}
                  {group.isBelowThreshold && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Below $600 Threshold</AlertTitle>
                      <AlertDescription>
                        Total amount for this vendor is below $600. Monitor before processing payments.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 1099/W9 Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">1099 Form Status</label>
                      {group.vendor?.id ? (
                        <Select
                          value={group.form1099Status || 'Not Required'}
                          onValueChange={(value) => 
                            handleUpdate1099Status(group.vendor!.id, 'form1099', value)
                          }
                          disabled={updatingStatus.has(group.vendor.id)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Required">Not Required</SelectItem>
                            <SelectItem value="Required">Required</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Received">Received</SelectItem>
                            <SelectItem value="Tracked">Tracked</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(group.form1099Status, '1099')
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">W9 Form Status</label>
                      {group.vendor?.id ? (
                        <Select
                          value={group.w9Status || 'Not Required'}
                          onValueChange={(value) => 
                            handleUpdate1099Status(group.vendor!.id, 'w9', value)
                          }
                          disabled={updatingStatus.has(group.vendor.id)}
                        >
                          <SelectTrigger>
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
                      ) : (
                        getStatusBadge(group.w9Status, 'W9')
                      )}
                    </div>
                  </div>

                  {/* Vendor Not in List Alert */}
                  {!group.vendor && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Vendor Not in Vendor List</AlertTitle>
                      <AlertDescription className="flex items-center justify-between">
                        <span>
                          This vendor needs to be added to the vendor list before you can track 1099/W9 forms.
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleAddVendor(group.vendorName, group.invoices[0]?.invoice.id)}
                          className="ml-4"
                        >
                          Add to Vendor List
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Processing Status */}
                  {group.vendor && !group.canProcessInvoices && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Forms Required</AlertTitle>
                      <AlertDescription>
                        Cannot process approved invoices until 1099 or W9 form is marked as Received or Tracked.
                      </AlertDescription>
                    </Alert>
                  )}

                  {group.vendor && group.canProcessInvoices && (
                    <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertTitle className="text-green-800 dark:text-green-200">Ready to Process</AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        Forms are received or tracked. Approved invoices can be processed.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Invoices List */}
                  <Collapsible open={expandedVendors.has(group.vendorName)}>
                    <CollapsibleContent>
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Invoices ({group.invoices.length})</h4>
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
                              <TableRow key={invoice.id}>
                                <TableCell className="font-medium">
                                  {invoice.invoiceNumber?.value || invoice.id.slice(0, 8)}
                                </TableCell>
                                <TableCell>
                                  {invoice.invoiceDate?.value || '-'}
                                </TableCell>
                                <TableCell>
                                  {caseNumber || (
                                    <span className="text-muted-foreground">No Case</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  ${amount.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{invoice.status}</Badge>
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
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VendorSetupDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedVendorName(null);
          }
        }}
        vendor={selectedVendorName ? {
          id: `temp-${selectedVendorName}`,
          name: selectedVendorName,
          status: 'Pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        } : null}
        isProcessing={isProcessing}
        onSubmit={handleSubmitSetup}
      />
    </>
  );
}

