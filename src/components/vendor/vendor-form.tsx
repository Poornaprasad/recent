'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Vendor as DomainVendor } from '@/lib/domain/types';
import { useEffect, useState } from 'react';
import { 
  getVendorTypesAction, 
  getSuggestedVendorTypesAction,
  checkVendorExistsAction,
  fetchDisbursementTypesAction,
  getPreviousDisbursementTypeForVendorAction,
  saveDisbursementTypeMappingAction,
} from '@/lib/actions/index';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Plus, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const vendorFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  vendorType: z.string().optional(),
  requires1099: z.boolean().optional(),
  status: z.enum(['Active', 'Inactive']),
});

type VendorFormData = z.infer<typeof vendorFormSchema>;

interface VendorFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: DomainVendor) => void;
  vendor: DomainVendor | null;
  caseNumber?: string; // Optional case number for fetching disbursement types
}

export function VendorForm({ isOpen, onOpenChange, onSubmit, vendor, caseNumber }: VendorFormProps) {
  const { toast } = useToast();
  const [vendorTypes, setVendorTypes] = useState<Array<{ name: string; description?: string }>>([]);
  const [disbursementTypes, setDisbursementTypes] = useState<string[]>([]);
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([]);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isCheckingVendor, setIsCheckingVendor] = useState(false);
  const [isLoadingDisbursementTypes, setIsLoadingDisbursementTypes] = useState(false);
  const [show1099Alert, setShow1099Alert] = useState(false);

  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      vendorType: '',
      requires1099: false,
      status: 'Active',
    },
  });

  // Load disbursement types (common across all cases)
  useEffect(() => {
    if (isOpen) {
      // Always load disbursement types from API (common across cases)
      loadDisbursementTypes();
      // Also load traditional vendor types as fallback
      loadVendorTypes();
    }
  }, [isOpen]);

  // Auto-populate vendor type when name changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'name' && value.name && value.name.length >= 2 && !vendor) {
        checkVendorAndLoadTypes(value.name);
        // Also try to load previous disbursement type for this vendor
        loadPreviousDisbursementTypeForName(value.name);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, vendor]);

  const loadPreviousDisbursementTypeForName = async (vendorName: string) => {
    try {
      const result = await getPreviousDisbursementTypeForVendorAction(vendorName);
      if (result.data) {
        form.setValue('vendorType', result.data);
      }
    } catch (error) {
      console.error('Error loading previous disbursement type:', error);
    }
  };

  // Load previous disbursement type when vendor name is available
  useEffect(() => {
    if (vendor?.name) {
      loadPreviousDisbursementType();
    }
  }, [vendor]);

  const loadPreviousDisbursementType = async () => {
    if (!vendor?.name) return;
    
    try {
      const result = await getPreviousDisbursementTypeForVendorAction(vendor.name);
      if (result.data) {
        form.setValue('vendorType', result.data);
      }
    } catch (error) {
      console.error('Error loading previous disbursement type:', error);
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

  const loadDisbursementTypes = async () => {
    setIsLoadingDisbursementTypes(true);
    try {
      const result = await fetchDisbursementTypesAction();
      if (result.data) {
        setDisbursementTypes(result.data);
      } else if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to load disbursement types',
        });
      }
    } catch (error) {
      console.error('Error loading disbursement types:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load disbursement types from API',
      });
    } finally {
      setIsLoadingDisbursementTypes(false);
    }
  };

  const checkVendorAndLoadTypes = async (vendorName: string) => {
    setIsCheckingVendor(true);
    try {
      // Check if vendor exists
      const vendorCheck = await checkVendorExistsAction(vendorName);
      if (!vendorCheck.exists) {
        setShow1099Alert(true);
      } else {
        setShow1099Alert(false);
        if (vendorCheck.requires1099) {
          form.setValue('requires1099', true);
        }
      }

      // Get suggested types for this vendor name
      const typesResult = await getSuggestedVendorTypesAction(vendorName);
      if (typesResult.data && typesResult.data.length > 0) {
        setSuggestedTypes(typesResult.data);
        // Auto-populate if only one type
        if (typesResult.data.length === 1) {
          form.setValue('vendorType', typesResult.data[0]);
        }
      } else {
        setSuggestedTypes([]);
      }
    } catch (error) {
      console.error('Error checking vendor:', error);
    } finally {
      setIsCheckingVendor(false);
    }
  };

  useEffect(() => {
    if (vendor) {
      form.reset({
        name: vendor.name,
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        vendorType: vendor.vendorType || '',
        requires1099: vendor.requires1099 || false,
        status: vendor.status,
      });
      if (vendor.vendorType) {
        setSuggestedTypes([vendor.vendorType]);
      }
      setShow1099Alert(vendor.requires1099 || false);
    } else {
      form.reset({
        name: '',
        email: '',
        phone: '',
        address: '',
        vendorType: '',
        requires1099: false,
        status: 'Active',
      });
      setSuggestedTypes([]);
      setShow1099Alert(false);
    }
  }, [vendor, form, isOpen]);

  const handleFormSubmit = async (data: VendorFormData) => {
    // Save the disbursement type mapping if we have case number and type is provided
    // Note: Type is optional for new vendors since it varies by case
    if (caseNumber && data.vendorType && data.name) {
      try {
        await saveDisbursementTypeMappingAction(
          caseNumber,
          data.name,
          data.vendorType
        );
      } catch (error) {
        console.error('Error saving disbursement type mapping:', error);
        // Continue even if saving mapping fails
      }
    }

    const vendorData: DomainVendor = {
      id: vendor?.id || `vendor-${Date.now()}`,
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      vendorType: data.vendorType || undefined,
      requires1099: data.requires1099 || false,
      status: data.status,
      createdAt: vendor?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    onSubmit(vendorData);
  };

  const handleAddNewType = async () => {
    if (!newTypeName.trim()) return;
    
    // Add to local list temporarily (will be saved to DB when vendor is saved)
    const newType = { name: newTypeName.trim(), description: '' };
    setVendorTypes([...vendorTypes, newType]);
    form.setValue('vendorType', newTypeName.trim());
    setNewTypeName('');
    setShowNewTypeInput(false);
    
    toast({
      title: 'Vendor Type Added',
      description: 'The new vendor type will be saved when you create the vendor.',
    });
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{vendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          <DialogDescription>
            {vendor ? "Update the vendor's details below." : "Enter the details for the new vendor. All fields marked with * are required."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
            {show1099Alert && (
              <Alert variant="destructive" className="border-destructive/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>W9 Request Required</AlertTitle>
                <AlertDescription>
                  This vendor is not in your vendor list. Please request a W9 form for this vendor.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Vendor Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Global Tech Inc." 
                          className="h-10"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            if (!vendor && e.target.value.length >= 2) {
                              checkVendorAndLoadTypes(e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vendorType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Disbursement Type</FormLabel>
                      {!vendor && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Optional - Selection varies by case. Previous selection for this vendor will be pre-filled if available.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <FormControl className="flex-1">
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || ''}
                            disabled={isCheckingVendor || isLoadingDisbursementTypes}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder={
                                isLoadingDisbursementTypes
                                  ? "Loading types..."
                                  : disbursementTypes.length === 0
                                  ? "No types available"
                                  : !vendor
                                  ? "Select disbursement type (optional)"
                                  : "Select disbursement type"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingDisbursementTypes ? (
                                <div className="flex items-center justify-center p-4">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : disbursementTypes.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">
                                  No disbursement types available
                                </div>
                              ) : (
                                <>
                                  {!vendor && (
                                    <SelectItem value="">None (Optional)</SelectItem>
                                  )}
                                  {disbursementTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </div>
                      {caseNumber && field.value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          This selection will be remembered for future disbursements in case {caseNumber}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Status <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Contact Information</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="vendor@example.com" 
                            className="h-10"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(555) 123-4567" 
                            className="h-10"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="123 Main St, City, State ZIP" 
                          className="h-10"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Tax & Compliance</h3>
                
                <FormField
                  control={form.control}
                  name="requires1099"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-semibold">
                          Requires W9 Form
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Check this box if this vendor requires a W9 form for tax reporting purposes. This will flag the vendor for W9 processing.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                type="submit"
                className="min-w-[120px]"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {vendor ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  vendor ? 'Save Changes' : 'Create Vendor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
