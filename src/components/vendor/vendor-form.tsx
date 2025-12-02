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
  checkVendorExistsAction 
} from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Plus } from 'lucide-react';
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
}

export function VendorForm({ isOpen, onOpenChange, onSubmit, vendor }: VendorFormProps) {
  const { toast } = useToast();
  const [vendorTypes, setVendorTypes] = useState<Array<{ name: string; description?: string }>>([]);
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([]);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isCheckingVendor, setIsCheckingVendor] = useState(false);
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

  // Load vendor types
  useEffect(() => {
    if (isOpen) {
      loadVendorTypes();
    }
  }, [isOpen]);

  // Auto-populate vendor type when name changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'name' && value.name && value.name.length >= 2 && !vendor) {
        checkVendorAndLoadTypes(value.name);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, vendor]);

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

  const handleFormSubmit = (data: VendorFormData) => {
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

  const vendorTypeOptions = suggestedTypes.length > 0 
    ? suggestedTypes.map(type => ({ value: type, label: type }))
    : vendorTypes.map(type => ({ value: type.name, label: type.name }));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          <DialogDescription>
            {vendor ? "Update the vendor's details below." : "Enter the details for the new vendor."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            {show1099Alert && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>1099 Request Required</AlertTitle>
                <AlertDescription>
                  This vendor is not in your vendor list. Please request a 1099 form for this vendor.
                </AlertDescription>
              </Alert>
            )}
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Global Tech Inc." 
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
                  <FormLabel>Vendor Type</FormLabel>
                  <div className="flex gap-2">
                    <FormControl className="flex-1">
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                        disabled={isCheckingVendor}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            suggestedTypes.length > 1 
                              ? "Select type (multiple found)" 
                              : suggestedTypes.length === 1
                              ? suggestedTypes[0]
                              : "Select vendor type"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {suggestedTypes.length > 0 && (
                            <>
                              {suggestedTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type} {suggestedTypes.length > 1 && '(Previously used)'}
                                </SelectItem>
                              ))}
                              {vendorTypes.filter(t => !suggestedTypes.includes(t.name)).length > 0 && (
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                  Other Types
                                </div>
                              )}
                            </>
                          )}
                          {vendorTypes
                            .filter(t => !suggestedTypes.includes(t.name))
                            .map((type) => (
                              <SelectItem key={type.name} value={type.name}>
                                {type.name}
                                {type.description && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    - {type.description}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          <SelectItem value="__add_new__" className="text-primary">
                            <Plus className="inline h-3 w-3 mr-1" />
                            Add New Type
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {field.value === '__add_new__' && (
                      <Popover open={showNewTypeInput} onOpenChange={setShowNewTypeInput}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="icon">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-2">
                            <Input
                              placeholder="New vendor type name"
                              value={newTypeName}
                              onChange={(e) => setNewTypeName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddNewType();
                                }
                              }}
                            />
                            <Button 
                              type="button" 
                              size="sm" 
                              onClick={handleAddNewType}
                              disabled={!newTypeName.trim()}
                            >
                              Add Type
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {field.value && field.value !== '__add_new__' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        setShowNewTypeInput(true);
                        form.setValue('vendorType', '');
                      }}
                    >
                      Change Type
                    </Button>
                  )}
                  {suggestedTypes.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Multiple types found for this vendor. Please select the appropriate type.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requires1099"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Requires 1099</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Check if this vendor requires a 1099 form
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="vendor@example.com" {...field} />
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
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="(555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, City, State ZIP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                    Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{vendor ? 'Save Changes' : 'Create Vendor'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
