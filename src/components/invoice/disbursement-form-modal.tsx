'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/hooks/use-auth-store';
import { Loader2, Search, Building2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StoredInvoice } from '@/lib/domain/types';
import {
  fetchDisbursementTypesAction,
  fetchDisbursementStatusesAction,
  createDisbursementAction,
  lookupContactsAction,
  getCaseContactsAction,
  getCaseInfoAction,
  getPreviousDisbursementTypeForVendorAction,
  updateInvoiceDisbursementResponseAction,
  updateInvoiceCrmStatusAction,
  checkCaseForDuplicatesAction,
  type DuplicateCheckResult,
} from '@/lib/actions/index';
import type { DisbursementOption, ContactLookupResult } from '@/lib/crm/smartadvocate/types';
import { formatCurrency } from '@/lib/utils/invoice-utils';
import { cn } from '@/lib/utils/utils';
import { formatNameFirstLast } from '@/lib/utils/name-matching';

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
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCaseInfo, setIsLoadingCaseInfo] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<DuplicateCheckResult | null>(null);
  const hasAutoCheckedRef = useRef(false);

  // Debug: Log when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('DisbursementFormModal opened for invoice:', invoice?.id, 'Case number:', invoice?.caseNumber);
      // Reset auto-check flag when modal opens
      hasAutoCheckedRef.current = false;
    } else {
      // Reset when modal closes
      hasAutoCheckedRef.current = false;
    }
  }, [isOpen, invoice]);

  // Form fields
  const [caseID, setCaseID] = useState<number | null>(null);
  const [checkNumber, setCheckNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [plaintiffId, setPlaintiffId] = useState<number | null>(null);
  const [plaintiffName, setPlaintiffName] = useState<string>('');
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
  const [isDocumentIDsAutoPopulated, setIsDocumentIDsAutoPopulated] = useState(false);
  const [customField1, setCustomField1] = useState('');

  // Options
  const [disbursementTypes, setDisbursementTypes] = useState<DisbursementOption[]>([]);
  const [disbursementStatuses, setDisbursementStatuses] = useState<DisbursementOption[]>([]);
  const [caseContactResults, setCaseContactResults] = useState<ContactLookupResult[]>([]);
  const [crmContactResults, setCrmContactResults] = useState<ContactLookupResult[]>([]);
  const [contactSearchType, setContactSearchType] = useState<'case' | 'crm'>('case');
  const [caseContactError, setCaseContactError] = useState<string>('');
  const [crmContactError, setCrmContactError] = useState<string>('');

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
      console.log('DisbursementFormModal: Auto-populating fields, invoice.documentID:', invoice.documentID);
      
      // Auto-populate from invoice data
      setInvoiceNumber(invoice.invoiceNumber?.value || '');
      setAmount(String(invoice.amount?.value || invoice.totalAmount?.value || ''));
      setPayeeName(invoice.vendorName?.value || '');
      
      // Auto-populate document ID if available
      if (invoice.documentID !== undefined && invoice.documentID !== null) {
        const docIdStr = String(invoice.documentID);
        console.log('DisbursementFormModal: Setting documentIDs to:', docIdStr);
        setDocumentIDs(docIdStr);
        setIsDocumentIDsAutoPopulated(true); // Mark as auto-populated
      } else {
        console.log('DisbursementFormModal: No documentID found in invoice');
        setDocumentIDs(''); // Reset if no documentID
        setIsDocumentIDsAutoPopulated(false); // Not auto-populated
      }

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
        setPlaintiffName('');
        loadCaseInfo(caseNum.trim()).then(() => {
          // After case info loads, auto-search in case contacts if vendor name exists
          if (invoice.vendorName?.value) {
            setContactSearchType('case');
            // Use setTimeout to ensure caseID state is updated
            setTimeout(() => {
              const vendorName = invoice.vendorName?.value;
              if (vendorName) {
                searchCaseContacts(vendorName);
              }
            }, 100);
          }
        });
      } else {
        console.warn('No case number found in invoice:', invoice);
        setCaseID(null);
        setPlaintiffId(null);
        setPlaintiffName('');
        // If no case number, search in CRM contacts
        if (invoice.vendorName?.value) {
          setContactSearchType('crm');
          searchCrmContacts(invoice.vendorName.value);
        }
      }
    } else {
      // Reset all fields when modal closes
      setInvoiceNumber('');
      setAmount('');
      setPayeeName('');
      setDocumentIDs('');
      setIsDocumentIDsAutoPopulated(false);
      setInvoiceDate('');
      setStatusDate('');
      setCaseID(null);
      setPlaintiffId(null);
      setPlaintiffName('');
      setDisbursementTypeId('');
      setDisbursementStatusId('');
      setPayeeContactId(null);
      setCheckNumber('');
      setComments('');
      setShareAcrossClients(false);
      setRecoverable(true);
      setWaived(false);
      setIsLienor(false);
      setCustomField1('');
      setCaseContactResults([]);
      setCrmContactResults([]);
      setCaseContactError('');
      setCrmContactError('');
      setContactSearchType('case');
    }
  }, [isOpen, invoice, invoice?.documentID]);

  // Auto-populate comments with invoice number/plaintiff name/case number
  useEffect(() => {
    if (isOpen) {
      const invNum = invoiceNumber || invoice.invoiceNumber?.value || '';
      const caseNum = invoice.caseNumber || '';
      // Convert plaintiff name from "Last, First" to "First Last" format
      const plaintiff = plaintiffName ? formatNameFirstLast(plaintiffName) : '';
      
      // Build comment string with available values
      const parts: string[] = [];
      if (invNum) parts.push(invNum);
      if (plaintiff) parts.push(plaintiff);
      if (caseNum) parts.push(caseNum);
      
      if (parts.length > 0) {
        const commentValue = parts.join('/');
        setComments(commentValue);
      }
    }
  }, [isOpen, invoiceNumber, invoice.invoiceNumber?.value, invoice.caseNumber, plaintiffName]);

  // Auto-trigger duplicate check when modal opens and all required fields are available
  useEffect(() => {
    if (
      isOpen && 
      caseID && 
      payeeName && 
      invoiceNumber && 
      invoiceDate && 
      !isCheckingDuplicates && 
      !hasAutoCheckedRef.current
    ) {
      // Only trigger once when all required fields are present
      console.log('Auto-triggering duplicate check on modal open');
      hasAutoCheckedRef.current = true;
      handleCheckDuplicates();
    }
  }, [isOpen, caseID, payeeName, invoiceNumber, invoiceDate, isCheckingDuplicates]);

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
    setPlaintiffName(''); // Reset plaintiff name
    
    try {
      const result = await getCaseInfoAction(caseNumber.trim());
      console.log('Case info result:', result);
      
      if (result.data) {
        console.log('Case data received, caseID:', result.data.caseID);
        setCaseID(result.data.caseID);
        
        // Get primary plaintiff ID and name
        if (result.data.plaintiffs && result.data.plaintiffs.length > 0) {
          const primaryPlaintiff = result.data.plaintiffs.find(p => p.primary) || result.data.plaintiffs[0];
          if (primaryPlaintiff) {
            if (primaryPlaintiff.id) {
              console.log('Plaintiff ID found:', primaryPlaintiff.id);
              setPlaintiffId(primaryPlaintiff.id);
            }
            if (primaryPlaintiff.name) {
              console.log('Plaintiff name found:', primaryPlaintiff.name);
              setPlaintiffName(primaryPlaintiff.name);
            }
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

  // Helper function to match vendor name with contact
  const matchContactName = (contact: ContactLookupResult, vendorName: string): boolean => {
    const vendorNameLower = vendorName.toLowerCase().trim();
    const contactName = (contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim()).toLowerCase();
    
    // Exact match
    if (contactName === vendorNameLower) {
      return true;
    }
    
    // Check if vendor name contains contact name or vice versa
    if (contactName.includes(vendorNameLower) || vendorNameLower.includes(contactName)) {
      return true;
    }
    
    // For person names, check first and last name separately
    if (contact.firstName && contact.lastName) {
      const firstNameLower = contact.firstName.toLowerCase();
      const lastNameLower = contact.lastName.toLowerCase();
      const vendorParts = vendorNameLower.split(/\s+/);
      
      // Check if all vendor name parts match contact name parts
      if (vendorParts.every(part => firstNameLower.includes(part) || lastNameLower.includes(part) || contactName.includes(part))) {
        return true;
      }
    }
    
    return false;
  };

  // Helper function to filter and sort contacts by address
  const filterContactsByAddress = (
    contacts: ContactLookupResult[],
    vendorAddress: string
  ): ContactLookupResult[] => {
    if (!vendorAddress || !vendorAddress.trim()) {
      return contacts;
    }

    const addressLower = vendorAddress.toLowerCase();
    const exactMatches: ContactLookupResult[] = [];
    const partialMatches: ContactLookupResult[] = [];
    const noAddressMatches: ContactLookupResult[] = [];

    contacts.forEach(contact => {
      const contactAddress = (contact.address || '').toLowerCase();

      if (!contactAddress) {
        noAddressMatches.push(contact);
      } else if (contactAddress === addressLower || contactAddress.includes(addressLower) || addressLower.includes(contactAddress)) {
        exactMatches.push(contact);
      } else {
        // Check for partial match (e.g., city, state, zip)
        const addressWords = addressLower.split(/\s+/).filter((w: string) => w.length > 2);
        const contactWords = contactAddress.split(/\s+/).filter((w: string) => w.length > 2);
        const hasCommonWords = addressWords.some((word: string) => contactWords.includes(word));

        if (hasCommonWords) {
          partialMatches.push(contact);
        } else {
          noAddressMatches.push(contact);
        }
      }
    });

    return [...exactMatches, ...partialMatches, ...noAddressMatches];
  };

  // Search case contacts
  const searchCaseContacts = async (vendorName: string) => {
    if (!vendorName || !vendorName.trim()) {
      setCaseContactResults([]);
      setCaseContactError('');
      return;
    }

    if (!caseID) {
      setCaseContactError('Case ID is required to search case contacts');
      setCaseContactResults([]);
      return;
    }

    setIsLoadingContacts(true);
    setCaseContactError('');

    try {
      const trimmedName = vendorName.trim();
      console.log(`Searching case contacts for caseID: ${caseID}, vendor: ${trimmedName}`);

      const caseContactsResult = await getCaseContactsAction(caseID);

      if (caseContactsResult.error) {
        setCaseContactError(caseContactsResult.error);
        setCaseContactResults([]);
      } else if (caseContactsResult.data && caseContactsResult.data.length > 0) {
        // Filter contacts by vendor name
        const matchingContacts = caseContactsResult.data.filter(contact => matchContactName(contact, trimmedName));

        if (matchingContacts.length > 0) {
          // Filter by address if available
          const vendorAddress = invoice.vendorAddress?.value || '';
          const filteredResults = filterContactsByAddress(matchingContacts, vendorAddress);
          setCaseContactResults(filteredResults);
        } else {
          setCaseContactResults([]);
          setCaseContactError('No matching contacts found in case');
        }
      } else {
        setCaseContactResults([]);
        setCaseContactError('No contacts found in case');
      }
    } catch (error) {
      console.error('Error searching case contacts:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to search case contacts';
      setCaseContactError(errorMsg);
      setCaseContactResults([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Search CRM contacts
  const searchCrmContacts = async (vendorName: string) => {
    if (!vendorName || !vendorName.trim()) {
      setCrmContactResults([]);
      setCrmContactError('');
      return;
    }

    setIsLoadingContacts(true);
    setCrmContactError('');

    try {
      const trimmedName = vendorName.trim();
      const params: { name?: string; firstName?: string; lastName?: string } = {};

      // Check if it looks like a company name
      const isCompanyName = /(LLC|Inc|Corp|Ltd|Company|Co\.|,)/i.test(trimmedName);

      if (isCompanyName) {
        params.name = trimmedName;
      } else {
        const nameParts = trimmedName.split(/\s+/);
        if (nameParts.length === 1) {
          params.name = nameParts[0];
        } else if (nameParts.length >= 2) {
          params.firstName = nameParts[0];
          params.lastName = nameParts.slice(1).join(' ');
        }
      }

      console.log('Searching CRM contacts with params:', params);
      const result = await lookupContactsAction({
        ...params,
        rowLimit: 50,
      });

      if (result.error) {
        setCrmContactError(result.error);
        setCrmContactResults([]);
      } else if (result.data && result.data.length > 0) {
        // Filter by address if available
        const vendorAddress = invoice.vendorAddress?.value || '';
        const filteredResults = filterContactsByAddress(result.data, vendorAddress);
        setCrmContactResults(filteredResults);
      } else {
        setCrmContactResults([]);
        setCrmContactError('No contacts found matching the search criteria');
      }
    } catch (error) {
      console.error('Error searching CRM contacts:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to search CRM contacts';
      setCrmContactError(errorMsg);
      setCrmContactResults([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Unified search function that searches based on selected tab
  const searchVendorContact = async (vendorName: string) => {
    if (contactSearchType === 'case') {
      await searchCaseContacts(vendorName);
    } else {
      await searchCrmContacts(vendorName);
    }
  };

  // Handle contact selection
  const handleContactSelect = (contact: ContactLookupResult, source: 'case' | 'crm') => {
    setPayeeContactId(contact.contactId);
    const contactName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    setPayeeName(contactName);
    setCaseContactResults([]);
    setCrmContactResults([]);
    setCaseContactError('');
    setCrmContactError('');
    toast({
      title: 'Contact Selected',
      description: `Selected: ${contactName} (from ${source === 'case' ? 'case contacts' : 'CRM contacts'})`,
    });
  };

  // Check for duplicates in case
  const handleCheckDuplicates = async () => {
    if (!caseID) {
      toast({
        variant: 'destructive',
        title: 'Case ID Required',
        description: 'Please ensure the case number is valid and case information is loaded.',
      });
      return;
    }

    if (!payeeName || !invoiceNumber || !invoiceDate) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please provide vendor name, invoice number, and invoice date to check for duplicates.',
      });
      return;
    }

    setIsCheckingDuplicates(true);
    setDuplicateCheckResult(null);

    try {
      const amountValue = amount ? parseFloat(amount) : 0;
      const result = await checkCaseForDuplicatesAction(
        caseID,
        payeeName,
        invoiceNumber,
        invoiceDate,
        amountValue
      );

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data) {
        setDuplicateCheckResult(result.data);
        
        if (result.data.isDuplicate) {
          // Set CRM status to 'Duplicate' when duplicates are found
          // This prevents the invoice from being uploaded to CRM
          try {
            await updateInvoiceCrmStatusAction(invoice.id, 'Duplicate');
          } catch (error) {
            console.error('Failed to update CRM status:', error);
            // Continue even if status update fails
          }
          
          toast({
            variant: 'destructive',
            title: 'Duplicates Found',
            description: result.data.message || `Found ${result.data.duplicates.length} potential duplicate(s). This invoice will not be uploaded to CRM.`,
          });
        } else {
          // Clear duplicate status if no duplicates found
          if (invoice.crmStatus === 'Duplicate') {
            try {
              await updateInvoiceCrmStatusAction(invoice.id, 'Not Found');
            } catch (error) {
              console.error('Failed to update CRM status:', error);
            }
          }
          
          toast({
            title: 'No Duplicates',
            description: result.data.message || 'No duplicates found in this case.',
          });
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Check Duplicates',
        description: error instanceof Error ? error.message : 'An error occurred while checking for duplicates.',
      });
    } finally {
      setIsCheckingDuplicates(false);
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

    // Prevent submission if duplicates were found
    if (duplicateCheckResult?.isDuplicate || invoice.crmStatus === 'Duplicate') {
      toast({
        variant: 'destructive',
        title: 'Cannot Submit Duplicate',
        description: 'This invoice has been identified as a duplicate. Duplicates cannot be uploaded to CRM. Please review the duplicate check results.',
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
      const result = await createDisbursementAction(caseID, disbursementData, user?.id);

      if (result.error) {
        throw new Error(result.error);
      }

      // Save the disbursement response to the invoice
      if (result.data) {
        try {
          await updateInvoiceDisbursementResponseAction(invoice.id, result.data, user?.id);
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

          {/* Check Case for Duplicates Button */}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handleCheckDuplicates}
              disabled={isCheckingDuplicates || !caseID || !payeeName || !invoiceNumber || !invoiceDate}
              className="w-full"
            >
              {isCheckingDuplicates ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking for Duplicates...
                </>
              ) : (
                'Check Case for Duplicates'
              )}
            </Button>
            {duplicateCheckResult && (
              <div className={`mt-2 p-3 rounded border ${
                duplicateCheckResult.isDuplicate 
                  ? 'bg-destructive/10 border-destructive/50' 
                  : duplicateCheckResult.partialMatches && duplicateCheckResult.partialMatches.length > 0
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-300'
              }`}>
                <div className="text-sm font-medium mb-2">
                  {duplicateCheckResult.isDuplicate 
                    ? '⚠️ Exact Duplicates Found' 
                    : duplicateCheckResult.partialMatches && duplicateCheckResult.partialMatches.length > 0
                    ? '⚠️ Partial Matches Found'
                    : '✓ No Duplicates'}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {duplicateCheckResult.message}
                </div>
                {duplicateCheckResult.duplicates.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <div className="text-xs font-medium text-destructive">Exact Duplicates (Vendor, Invoice #, Date match):</div>
                    {duplicateCheckResult.duplicates.map((dup, index) => (
                      <div key={index} className="text-xs bg-background p-2 rounded border border-destructive/30">
                        <div><strong>ID:</strong> {dup.disbursementID || 'N/A'}</div>
                        <div><strong>Invoice #:</strong> {dup.invoiceNumber || 'N/A'}</div>
                        <div><strong>Date:</strong> {dup.invoiceDate || 'N/A'}</div>
                        <div><strong>Vendor:</strong> {dup.payeeName || 'N/A'}</div>
                        {dup.amount && <div><strong>Amount:</strong> {formatCurrency(dup.amount)}</div>}
                        {dup.checkNumber && <div><strong>Check #:</strong> {dup.checkNumber}</div>}
                        {dup.status && <div><strong>Status:</strong> {dup.status}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {duplicateCheckResult.partialMatches && duplicateCheckResult.partialMatches.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-orange-700 dark:text-orange-400">Partial Matches (Vendor & Amount match):</div>
                    {duplicateCheckResult.partialMatches.map((dup, index) => (
                      <div key={index} className="text-xs bg-background p-2 rounded border border-orange-300">
                        <div><strong>ID:</strong> {dup.disbursementID || 'N/A'}</div>
                        <div><strong>Invoice #:</strong> {dup.invoiceNumber || 'N/A'}</div>
                        <div><strong>Date:</strong> {dup.invoiceDate || 'N/A'}</div>
                        <div><strong>Vendor:</strong> {dup.payeeName || 'N/A'}</div>
                        {dup.amount && <div><strong>Amount:</strong> {formatCurrency(dup.amount)}</div>}
                        {dup.checkNumber && <div><strong>Check #:</strong> {dup.checkNumber}</div>}
                        {dup.status && <div><strong>Status:</strong> {dup.status}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payee - Searchable with Case Contacts and CRM Lookup */}
          <div>
            <Label>Payee (Vendor) *</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={payeeName}
                  onChange={(e) => {
                    setPayeeName(e.target.value);
                    // Clear previous results when typing
                    setCaseContactResults([]);
                    setCrmContactResults([]);
                    setCaseContactError('');
                    setCrmContactError('');
                  }}
                  placeholder="Enter vendor name and click search"
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
                  title={`Search in ${contactSearchType === 'case' ? 'Case Contacts' : 'CRM'}`}
                >
                  {isLoadingContacts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Tabs for Case Contacts vs CRM Contacts */}
              <Tabs value={contactSearchType} onValueChange={(value) => {
                setContactSearchType(value as 'case' | 'crm');
                // Clear results when switching tabs
                setCaseContactResults([]);
                setCrmContactResults([]);
                setCaseContactError('');
                setCrmContactError('');
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="case" disabled={!caseID} className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Case Contacts
                    {!caseID && <span className="text-xs text-muted-foreground">(Case ID required)</span>}
                  </TabsTrigger>
                  <TabsTrigger value="crm" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    CRM Contacts
                  </TabsTrigger>
                </TabsList>

                {/* Case Contacts Tab */}
                <TabsContent value="case" className="space-y-2">
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
                          setCaseContactResults([]);
                          setCrmContactResults([]);
                        }}
                        className="h-6 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  )}

                  {caseContactError && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {caseContactError}
                    </div>
                  )}

                  {caseContactResults.length > 0 && (() => {
                    const vendorAddress = invoice.vendorAddress?.value || '';
                    const addressLower = vendorAddress.toLowerCase();
                    
                    return (
                      <div className="mt-2 space-y-1 max-h-64 overflow-y-auto border rounded p-2 bg-muted/30">
                        <Label className="text-xs text-muted-foreground mb-2 block font-medium">
                          Case Contacts ({caseContactResults.length}):
                          {vendorAddress && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Filtered by address: {vendorAddress})
                            </span>
                          )}
                        </Label>
                        {caseContactResults.map((contact, index) => {
                          const contactName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                          const uniqueKey = `case-contact-${contact.contactId || 'unknown'}-${index}-${contactName}`;
                          
                          const contactAddress = (contact.address || '').toLowerCase();
                          const isAddressMatch = vendorAddress && contactAddress && (
                            contactAddress === addressLower || 
                            contactAddress.includes(addressLower) || 
                            addressLower.includes(contactAddress)
                          );
                          
                          let isPartialMatch = false;
                          if (vendorAddress && contactAddress && !isAddressMatch) {
                            const addressWords = addressLower.split(/\s+/).filter((w: string) => w.length > 2);
                            const contactWords = contactAddress.split(/\s+/).filter((w: string) => w.length > 2);
                            isPartialMatch = addressWords.some((word: string) => contactWords.includes(word));
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
                              onClick={() => handleContactSelect(contact, 'case')}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-medium">{contactName}</div>
                                    <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-400">
                                      Case Contact
                                    </Badge>
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
                                    {contact.email && <div>Email: {contact.email}</div>}
                                    {contact.phone && <div>Phone: {contact.phone}</div>}
                                    {contact.contactType && <div>Type: {contact.contactType}</div>}
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
                </TabsContent>

                {/* CRM Contacts Tab */}
                <TabsContent value="crm" className="space-y-2">
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
                          setCaseContactResults([]);
                          setCrmContactResults([]);
                        }}
                        className="h-6 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  )}

                  {crmContactError && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {crmContactError}
                    </div>
                  )}

                  {crmContactResults.length > 0 && (() => {
                    const vendorAddress = invoice.vendorAddress?.value || '';
                    const addressLower = vendorAddress.toLowerCase();
                    
                    return (
                      <div className="mt-2 space-y-1 max-h-64 overflow-y-auto border rounded p-2 bg-muted/30">
                        <Label className="text-xs text-muted-foreground mb-2 block font-medium">
                          CRM Search Results ({crmContactResults.length}):
                          {vendorAddress && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Filtered by address: {vendorAddress})
                            </span>
                          )}
                        </Label>
                        {crmContactResults.map((contact, index) => {
                          const contactName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                          const uniqueKey = `crm-contact-${contact.contactId || 'unknown'}-${index}-${contactName}`;
                          
                          const contactAddress = (contact.address || '').toLowerCase();
                          const isAddressMatch = vendorAddress && contactAddress && (
                            contactAddress === addressLower || 
                            contactAddress.includes(addressLower) || 
                            addressLower.includes(contactAddress)
                          );
                          
                          let isPartialMatch = false;
                          if (vendorAddress && contactAddress && !isAddressMatch) {
                            const addressWords = addressLower.split(/\s+/).filter((w: string) => w.length > 2);
                            const contactWords = contactAddress.split(/\s+/).filter((w: string) => w.length > 2);
                            isPartialMatch = addressWords.some((word: string) => contactWords.includes(word));
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
                              onClick={() => handleContactSelect(contact, 'crm')}
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
                                    {contact.email && <div>Email: {contact.email}</div>}
                                    {contact.phone && <div>Phone: {contact.phone}</div>}
                                    {contact.contactType && <div>Type: {contact.contactType}</div>}
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
                </TabsContent>
              </Tabs>
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
                disabled={isDocumentIDsAutoPopulated}
                title={isDocumentIDsAutoPopulated ? "Document ID is auto-populated and cannot be edited" : undefined}
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

