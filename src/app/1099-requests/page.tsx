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
import { getPendingVendorsAction, completeVendorSetupAction, rejectPendingVendorAction, getPendingVendorByInvoiceIdAction } from '@/lib/actions/index';
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getVendorTypesAction } from '@/lib/actions/index';
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
  const [vendorTypes, setVendorTypes] = useState<Array<{ name: string; description?: string }>>([]);
  const [vendorType, setVendorType] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [requires1099, setRequires1099] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPendingVendors();
    loadVendorTypes();
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

  const loadVendorTypes = async () => {
    try {
      const result = await getVendorTypesAction();
      if (result.data) {
        setVendorTypes(result.data.map(t => ({ name: t.name, description: t.description })));
      }
    } catch (error) {
      console.error('Error loading vendor types:', error);
    }
  };

  const handleCompleteSetup = (vendor: PendingVendor) => {
    setSelectedVendor(vendor);
    setVendorType(vendor.vendorType || '');
    setEmail(vendor.email || '');
    setPhone(vendor.phone || '');
    setAddress(vendor.address || '');
    setRequires1099(true);
    setIsDialogOpen(true);
  };

  const handleSubmitSetup = async () => {
    if (!selectedVendor || !vendorType) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a vendor type.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await completeVendorSetupAction(selectedVendor.id, {
        vendorType,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        requires1099,
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
            <p className="text-muted-foreground">
              Vendors detected during invoice processing that require setup
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

      {/* Complete Setup Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Complete Vendor Setup</DialogTitle>
            <DialogDescription>
              Add vendor type and complete information to add "{selectedVendor?.name}" to your vendor list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendor Type *</Label>
              <Select value={vendorType} onValueChange={setVendorType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent>
                  {vendorTypes.map((type) => (
                    <SelectItem key={type.name} value={type.name}>
                      {type.name}
                      {type.description && (
                        <span className="text-xs text-muted-foreground ml-2">
                          - {type.description}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="vendor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="123 Main St, City, State ZIP"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires1099"
                checked={requires1099}
                onCheckedChange={(checked) => setRequires1099(checked === true)}
              />
              <Label htmlFor="requires1099" className="cursor-pointer">
                Requires 1099 form
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitSetup} disabled={!vendorType || isProcessing}>
              {isProcessing ? 'Processing...' : 'Complete Setup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}





