'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { PendingVendor, VendorType } from '@/lib/domain/types';

interface VendorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: PendingVendor | null;
  vendorTypes: VendorType[];
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
  vendorTypes,
  isProcessing = false,
  onSubmit,
}: VendorSetupDialogProps) {
  const [vendorType, setVendorType] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [requires1099, setRequires1099] = useState(false);

  useEffect(() => {
    if (vendor && open) {
      setEmail(vendor.email || '');
      setPhone(vendor.phone || '');
      setAddress(vendor.address || '');
      setRequires1099(vendor.requires1099 || false);
      setVendorType('');
    }
  }, [vendor, open]);

  const handleSubmit = async () => {
    if (!vendorType) return;

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
            <Label htmlFor="vendor-type">Vendor Type *</Label>
            <Select value={vendorType} onValueChange={setVendorType}>
              <SelectTrigger id="vendor-type">
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
          <Button onClick={handleSubmit} disabled={!vendorType || isProcessing}>
            {isProcessing ? 'Processing...' : 'Complete Setup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
