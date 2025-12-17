'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { PendingVendor } from '@/lib/domain/types';
import {
  fetchDisbursementTypesAction,
  getPreviousDisbursementTypeForVendorAction,
  saveDisbursementTypeMappingAction,
} from '@/lib/actions/index';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface VendorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: PendingVendor | null;
  caseNumber?: string; // Case number for fetching disbursement types
  invoiceId?: string; // Optional invoice ID for saving mapping
  isProcessing?: boolean;
  onSubmit: (data: {
    vendorType: string;
    email: string;
    phone: string;
    address: string;
    requires1099: boolean;
  }) => Promise<void>;
}

export function VendorSetupDialog({
  open,
  onOpenChange,
  vendor,
  caseNumber,
  invoiceId,
  isProcessing = false,
  onSubmit,
}: VendorSetupDialogProps) {
  const { toast } = useToast();
  const [vendorType, setVendorType] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [requires1099, setRequires1099] = useState(false);
  const [disbursementTypes, setDisbursementTypes] = useState<string[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  // Load disbursement types when dialog opens
  useEffect(() => {
    if (open) {
      loadDisbursementTypes();
      if (vendor?.name) {
        loadPreviousType();
      }
    }
  }, [open, vendor]);

  const loadDisbursementTypes = async () => {
    setIsLoadingTypes(true);
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
      setIsLoadingTypes(false);
    }
  };

  const loadPreviousType = async () => {
    if (!vendor?.name) return;
    
    try {
      const result = await getPreviousDisbursementTypeForVendorAction(vendor.name);
      if (result.data) {
        setVendorType(result.data);
      }
    } catch (error) {
      console.error('Error loading previous disbursement type:', error);
    }
  };

  useEffect(() => {
    if (vendor && open) {
      setEmail(vendor.email || '');
      setPhone(vendor.phone || '');
      setAddress(vendor.address || '');
      setRequires1099(vendor.requires1099 || false);
      // Don't reset vendorType here - let loadPreviousType handle it
    }
  }, [vendor, open]);

  const handleSubmit = async () => {
    // Disbursement type is optional for new vendors
    // Only save mapping if type is provided and we have case number
    if (vendorType && caseNumber && vendor?.name) {
      try {
        await saveDisbursementTypeMappingAction(
          caseNumber,
          vendor.name,
          vendorType,
          invoiceId
        );
      } catch (error) {
        console.error('Error saving disbursement type mapping:', error);
        // Continue even if saving mapping fails
      }
    }

    await onSubmit({
      vendorType,
      email,
      phone,
      address,
      requires1099,
    });

    // Reset form
    setVendorType('');
    setEmail('');
    setPhone('');
    setAddress('');
    setRequires1099(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Vendor Setup</DialogTitle>
          <DialogDescription>
            Add vendor type and complete information to add "{vendor?.name}" to your vendor list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-type">Contact Type</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Optional - Selection varies by case. Previous selection for this vendor will be pre-filled if available.
            </p>
            <Select 
              value={vendorType} 
              onValueChange={setVendorType}
              disabled={isLoadingTypes || disbursementTypes.length === 0}
            >
              <SelectTrigger id="vendor-type">
                <SelectValue 
                  placeholder={
                    isLoadingTypes 
                      ? "Loading types..." 
                      : disbursementTypes.length === 0
                      ? "No types available"
                      : "Select contact type (optional)"
                  } 
                />
              </SelectTrigger>
              <SelectContent>
                {isLoadingTypes ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : disbursementTypes.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No contact types available
                  </div>
                ) : (
                  <>
                    <SelectItem value="">None (Optional)</SelectItem>
                    {disbursementTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {vendorType && caseNumber && (
              <p className="text-xs text-muted-foreground">
                This selection will be remembered for future disbursements in case {caseNumber}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Complete Setup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
