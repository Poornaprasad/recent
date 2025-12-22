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
  lookupContactsAction,
} from '@/lib/actions/index';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, AlertTriangle } from 'lucide-react';
import type { ContactLookupResult } from '@/lib/crm/smartadvocate/types';

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
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<ContactLookupResult[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [contactSearchError, setContactSearchError] = useState<string>('');

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
      // Pre-fill search query with vendor name
      setContactSearchQuery(vendor.name || '');
      // Don't reset vendorType here - let loadPreviousType handle it
    }
  }, [vendor, open]);

  // Search for vendor contact using CRM lookup API
  const searchContacts = async (searchQuery: string) => {
    if (!searchQuery || !searchQuery.trim()) {
      setContactSearchResults([]);
      return;
    }

    setIsSearchingContacts(true);
    setContactSearchError('');
    
    try {
      const trimmedName = searchQuery.trim();
      let params: { name?: string; firstName?: string; lastName?: string } = {};

      // Check if it looks like a company name (contains LLC, Inc, Corp, etc. or has a comma)
      const isCompanyName = /(LLC|Inc|Corp|Ltd|Company|Co\.|,)/i.test(trimmedName);
      
      if (isCompanyName) {
        // For company names, use the name parameter directly
        params.name = trimmedName;
      } else {
        // For person names, try to split into first/last
        const nameParts = trimmedName.split(/\s+/);
        if (nameParts.length === 1) {
          params.name = nameParts[0];
        } else if (nameParts.length >= 2) {
          params.firstName = nameParts[0];
          params.lastName = nameParts.slice(1).join(' ');
        }
      }

      // First, try the full search
      let result = await lookupContactsAction({
        ...params,
        rowLimit: 50,
      });

      let results: ContactLookupResult[] = [];
      let searchError = '';

      if (result.error) {
        searchError = result.error;
      } else if (result.data) {
        results = result.data;
      }

      // If no results and it's a company name, try without company suffix for partial matching
      if (results.length === 0 && isCompanyName) {
        // Remove common company suffixes and try again
        const nameWithoutSuffix = trimmedName
          .replace(/,\s*(Inc|LLC|Corp|Ltd|Company|Co\.?|Incorporated|Corporation)\s*\.?$/i, '')
          .replace(/\s+(Inc|LLC|Corp|Ltd|Company|Co\.?|Incorporated|Corporation)\s*\.?$/i, '')
          .trim();

        if (nameWithoutSuffix && nameWithoutSuffix !== trimmedName) {
          console.log('Trying fallback search with:', nameWithoutSuffix);
          // Try searching with the name without suffix
          const fallbackResult = await lookupContactsAction({
            name: nameWithoutSuffix,
            rowLimit: 50,
          });

          if (fallbackResult.error) {
            // If fallback also has error, use original error or generic message
            if (!searchError) {
              searchError = fallbackResult.error;
            }
          } else if (fallbackResult.data && fallbackResult.data.length > 0) {
            results = fallbackResult.data;
            searchError = ''; // Clear error if we found results
            console.log('Fallback search found', results.length, 'results');
          } else if (!searchError) {
            searchError = 'No contacts found matching this name.';
          }
        } else if (!searchError) {
          searchError = 'No contacts found matching this name.';
        }
      } else if (results.length === 0 && !searchError) {
        searchError = 'No contacts found matching this name.';
      }

      setContactSearchResults(results);
      setContactSearchError(searchError);
    } catch (error) {
      console.error('Error searching contacts:', error);
      setContactSearchError('Failed to search contacts. Please try again.');
      setContactSearchResults([]);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleSelectContact = (contact: ContactLookupResult) => {
    // Auto-fill form fields from selected contact
    if (contact.email) {
      setEmail(contact.email);
    }
    if (contact.phone) {
      setPhone(contact.phone);
    }
    if (contact.address) {
      setAddress(contact.address);
    }
    // Close lookup dialog
    setIsLookupOpen(false);
    toast({
      title: 'Contact Selected',
      description: 'Vendor information has been auto-filled from CRM.',
    });
  };

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
            Vendor "{vendor?.name}" needs to be added to your vendor list before this invoice can be processed.
          </DialogDescription>
        </DialogHeader>
        
        {/* Lookup Vendor Button - Very visible */}
        <div className="flex justify-center items-center py-3 px-4 bg-muted/50 rounded-md border border-dashed">
          <Button
            variant="default"
            size="default"
            onClick={() => {
              setIsLookupOpen(true);
              if (vendor?.name) {
                searchContacts(vendor.name);
              }
            }}
            className="w-full"
          >
            <Search className="h-4 w-4 mr-2" />
            Lookup Vendor in CRM
          </Button>
        </div>
        
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

      {/* Vendor Lookup Dialog */}
      <Dialog open={isLookupOpen} onOpenChange={setIsLookupOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Lookup Vendor in CRM</DialogTitle>
            <DialogDescription>
              Search for vendor contacts in SmartAdvocate CRM to auto-fill vendor information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchContacts(contactSearchQuery);
                  }
                }}
                placeholder="Search by name, first name, or last name..."
                className="flex-1"
              />
              <Button
                onClick={() => searchContacts(contactSearchQuery)}
                disabled={isSearchingContacts || !contactSearchQuery.trim()}
              >
                {isSearchingContacts ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Error Message */}
            {contactSearchError && (
              <div className="flex items-start gap-2 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{contactSearchError}</p>
              </div>
            )}

            {/* Search Results */}
            {contactSearchResults.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                <Label className="text-sm font-medium">Select a contact:</Label>
                <div className="space-y-1">
                  {contactSearchResults.map((contact, index) => {
                    const contactName = contact.name || (contact.firstName && contact.lastName 
                      ? `${contact.firstName} ${contact.lastName}`.trim() 
                      : contact.firstName || contact.lastName || 'Unknown');
                    
                    const uniqueKey = `contact-${contact.contactId || 'unknown'}-${index}-${contactName}`;
                    
                    return (
                      <div
                        key={uniqueKey}
                        className="p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectContact(contact)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{contactName}</div>
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {contact.contactType && (
                                <div>Type: {contact.contactType}</div>
                              )}
                              {contact.email && (
                                <div>Email: {contact.email}</div>
                              )}
                              {contact.phone && (
                                <div>Phone: {contact.phone}</div>
                              )}
                              {contact.address && (
                                <div>Address: {contact.address}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLookupOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
