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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { getVendorsAction, deleteVendorAction, syncVendorTypesFromCrmAction } from "@/lib/actions";
import type { Vendor as DomainVendor } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { getStatusBadgeClass } from "@/lib/status-utils";
import { useState, useEffect } from "react";
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

export default function VendorsPage() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<DomainVendor[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<DomainVendor | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<DomainVendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Vendor Management</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSyncVendorTypes} disabled={isSyncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Vendor Types from CRM'}
            </Button>
            <Button onClick={handleAddVendor}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Vendor
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Vendors</CardTitle>
            <CardDescription>
              A list of all vendors in your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading vendors...</div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No vendors found. Add your first vendor to get started.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>1099</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>
                        {vendor.vendorType ? (
                          <Badge variant="outline">{vendor.vendorType}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{vendor.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(getStatusBadgeClass(vendor.status))}>
                          {vendor.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {vendor.requires1099 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            1099 Required
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleEditVendor(vendor)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDeleteVendor(vendor)} className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              This action cannot be undone. This will permanently delete the vendor {vendorToDelete?.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
