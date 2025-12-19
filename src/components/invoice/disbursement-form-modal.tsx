'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StoredInvoice } from '@/lib/domain/types';
import {
  fetchDisbursementTypesAction,
  fetchDisbursementStatusesAction,
  createDisbursementAction,
  lookupContactsAction,
  getCaseInfoAction,
  getPreviousDisbursementTypeForVendorAction,
  updateInvoiceDisbursementResponseAction,
} from '@/lib/actions/index';
import type { DisbursementOption, ContactLookupResult } from '@/lib/crm/smartadvocate/types';
import { formatCurrency } from '@/lib/utils/invoice-utils';
import { cn } from '@/lib/utils/utils';

interface DisbursementFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: StoredInvoice;
}

export function DisbursementFormModal({
  isOpen,
  onOpenChange,
  invoice,
}: DisbursementFormModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCaseInfo, setIsLoadingCaseInfo] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Debug: Log when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('DisbursementFormModal opened for invoice:', invoice?.id, 'Case number:', invoice?.caseNumber);
    }
  }, [isOpen, invoice]);

  // Form fields
  const [caseID, setCaseID] = useState<number | null>(null);
  const [checkNumber, setCheckNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [plaintiffId, setPlaintiffId] = useState<number | null>(null);
  const [shareAcrossClients, setShareAcrossClients] = useState(false);
  const [recoverable, setRecoverable] = useState(true);
  const [waived, setWaived] = useState(false);
  const [comments, setComments] = useState('');
  const [isLienor, setIsLienor] = useState(false);
  const [disbursementTypeId, setDisbursementTypeId] = useState<string>('');
  const [disbursementStatusId, setDisbursementStatusId] = useState<string>('');
  const [payeeContactId, setPayeeContactId] = useState<number | null>(null);
  const [payeeName, setPayeeName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [statusDate, setStatusDate] = useState('');
  const [documentIDs, setDocumentIDs] = useState<string>('');
  const [customField1, setCustomField1] = useState('');

  // Options
  const [disbursementTypes, setDisbursementTypes] = useState<DisbursementOption[]>([]);
  const [disbursementStatuses, setDisbursementStatuses] = useState<DisbursementOption[]>([]);
  const [contactSearchResults, setContactSearchResults] = useState<ContactLookupResult[]>([]);
  const [isContactSearchOpen, setIsContactSearchOpen] = useState(false);
  const [contactSearchError, setContactSearchError] = useState<string>('');

  // Get default status based on document type
  const getDefaultStatusForDocumentType = (docType: string | undefined): { id: number; description: string } | null => {
    if (!docType) return null;
    const type = docType.toLowerCase();
    if (type === 'invoice') return { id: 1, description: 'Issue Check' };
    if (type === 'receipt') return { id: 3, description: 'Paid' };
    return null;
  };

  // Load disbursement types and statuses on mount
  useEffect(() => {
    if (isOpen) {
      const loadOptions = async () => {
        try {
          const [typesResult, statusesResult] = await Promise.all([
            fetchDisbursementTypesAction(),
            fetchDisbursementStatusesAction(),
          ]);

          if (typesResult.data) {
            setDisbursementTypes(typesResult.data);
            
            // Load previous disbursement type for vendor
            if (invoice.vendorName?.value) {
              try {
                const prevTypeResult = await getPreviousDisbursementTypeForVendorAction(invoice.vendorName.value);
                if (prevTypeResult.data) {
                  // Find the matching type by description
                  const matchingType = typesResult.data.find(
                    t => t.description.toLowerCase() === prevTypeResult.data?.toLowerCase()
                  );
                  if (matchingType) {
                    console.log('Setting previous disbursement type:', matchingType.description);
                    setDisbursementTypeId(String(matchingType.id));
                  }
                }
              } catch (error) {
                console.error('Failed to load previous disbursement type:', error);
              }
            }
          }
          
          if (statusesResult.data) {
            setDisbursementStatuses(statusesResult.data);
            
            // Set default status based on document type
            const defaultStatus = getDefaultStatusForDocumentType(invoice.documentType);
            if (defaultStatus) {
              const matchingStatus = statusesResult.data.find(s => s.id === defaultStatus.id);
              if (matchingStatus) {
                console.log('Setting default disbursement status:', matchingStatus.description);
                setDisbursementStatusId(String(matchingStatus.id));
              }
            }
          }
        } catch (error) {
          console.error('Failed to load disbursement options:', error);
        }
      };

      loadOptions();
    }
  }, [isOpen, invoice.vendorName?.value, invoice.documentType]);

  // Auto-populate fields from invoice when modal opens
  useEffect(() => {
    if (isOpen && invoice) {
      // Auto-populate from invoice data
      setInvoiceNumber(invoice.invoiceNumber?.value || '');
      setAmount(String(invoice.amount?.value || invoice.totalAmount?.value || ''));
      setDescription(invoice.description?.value || '');
      setPayeeName(invoice.vendorName?.value || '');

      // Parse invoice date
      if (invoice.invoiceDate?.value) {
        const invoiceDateValue = invoice.invoiceDate.value;
        const parsedDate = typeof invoiceDateValue === 'string' 
          ? new Date(invoiceDateValue) 
          : invoiceDateValue instanceof Date 
          ? invoiceDateValue 
          : null;
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          setInvoiceDate(parsedDate.toISOString().split('T')[0]);
          // Set status date to now
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          setStatusDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
      } else {
        // Set default status date to now if no invoice date
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setStatusDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      }

      // Load case info IMMEDIATELY if case number exists
      const caseNum = invoice.caseNumber;
      if (caseNum && caseNum.trim()) {
        console.log('Case number found, loading case info:', caseNum);
        // Reset states before loading
        setCaseID(null);
        setPlaintiffId(null);
        loadCaseInfo(caseNum.trim());
      } else {
        console.warn('No case number found in invoice:', invoice);
        setCaseID(null);
        setPlaintiffId(null);
      }

      // Search for vendor contact
      if (invoice.vendorName?.value) {
        searchVendorContact(invoice.vendorName.value);
      }
    }
  }, [isOpen, invoice]);

  // Load case info to get caseID and plaintiff ID
  const loadCaseInfo = async (caseNumber: string) => {
    if (!caseNumber || !caseNumber.trim()) {
      console.warn('loadCaseInfo called with empty case number');
      return;
    }
    
    console.log('Loading case info for case number:', caseNumber);
    setIsLoadingCaseInfo(true);
    setCaseID(null); // Reset case ID
    setPlaintiffId(null); // Reset plaintiff ID
    
    try {
      const result = await getCaseInfoAction(caseNumber.trim());
      console.log('Case info result:', result);
      
      if (result.data) {
        console.log('Case data received, caseID:', result.data.caseID);
        setCaseID(result.data.caseID);
        
        // Get primary plaintiff ID
        if (result.data.plaintiffs && result.data.plaintiffs.length > 0) {
          const primaryPlaintiff = result.data.plaintiffs.find(p => p.primary) || result.data.plaintiffs[0];
          if (primaryPlaintiff && primaryPlaintiff.id) {
            console.log('Plaintiff ID found:', primaryPlaintiff.id);
            setPlaintiffId(primaryPlaintiff.id);
          } else {
            console.warn('No plaintiff ID found in case data');
          }
        } else {
          console.warn('No plaintiffs found in case data');
        }
      } else if (result.error) {
        console.error('Case lookup error:', result.error);
        toast({
          variant: 'destructive',
          title: 'Case Lookup Failed',
          description: result.error,
        });
      }
    } catch (error) {
      console.error('Failed to load case info:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load case information.',
      });
    } finally {
      setIsLoadingCaseInfo(false);
    }
  };

  // Search for vendor contact using CRM lookup API
  const searchVendorContact = async (vendorName: string) => {
    if (!vendorName || !vendorName.trim()) {
      setContactSearchResults([]);
      return;
    }

    setIsLoadingContacts(true);
    setContactSearchError('');
    
    try {
      const trimmedName = vendorName.trim();
      const params: { name?: string; firstName?: string; lastName?: string } = {};

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

      console.log('Searching contacts in CRM with params:', params);
      const result = await lookupContactsAction({
        ...params,
        rowLimit: 50, // Increased limit to avoid missing results
      });

      if (result.error) {
        setContactSearchError(result.error);
        setContactSearchResults([]);
        toast({
          variant: 'destructive',
          title: 'Contact Search Failed',
          description: result.error,
        });
      } else if (result.data && result.data.length > 0) {
        console.log('Found contacts:', result.data.length);
        
        // Get vendor address from invoice for matching
        const vendorAddress = invoice.vendorAddress?.value || '';
        
        // Filter and sort results: prioritize matches by address if available
        let filteredResults = result.data;
        
        if (vendorAddress && vendorAddress.trim()) {
          const addressLower = vendorAddress.toLowerCase();
          
          // Separate results into: exact address match, partial address match, no address match
          const exactMatches: ContactLookupResult[] = [];
          const partialMatches: ContactLookupResult[] = [];
          const noAddressMatches: ContactLookupResult[] = [];
          
          result.data.forEach(contact => {
            const contactAddress = (contact.address || '').toLowerCase();
            
            if (!contactAddress) {
              noAddressMatches.push(contact);
            } else if (contactAddress === addressLower || contactAddress.includes(addressLower) || addressLower.includes(contactAddress)) {
              exactMatches.push(contact);
            } else {
              // Check for partial match (e.g., city, state, zip)
              const addressWords = addressLower.split(/\s+/).filter(w => w.length > 2);
              const contactWords = contactAddress.split(/\s+/).filter(w => w.length > 2);
              const hasCommonWords = addressWords.some(word => contactWords.includes(word));
              
              if (hasCommonWords) {
                partialMatches.push(contact);
              } else {
                noAddressMatches.push(contact);
              }
            }
          });
          
          // Combine: exact matches first, then partial, then no address match
          filteredResults = [...exactMatches, ...partialMatches, ...noAddressMatches];
          
          console.log(`Address matching: ${exactMatches.length} exact, ${partialMatches.length} partial, ${noAddressMatches.length} no match`);
        }
        
        setContactSearchResults(filteredResults);
        
        // Auto-select first match if only one
        if (filteredResults.length === 1) {
          const contact = filteredResults[0];
          setPayeeContactId(contact.contactId);
          const contactName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
          setPayeeName(contactName);
          toast({
            title: 'Contact Found',
            description: `Selected: ${contactName}`,
          });
        } else if (filteredResults.length > 0 && vendorAddress) {
          // If we have address matches, show a toast indicating matches were prioritized
          const addressMatches = filteredResults.filter(c => {
            const contactAddress = (c.address || '').toLowerCase();
            const addressLower = vendorAddress.toLowerCase();
            return contactAddress && (contactAddress === addressLower || contactAddress.includes(addressLower) || addressLower.includes(contactAddress));
          });
          
          if (addressMatches.length > 0) {
            toast({
              title: 'Contacts Found',
              description: `${addressMatches.length} contact(s) matched by address, ${filteredResults.length} total results.`,
            });
          }
        }
      } else {
        setContactSearchResults([]);
        setContactSearchError('No contacts found matching the search criteria.');
      }
    } catch (error) {
      console.error('Failed to search vendor contact:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to search contacts';
      setContactSearchError(errorMsg);
      setContactSearchResults([]);
      toast({
        variant: 'destructive',
        title: 'Search Error',
        description: errorMsg,
      });
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!caseID) {
      toast({
        variant: 'destructive',
        title: 'Case ID Required',
        description: 'Please ensure the case number is valid and case information is loaded.',
      });
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      toast({
        variant: 'destructive',
        title: 'Amount Required',
        description: 'Please enter a valid amount.',
      });
      return;
    }

    if (!disbursementTypeId) {
      toast({
        variant: 'destructive',
        title: 'Disbursement Type Required',
        description: 'Please select a disbursement type.',
      });
      return;
    }

    if (!disbursementStatusId) {
      toast({
        variant: 'destructive',
        title: 'Disbursement Status Required',
        description: 'Please select a disbursement status.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build disbursement payload
      const disbursementData: any = {
        caseID,
        amount: Number(amount),
        recoverable,
        waived,
        shareAcrossClients,
        isLienor,
      };

      // Add optional fields if provided
      if (checkNumber) disbursementData.checkNumber = checkNumber;
      if (invoiceNumber) disbursementData.invoiceNumber = invoiceNumber;
      if (description) disbursementData.description = description;
      if (comments) disbursementData.comments = comments;
      if (invoiceDate) disbursementData.invoiceDate = `${invoiceDate}T00:00:00`;
      if (statusDate) {
        // Convert datetime-local format to ISO string
        const statusDateObj = new Date(statusDate);
        if (!isNaN(statusDateObj.getTime())) {
          disbursementData.statusDate = statusDateObj.toISOString();
        }
      }
      if (customField1) disbursementData.customField1 = customField1;

      // Add client (plaintiff) if available
      if (plaintiffId) {
        disbursementData.client = [
          {
            id: plaintiffId,
            type: 'plaintiff',
          },
        ];
      }

      // Add disbursement type
      if (disbursementTypeId) {
        const selectedType = disbursementTypes.find(t => String(t.id) === disbursementTypeId);
        if (selectedType) {
          disbursementData.disbursementType = {
            id: selectedType.id,
            description: selectedType.description,
          };
        }
      }

      // Add status
      if (disbursementStatusId) {
        const selectedStatus = disbursementStatuses.find(s => String(s.id) === disbursementStatusId);
        if (selectedStatus) {
          disbursementData.status = {
            id: selectedStatus.id,
            description: selectedStatus.description,
          };
        }
      }

      // Add payee if contact ID is available
      if (payeeContactId && payeeName) {
        disbursementData.payee = {
          contactId: payeeContactId,
          name: payeeName,
        };
      }

      // Add document IDs if provided
      if (documentIDs) {
        const docIds = documentIDs.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
        if (docIds.length > 0) {
          disbursementData.documentIDs = docIds;
        }
      }


      // Call API
      const result = await createDisbursementAction(caseID, disbursementData);

      if (result.error) {
        throw new Error(result.error);
      }

      // Save the disbursement response to the invoice
      if (result.data) {
        try {
          await updateInvoiceDisbursementResponseAction(invoice.id, result.data);
        } catch (error) {
          console.error('Failed to save disbursement response:', error);
          // Don't fail the whole operation if saving response fails
        }
      }

      toast({
        title: 'Success',
        description: 'Disbursement has been successfully created in CRM.',
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Create Disbursement',
        description: error instanceof Error ? error.message : 'An error occurred while creating the disbursement.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const disbursementTypeOptions: ComboboxOption[] = disbursementTypes.map(t => ({
    value: String(t.id),
    label: t.description,
    id: t.id,
  }));

  const disbursementStatusOptions: ComboboxOption[] = disbursementStatuses.map(s => ({
    value: String(s.id),
    label: s.description,
    id: s.id,
  }));

  // Safety check - ensure invoice exists
  if (!invoice) {
    console.error('DisbursementFormModal: No invoice provided');
    return null;
  }

  console.log('DisbursementFormModal rendering, isOpen:', isOpen, 'invoice:', invoice.id);
  
  // Force render test - always show if isOpen is true
  if (!isOpen) {
    console.log('Modal is closed, not rendering');
    return null;
  }

  console.log('Modal is open, rendering Dialog component');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Disbursement in CRM</DialogTitle>
          <DialogDescription>
            Review and edit the disbursement details before pushing to SmartAdvocate CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Case ID (read-only, loaded from case number) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Case ID {isLoadingCaseInfo && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
              <Input
                value={caseID || ''}
                disabled
                placeholder="Loading from case number..."
              />
            </div>
            <div>
              <Label>Case Number</Label>
              <Input
                value={invoice?.caseNumber || ''}
                disabled
                placeholder={invoice?.caseNumber ? undefined : "No case number"}
              />
              {!invoice?.caseNumber && (
                <p className="text-xs text-muted-foreground mt-1">
                  Case number not found in invoice data
                </p>
              )}
            </div>
          </div>

          {/* Invoice Number and Check Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Enter invoice number"
              />
            </div>
            <div>
              <Label>Check Number</Label>
              <Input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Enter check number"
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <Label>Amount *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              rows={3}
            />
          </div>

          {/* Invoice Date */}
          <div>
            <Label>Invoice Date</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          {/* Disbursement Type and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Disbursement Type *</Label>
              <Combobox
                options={disbursementTypeOptions}
                value={disbursementTypeId}
                onValueChange={setDisbursementTypeId}
                placeholder="Select type..."
                searchPlaceholder="Search types..."
                emptyText="No type found."
              />
            </div>
            <div>
              <Label>Disbursement Status *</Label>
              <Combobox
                options={disbursementStatusOptions}
                value={disbursementStatusId}
                onValueChange={setDisbursementStatusId}
                placeholder="Select status..."
                searchPlaceholder="Search statuses..."
                emptyText="No status found."
              />
            </div>
          </div>

          {/* Payee - Searchable with CRM Lookup */}
          <div>
            <Label>Payee (Vendor) *</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={payeeName}
                  onChange={(e) => {
                    setPayeeName(e.target.value);
                    // Clear previous results when typing
                    if (contactSearchResults.length > 0) {
                      setContactSearchResults([]);
                    }
                    setContactSearchError('');
                  }}
                  placeholder="Enter vendor name and click search to lookup in CRM"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && payeeName.trim()) {
                      e.preventDefault();
                      searchVendorContact(payeeName);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (payeeName.trim()) {
                      searchVendorContact(payeeName);
                    } else {
                      toast({
                        variant: 'destructive',
                        title: 'Vendor Name Required',
                        description: 'Please enter a vendor name to search.',
                      });
                    }
                  }}
                  disabled={isLoadingContacts || !payeeName.trim()}
                  title="Search in CRM"
                >
                  {isLoadingContacts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {payeeContactId && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 border-green-300 text-green-700 dark:text-green-400">
                    ✓ Contact ID: {payeeContactId}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPayeeContactId(null);
                      setContactSearchResults([]);
                    }}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              )}

              {contactSearchError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                  {contactSearchError}
                </div>
              )}

              {contactSearchResults.length > 0 && (() => {
                const vendorAddress = invoice.vendorAddress?.value || '';
                const addressLower = vendorAddress.toLowerCase();
                
                return (
                  <div className="mt-2 space-y-1 max-h-64 overflow-y-auto border rounded p-2 bg-muted/30">
                    <Label className="text-xs text-muted-foreground mb-2 block font-medium">
                      CRM Search Results ({contactSearchResults.length}):
                      {vendorAddress && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (Filtered by address: {vendorAddress})
                        </span>
                      )}
                    </Label>
                    {contactSearchResults.map((contact, index) => {
                      const contactName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                      // Use a unique key combining contactId and index to avoid duplicate key errors
                      const uniqueKey = `contact-${contact.contactId || 'unknown'}-${index}-${contactName}`;
                      
                      // Check if address matches
                      const contactAddress = (contact.address || '').toLowerCase();
                      const isAddressMatch = vendorAddress && contactAddress && (
                        contactAddress === addressLower || 
                        contactAddress.includes(addressLower) || 
                        addressLower.includes(contactAddress)
                      );
                      
                      // Check for partial address match
                      let isPartialMatch = false;
                      if (vendorAddress && contactAddress && !isAddressMatch) {
                        const addressWords = addressLower.split(/\s+/).filter(w => w.length > 2);
                        const contactWords = contactAddress.split(/\s+/).filter(w => w.length > 2);
                        isPartialMatch = addressWords.some(word => contactWords.includes(word));
                      }
                      
                      return (
                        <div
                          key={uniqueKey}
                          className={cn(
                            "p-2 border rounded cursor-pointer hover:bg-muted transition-colors",
                            isAddressMatch 
                              ? "bg-green-50 dark:bg-green-900/20 border-green-300" 
                              : isPartialMatch
                              ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300"
                              : "bg-background"
                          )}
                          onClick={() => {
                            setPayeeContactId(contact.contactId);
                            setPayeeName(contactName);
                            setContactSearchResults([]); // Clear results after selection
                            setContactSearchError('');
                            toast({
                              title: 'Contact Selected',
                              description: `Selected: ${contactName} (ID: ${contact.contactId})`,
                            });
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{contactName}</div>
                                {isAddressMatch && (
                                  <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 border-green-400 text-green-700 dark:text-green-400">
                                    ✓ Address Match
                                  </Badge>
                                )}
                                {isPartialMatch && !isAddressMatch && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 text-yellow-700 dark:text-yellow-400">
                                    ~ Partial Address
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <div>Contact ID: {contact.contactId}</div>
                                {contact.address && (
                                  <div className={cn(
                                    isAddressMatch && "font-medium text-green-700 dark:text-green-400",
                                    isPartialMatch && !isAddressMatch && "text-yellow-700 dark:text-yellow-400"
                                  )}>
                                    Address: {contact.address}
                                  </div>
                                )}
                                {contact.email && (
                                  <div>Email: {contact.email}</div>
                                )}
                                {contact.phone && (
                                  <div>Phone: {contact.phone}</div>
                                )}
                                {contact.contactType && (
                                  <div>Type: {contact.contactType}</div>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs ml-2">
                              Select
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Plaintiff ID - Auto-populated from case */}
          <div>
            <Label>Plaintiff ID {isLoadingCaseInfo && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
            <Input
              type="number"
              value={plaintiffId || ''}
              onChange={(e) => setPlaintiffId(e.target.value ? Number(e.target.value) : null)}
              placeholder={isLoadingCaseInfo ? "Loading from case..." : "Auto-populated from case"}
              disabled={isLoadingCaseInfo}
            />
            {!plaintiffId && !isLoadingCaseInfo && invoice.caseNumber && (
              <p className="text-xs text-muted-foreground mt-1">
                No plaintiff found in case. Please enter manually or verify case number.
              </p>
            )}
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="recoverable"
                checked={recoverable}
                onChange={(e) => setRecoverable(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="recoverable" className="cursor-pointer">Recoverable</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="shareAcrossClients"
                checked={shareAcrossClients}
                onChange={(e) => setShareAcrossClients(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="shareAcrossClients" className="cursor-pointer">Share Across Clients</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="waived"
                checked={waived}
                onChange={(e) => setWaived(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="waived" className="cursor-pointer">Waived</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isLienor"
                checked={isLienor}
                onChange={(e) => setIsLienor(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="isLienor" className="cursor-pointer">Is Lienor</Label>
            </div>
          </div>

          {/* Comments */}
          <div>
            <Label>Comments</Label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter comments"
              rows={3}
            />
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Document IDs (comma-separated)</Label>
              <Input
                value={documentIDs}
                onChange={(e) => setDocumentIDs(e.target.value)}
                placeholder="e.g., 3172141"
              />
            </div>
            <div>
              <Label>Status Date</Label>
              <Input
                type="datetime-local"
                value={statusDate}
                onChange={(e) => setStatusDate(e.target.value)}
              />
            </div>
          </div>

          {/* Custom Field */}
          <div>
            <Label>Custom Field 1</Label>
            <Input
              value={customField1}
              onChange={(e) => setCustomField1(e.target.value)}
              placeholder="Custom field"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !caseID || !amount || !disbursementTypeId || !disbursementStatusId}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Pushing to CRM...
              </>
            ) : (
              'Push to CRM'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

