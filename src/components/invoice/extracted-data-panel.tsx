'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfidenceBadge } from '@/components/invoice/confidence-badge';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/utils';
import { Search, Loader2, AlertTriangle, CheckCircle2, Save, X, RotateCcw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { BoundingBox } from '@/lib/utils/bbox-utils';
import type { StoredInvoice, DocumentType } from '@/lib/domain/types';
import {
  fetchDisbursementTypesAction,
  fetchDisbursementStatusesAction,
  getPreviousDisbursementTypeForVendorAction,
  saveDisbursementTypeMappingAction,
  updateInvoiceCaseNumberAction,
  updateInvoicePlaintiffNameAction,
  lookupCaseInfoAction,
  updateInvoiceFieldAction,
  lookupContactsAction,
  retryPlaintiffNameAction,
  getInvoiceByIdAction,
} from '@/lib/actions/index';
import type { ContactLookupResult } from '@/lib/crm/smartadvocate/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/hooks/use-auth-store';
import { getDocumentTypeBadgeClass } from '@/lib/utils/document-type-utils';
import { formatCurrency } from '@/lib/utils/invoice-utils';
import { matchPlaintiffData, type MatchResult, formatNameFirstLast } from '@/lib/utils/name-matching';

const toTitleCase = (str: string) => {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
};

interface DisbursementOption {
  id: number;
  description: string;
}

interface ExtractedDataPanelProps {
  invoiceData: StoredInvoice;
  hoveredField: string | null;
  onFieldHover: (field: string | null, bbox: BoundingBox | null, confidence: number | null) => void;
  onInvoiceUpdate: (updatedInvoice: StoredInvoice) => void;
  onDocumentTypeChange?: (documentType: DocumentType) => void;
  onValidationChange?: (isValid: boolean, missingFields: string[]) => void;
}

// Document types available for selection
const DOCUMENT_TYPES: DocumentType[] = [
  'Invoice',
  'Receipt',
  'Per Diem',
  'Estate',
  'Reimbursement',
  'Office Credit Card Bill',
  'Office Disbursement',
  'Office Reimbursement',
  'Case Details',
  'Webhook Source',
  'Other Document',
  'Other',
];

// Case lookup status
type CaseLookupStatus = 'idle' | 'loading' | 'success' | 'error';

export function ExtractedDataPanel({
  invoiceData,
  hoveredField,
  onFieldHover,
  onInvoiceUpdate,
  onDocumentTypeChange,
  onValidationChange,
}: ExtractedDataPanelProps) {
  const { toast } = useToast();
  const { user } = useAuthStore();

  // Store original extracted field data for reset functionality (includes confidence, bbox, etc.)
  const originalFieldsRef = useRef<Record<string, any>>({});

  // Case number state (not auto-search, requires explicit submit)
  const [caseNumber, setCaseNumber] = useState(invoiceData.caseNumber || '');
  const [isSubmittingCaseNumber, setIsSubmittingCaseNumber] = useState(false);
  const [caseLookupStatus, setCaseLookupStatus] = useState<CaseLookupStatus>('idle');
  const [caseLookupError, setCaseLookupError] = useState<string>('');

  // Plaintiff name state - track both sources SEPARATELY
  // AI Extracted (from document) - this is the original extraction, never changes
  const aiExtractedPlaintiffName = invoiceData.clientName?.value || invoiceData.customerName?.value || '';
  // Case Sourced (from case number lookup) - loaded from database or fetched from SmartAdvocate API
  // Initialize from database if available, otherwise empty
  const [casePlaintiffName, setCasePlaintiffName] = useState<string>(
    invoiceData.plaintiffName || ''
  );

  // Document type state
  const [documentType, setDocumentType] = useState<DocumentType | undefined>(invoiceData.documentType);

  // Disbursement dropdown states
  const [disbursementTypes, setDisbursementTypes] = useState<DisbursementOption[]>([]);
  const [disbursementStatuses, setDisbursementStatuses] = useState<DisbursementOption[]>([]);
  const [selectedDisbursementType, setSelectedDisbursementType] = useState<string>('');
  const [selectedDisbursementStatus, setSelectedDisbursementStatus] = useState<string>('');
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  // Editable fields state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Vendor contact lookup state
  const [isContactLookupOpen, setIsContactLookupOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<ContactLookupResult[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [contactSearchError, setContactSearchError] = useState<string>('');

  // Sync case number state when invoiceData.caseNumber changes from parent
  useEffect(() => {
    const newCaseNumber = invoiceData.caseNumber || '';
    if (newCaseNumber !== caseNumber) {
      setCaseNumber(newCaseNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceData.caseNumber]);

  // Load plaintiff name from database only on initial invoice load
  // This preserves the stored name and doesn't overwrite it unless user explicitly searches
  useEffect(() => {
    const storedPlaintiffName = invoiceData.plaintiffName || '';
    if (storedPlaintiffName && !casePlaintiffName) {
      setCasePlaintiffName(storedPlaintiffName);
    }
    // Only run when invoice ID changes (new invoice loaded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceData.id]);

  // Automatically fetch plaintiff name if case number exists but plaintiff name is missing
  // Use a ref to track if we've already attempted to fetch for this invoice
  const hasAutoFetchedRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const fetchPlaintiffName = async () => {
      const currentCaseNumber = invoiceData.caseNumber?.trim();
      const hasStoredPlaintiffName = invoiceData.plaintiffName && invoiceData.plaintiffName.trim().length > 0;
      const invoiceKey = `${invoiceData.id}-${currentCaseNumber}`;
      
      // Only fetch if:
      // 1. Case number exists
      // 2. No stored plaintiff name
      // 3. We haven't already fetched for this invoice/case combination
      // 4. We're not currently submitting a case number search
      if (
        currentCaseNumber && 
        !hasStoredPlaintiffName && 
        !hasAutoFetchedRef.current.has(invoiceKey) &&
        !isSubmittingCaseNumber &&
        caseLookupStatus !== 'loading'
      ) {
        hasAutoFetchedRef.current.add(invoiceKey);
        
        try {
          setCaseLookupStatus('loading');
          const lookupResult = await lookupCaseInfoAction(currentCaseNumber);
          
          if (lookupResult.error) {
            setCaseLookupStatus('error');
            setCaseLookupError(lookupResult.error);
            // Don't show toast for automatic lookup failures - user can manually search if needed
            return;
          }

          if (lookupResult.data) {
            // Format plaintiff name from "Last, First" to "First Last"
            const formattedName = formatNameFirstLast(lookupResult.data.name);
            setCasePlaintiffName(formattedName);
            setCaseLookupStatus('success');
            
            // Save plaintiff name to database
            const savePlaintiffResult = await updateInvoicePlaintiffNameAction(
              invoiceData.id,
              formattedName,
              user?.id
            );
            
            if (savePlaintiffResult.success) {
              // Update parent component with new plaintiff name
              onInvoiceUpdate({
                ...invoiceData,
                plaintiffName: formattedName,
              });
            }
          }
        } catch (error) {
          console.error('Failed to auto-fetch plaintiff name:', error);
          setCaseLookupStatus('error');
          setCaseLookupError(error instanceof Error ? error.message : 'Failed to fetch plaintiff name');
          // Remove from set so we can retry if needed
          hasAutoFetchedRef.current.delete(invoiceKey);
        }
      }
    };

    fetchPlaintiffName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceData.caseNumber, invoiceData.plaintiffName, invoiceData.id]);

  // Track previous validation state to avoid unnecessary callbacks
  const prevValidationRef = useRef<{ isValid: boolean; missingFields: string[] } | null>(null);

  // Extract case number to a stable value to avoid dependency array issues
  const savedCaseNumber = useMemo(() => invoiceData?.caseNumber || '', [invoiceData?.caseNumber]);

  // Validate mandatory fields and notify parent
  useEffect(() => {
    if (!onValidationChange) return;

    // Don't validate until disbursement options are loaded (to avoid false negatives)
    // But if options are already loaded (arrays have items), proceed with validation
    // Also proceed if loading has completed (both loading states are false)
    const optionsLoaded = disbursementTypes.length > 0 && disbursementStatuses.length > 0;
    const loadingComplete = !isLoadingTypes && !isLoadingStatuses;
    
    // Only skip validation if we're still loading AND options aren't loaded yet
    if (!loadingComplete && !optionsLoaded) {
      return;
    }

    const missingFields: string[] = [];
    
    // Check Document Type
    if (!documentType) {
      missingFields.push('Document Type');
    }
    
    // Check Case Number - use the memoized saved value
    if (!savedCaseNumber.trim()) {
      missingFields.push('Case Number');
    }
    
    // Check Disbursement Type
    if (!selectedDisbursementType) {
      missingFields.push('Disbursement Type');
    }
    
    // Check Disbursement Status
    if (!selectedDisbursementStatus) {
      missingFields.push('Disbursement Status');
    }

    const isValid = missingFields.length === 0;
    
    // Always call callback on first run, then only if validation state changed
    const prevValidation = prevValidationRef.current;
    if (!prevValidation || 
        prevValidation.isValid !== isValid || 
        JSON.stringify(prevValidation.missingFields) !== JSON.stringify(missingFields)) {
      prevValidationRef.current = { isValid, missingFields };
      onValidationChange(isValid, missingFields);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType, savedCaseNumber, selectedDisbursementType, selectedDisbursementStatus, isLoadingTypes, isLoadingStatuses, disbursementTypes.length, disbursementStatuses.length]);

  // Initialize original field data and detect already-edited fields on mount
  useEffect(() => {
    const originals: Record<string, any> = {};
    const alreadyEdited = new Set<string>();

    Object.entries(invoiceData).forEach(([key, value]) => {
      if (value && typeof value === 'object' && 'value' in value) {
        // Store the full field object (value, confidence, bbox, reasoning)
        originals[key] = { ...value };

        // Detect if field was previously edited (has 'User edited' reasoning and no confidence)
        if (value.reasoning === 'User edited' && value.confidence === undefined) {
          alreadyEdited.add(key);
        }
      }
    });

    originalFieldsRef.current = originals;

    // Only set edited fields if there are any already-edited ones from DB
    if (alreadyEdited.size > 0) {
      setEditedFields(alreadyEdited);
    }
  }, []); // Only run once on mount

  // Load disbursement types and statuses on mount
  useEffect(() => {
    const loadDisbursementOptions = async () => {
      setIsLoadingTypes(true);
      setIsLoadingStatuses(true);

      try {
        const [typesResult, statusesResult] = await Promise.all([
          fetchDisbursementTypesAction(),
          fetchDisbursementStatusesAction(),
        ]);

        if (typesResult.data) {
          setDisbursementTypes(typesResult.data);
        }
        if (statusesResult.data) {
          setDisbursementStatuses(statusesResult.data);
          // Set default status based on document type
          const defaultStatus = getDefaultStatusId(invoiceData.documentType);
          if (defaultStatus) {
            setSelectedDisbursementStatus(defaultStatus);
          }
        }
      } catch (error) {
        console.error('Failed to load disbursement options:', error);
      } finally {
        setIsLoadingTypes(false);
        setIsLoadingStatuses(false);
      }
    };

    loadDisbursementOptions();
  }, [invoiceData.documentType]);

  // Load previous disbursement type for vendor
  useEffect(() => {
    const loadPreviousDisbursementType = async () => {
      const vendorName = invoiceData.vendorName?.value;
      if (!vendorName) return;

      try {
        const result = await getPreviousDisbursementTypeForVendorAction(vendorName);
        if (result.data) {
          // Find the matching type by description
          const matchingType = disbursementTypes.find(
            t => t.description.toLowerCase() === result.data?.toLowerCase()
          );
          if (matchingType) {
            setSelectedDisbursementType(String(matchingType.id));
          }
        }
      } catch (error) {
        console.error('Failed to load previous disbursement type:', error);
      }
    };

    if (disbursementTypes.length > 0) {
      loadPreviousDisbursementType();
    }
  }, [invoiceData.vendorName?.value, disbursementTypes]);

  // Get default status ID based on document type
  const getDefaultStatusId = (docType: string | undefined): string => {
    if (!docType) return '';
    const type = docType.toLowerCase();
    if (type === 'invoice') return '1'; // Issue Check
    if (type === 'receipt') return '3'; // Paid
    return '';
  };

  // Handle case number submission - saves case number AND looks up plaintiff info
  const handleCaseNumberSubmit = async () => {
    if (!caseNumber.trim()) {
      toast({
        variant: 'destructive',
        title: 'Case Number Required',
        description: 'Please enter a case number.',
      });
      return;
    }

    setIsSubmittingCaseNumber(true);
    setCaseLookupStatus('loading');
    setCaseLookupError('');
    // Don't clear plaintiff name here - it will be updated when case lookup succeeds

    try {
      // First save the case number to the invoice
      const saveResult = await updateInvoiceCaseNumberAction(invoiceData.id, caseNumber, user?.id);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save case number');
      }

      // Update parent component with new case number
      onInvoiceUpdate({
        ...invoiceData,
        caseNumber: caseNumber.trim(),
      });

      // Then lookup case info from SmartAdvocate API
      const lookupResult = await lookupCaseInfoAction(caseNumber);

      if (lookupResult.error) {
        setCaseLookupStatus('error');
        setCaseLookupError(lookupResult.error);
        toast({
          variant: 'destructive',
          title: 'Case Lookup Failed',
          description: lookupResult.error,
        });
        return;
      }

      if (lookupResult.data) {
        // Format plaintiff name from "Last, First" to "First Last"
        const formattedName = formatNameFirstLast(lookupResult.data.name);
        setCasePlaintiffName(formattedName);
        
        // Save plaintiff name to database
        const savePlaintiffResult = await updateInvoicePlaintiffNameAction(
          invoiceData.id,
          formattedName,
          user?.id
        );
        
        if (savePlaintiffResult.success) {
          // Update parent component with new plaintiff name
          onInvoiceUpdate({
            ...invoiceData,
            plaintiffName: formattedName,
          });
        }
        
        setCaseLookupStatus('success');
        toast({
          title: 'Case Found',
          description: `Plaintiff: ${formattedName}`,
        });
      } else {
        setCaseLookupStatus('error');
        setCaseLookupError('No plaintiff found in case');
        toast({
          variant: 'destructive',
          title: 'Case Lookup Failed',
          description: 'No plaintiff found in case record.',
        });
      }
    } catch (error) {
      setCaseLookupStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Failed to lookup case';
      setCaseLookupError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Case Lookup Failed',
        description: errorMsg,
      });
    } finally {
      setIsSubmittingCaseNumber(false);
    }
  };

  // Handle document type change
  const handleDocumentTypeChange = (newType: DocumentType) => {
    setDocumentType(newType);
    onDocumentTypeChange?.(newType);

    // Update default status based on new document type
    const defaultStatus = getDefaultStatusId(newType);
    if (defaultStatus) {
      setSelectedDisbursementStatus(defaultStatus);
    }
  };

  // Handle disbursement type change and save mapping
  const handleDisbursementTypeChange = async (typeId: string) => {
    setSelectedDisbursementType(typeId);

    const vendorName = invoiceData.vendorName?.value;
    if (vendorName && caseNumber && typeId) {
      const selectedType = disbursementTypes.find(t => String(t.id) === typeId);
      if (selectedType) {
        try {
          await saveDisbursementTypeMappingAction(
            caseNumber,
            vendorName,
            selectedType.description,
            invoiceData.id
          );
        } catch (error) {
          console.error('Failed to save disbursement type mapping:', error);
        }
      }
    }
  };

  // Validate and set bounding box for hover
  const validateAndSetBbox = useCallback((bbox: any, key: string, confidence?: number) => {
    if (bbox && Array.isArray(bbox) && bbox.length >= 4) {
      const isValid = bbox.every((p: any) =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        !isNaN(p.x) &&
        !isNaN(p.y)
      );
      if (isValid) {
        onFieldHover(key, bbox, confidence || null);
      }
    }
  }, [onFieldHover]);

  // Handle field edit
  const handleStartEdit = (key: string, currentValue: string) => {
    setEditingField(key);
    setEditedValues(prev => ({ ...prev, [key]: currentValue }));
  };

  // Handle save field - persists to database
  const handleSaveField = async (key: string) => {
    setIsSaving(true);
    try {
      const fieldValue = editedValues[key];
      const originalField = originalFieldsRef.current[key];
      const originalValue = originalField?.value !== undefined ? String(originalField.value) : '';

      // Save to database
      const result = await updateInvoiceFieldAction(invoiceData.id, key, fieldValue, true, user?.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save field');
      }

      // Update local state
      const updatedInvoice = { ...invoiceData };
      if (updatedInvoice[key as keyof StoredInvoice]) {
        (updatedInvoice as any)[key] = {
          ...(updatedInvoice as any)[key],
          value: fieldValue,
          confidence: undefined, // Remove confidence for edited fields
          reasoning: 'User edited',
        };
      }

      // Track that this field was edited (if value changed from original)
      if (fieldValue !== originalValue) {
        setEditedFields(prev => new Set(prev).add(key));
      }

      onInvoiceUpdate(updatedInvoice);
      setEditingField(null);

      toast({
        title: 'Field Saved',
        description: `${toTitleCase(key)} has been saved to database.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save field.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingField(null);
  };

  // Handle reset to original extracted value - persists to database
  const handleResetField = async (key: string) => {
    const originalField = originalFieldsRef.current[key];
    if (!originalField) return;

    const originalValue = originalField.value !== undefined ? String(originalField.value) : '';

    setIsSaving(true);
    try {
      // Save original value to database (mark as not user-edited)
      const result = await updateInvoiceFieldAction(invoiceData.id, key, originalValue, false, user?.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to reset field');
      }

      // Create updated invoice data with FULL original field restored (including confidence, bbox)
      const updatedInvoice = { ...invoiceData };

      if (updatedInvoice[key as keyof StoredInvoice]) {
        // Restore the complete original field with confidence, bbox, reasoning, etc.
        (updatedInvoice as any)[key] = { ...originalField };
      }

      // Remove from edited fields set
      setEditedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });

      onInvoiceUpdate(updatedInvoice);

      toast({
        title: 'Field Reset',
        description: `${toTitleCase(key)} has been reset to extracted value.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Failed to reset field.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Convert disbursement options to combobox format
  const typeOptions: ComboboxOption[] = disbursementTypes.map(t => ({
    value: String(t.id),
    label: t.description,
    id: t.id,
  }));

  const statusOptions: ComboboxOption[] = disbursementStatuses.map(s => ({
    value: String(s.id),
    label: s.description,
    id: s.id,
  }));

  // Plaintiff name comparison using fuzzy matching
  const hasAiExtractedName = aiExtractedPlaintiffName.trim().length > 0;
  const hasCaseName = casePlaintiffName.trim().length > 0;
  const caseSearchSuccessful = caseLookupStatus === 'success';
  const bothNamesPresent = hasAiExtractedName && hasCaseName && caseSearchSuccessful;

  // Use the name matching utility for comparison (handles permutations and email)
  const matchResult: MatchResult = bothNamesPresent
    ? matchPlaintiffData(aiExtractedPlaintiffName, casePlaintiffName)
    : { isMatch: false, matchType: 'none', confidence: 'none' };

  const namesMatch = matchResult.isMatch;

  // Retry plaintiff name extraction state
  const [isRetryingPlaintiffName, setIsRetryingPlaintiffName] = useState(false);

  // Handle retry plaintiff name extraction
  const handleRetryPlaintiffName = async () => {
    if (!casePlaintiffName || !caseSearchSuccessful) {
      toast({
        variant: 'destructive',
        title: 'Case Name Required',
        description: 'Please search for a case number first to get the plaintiff name.',
      });
      return;
    }

    setIsRetryingPlaintiffName(true);
    try {
      const result = await retryPlaintiffNameAction(invoiceData.id, casePlaintiffName);
      
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Retry Failed',
          description: result.error,
        });
      } else if (result.found) {
        toast({
          title: 'Name Found',
          description: `Found "${casePlaintiffName}" in the document. The plaintiff name has been updated.`,
        });
        // Refresh the invoice data to show the updated name
        try {
          const updatedInvoice = await getInvoiceByIdAction(invoiceData.id);
          if (updatedInvoice.data) {
            onInvoiceUpdate(updatedInvoice.data);
          }
        } catch (error) {
          console.error('Failed to refresh invoice data:', error);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Name Not Found',
          description: `Could not find "${casePlaintiffName}" in the document. Please verify the case name is correct.`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to retry plaintiff name extraction',
      });
    } finally {
      setIsRetryingPlaintiffName(false);
    }
  };

  // Handle vendor contact lookup
  const handleVendorContactLookup = async () => {
    const vendorName = invoiceData.vendorName?.value;
    if (!vendorName) {
      toast({
        variant: 'destructive',
        title: 'Vendor Name Required',
        description: 'Please ensure vendor name is extracted from the invoice.',
      });
      return;
    }

    setIsContactLookupOpen(true);
    setContactSearchQuery(vendorName);
    await searchContacts(vendorName);
  };

  const searchContacts = async (query: string) => {
    if (!query.trim()) {
      setContactSearchResults([]);
      return;
    }

    setIsSearchingContacts(true);
    setContactSearchError('');

    try {
      // Try to parse name into first/last name if it contains spaces
      const nameParts = query.trim().split(/\s+/);
      const params: { name?: string; firstName?: string; lastName?: string } = {};

      if (nameParts.length === 1) {
        // Single word - search by name
        params.name = nameParts[0];
      } else if (nameParts.length >= 2) {
        // Multiple words - use first as firstName, rest as lastName
        params.firstName = nameParts[0];
        params.lastName = nameParts.slice(1).join(' ');
      }

      const result = await lookupContactsAction({
        ...params,
        rowLimit: 20,
      });

      if (result.error) {
        setContactSearchError(result.error);
        setContactSearchResults([]);
      } else if (result.data) {
        setContactSearchResults(result.data);
        if (result.data.length === 0) {
          setContactSearchError('No contacts found matching the search criteria.');
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to search contacts';
      setContactSearchError(errorMsg);
      setContactSearchResults([]);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleSelectContact = async (contact: ContactLookupResult) => {
    const contactName = contact.name || (contact.firstName && contact.lastName 
      ? `${contact.firstName} ${contact.lastName}`.trim() 
      : contact.firstName || contact.lastName || '');

    if (!contactName) {
      toast({
        variant: 'destructive',
        title: 'Invalid Contact',
        description: 'Contact does not have a valid name.',
      });
      return;
    }

    // Update the vendor name field with the selected contact name
    setIsSaving(true);
    try {
      const result = await updateInvoiceFieldAction(invoiceData.id, 'vendorName', contactName, true, user?.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update vendor name');
      }

      // Update local state
      const updatedInvoice = { ...invoiceData };
      if (updatedInvoice.vendorName) {
        updatedInvoice.vendorName = {
          ...updatedInvoice.vendorName,
          value: contactName,
          reasoning: 'User selected from CRM',
        };
        // Remove confidence for edited fields
        delete (updatedInvoice.vendorName as any).confidence;
      }

      // Track that this field was edited
      setEditedFields(prev => new Set(prev).add('vendorName'));

      onInvoiceUpdate(updatedInvoice);
      setIsContactLookupOpen(false);
      setContactSearchResults([]);
      setContactSearchQuery('');

      toast({
        title: 'Vendor Name Updated',
        description: `Vendor name updated to "${contactName}" from CRM.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update vendor name.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare fields to render (exclude system fields and special fields handled separately)
  const excludedFields = [
    'id', 'invoiceDataUri', 'status', 'isDuplicate', 'duplicateReason',
    'lineItems', 'documentType', 'isHighValue', 'highValueReason',
    'requiresEscalation', 'escalationLevel', 'escalationReason',
    'caseNumber', 'state', 'approvalStatus', 'approvedBy', 'approvedAt',
    'createdBy', 'assignedTo', 'isRecurring', 'recurringPattern',
    'hasAmountAnomaly', 'amountAnomalyReason', 'expectedAmount',
    'amountDeviationPercent', 'hasMultipleVendors', 'accuracyScore',
    'requiresSpecialHandling', 'specialHandlingReason', 'vendorRequires1099',
    'comment', 'description', 'paymentType', 'clientName', 'customerName', // plaintiff name handled separately
    'totalAmount', 'amount', // amount handled separately in specific position
    'vendorName', // vendor name handled separately with CRM lookup
  ];

  // Dynamically render all fields except excluded ones
  const fieldsToRender = Object.entries(invoiceData)
    .filter(([key, value]) => {
      if (excludedFields.includes(key)) return false;
      if (value === null || value === undefined) return false;
      // Only render fields that have extractedField structure with value
      if (typeof value === 'object' && 'value' in value) return true;
      return false;
    })
    .map(([key, value]) => ({
      key,
      title: toTitleCase(key),
      value: value as { value: any; confidence?: number; bbox?: any; reasoning?: string },
    }));

  // Get amount data for display
  const amountData = invoiceData.amount;
  const amountValue = amountData?.value;
  const amountConfidence = amountData?.confidence;
  const amountHasBbox = amountData?.bbox && Array.isArray(amountData.bbox) && amountData.bbox.length >= 4;
  const isAmountEdited = editedFields.has('amount');

  // Get comment for Document Info section
  const commentValue = invoiceData.comment ? String(invoiceData.comment) : '';
  const hasComment = commentValue.trim().length > 0;

  return (
    <div className="space-y-4 p-4">
      {/* Document Info Section - Collapsible */}
      <div className="rounded-md border">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="document-info" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Document Info
                </Label>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Comment
                </Label>
                <div className="p-2.5 rounded-lg border bg-muted/30">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {hasComment ? commentValue : <span className="text-muted-foreground italic">No comment</span>}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Key Information Section - Compact Grid Layout */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-border"></div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
            Key Information
          </Label>
          <div className="h-px flex-1 bg-border"></div>
        </div>

        {/* Compact Grid: 2 columns */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Document Type */}
          <div className={cn(
            'p-2.5 rounded-lg border transition-colors',
            !documentType ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
          )}>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Document Type<span className="text-destructive ml-0.5">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Select value={documentType} onValueChange={(v) => handleDocumentTypeChange(v as DocumentType)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {documentType && (
                <Badge
                  variant="outline"
                  className={cn('flex-shrink-0 text-xs h-6', getDocumentTypeBadgeClass(documentType))}
                >
                  {documentType}
                </Badge>
              )}
            </div>
          </div>

          {/* Vendor Name - Editable */}
          <div className={cn(
            'p-2.5 rounded-lg border transition-colors',
            editingField === 'vendorName' 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : editedFields.has('vendorName')
              ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10'
              : 'border-border bg-card'
          )}>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Vendor Name
            </Label>
            <div className="flex items-center gap-1.5">
              {editingField === 'vendorName' ? (
                <Input
                  value={editedValues['vendorName'] || ''}
                  onChange={(e) => setEditedValues(prev => ({ ...prev, vendorName: e.target.value }))}
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveField('vendorName');
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
              ) : (
                <span
                  className="text-sm font-medium flex-1 truncate cursor-pointer"
                  title={invoiceData.vendorName?.value || 'Not found'}
                  onClick={() => handleStartEdit('vendorName', invoiceData.vendorName?.value || '')}
                >
                  {invoiceData.vendorName?.value || 'Not found'}
                </span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                {editingField === 'vendorName' ? (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveField('vendorName')} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-green-600" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                      <X className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <>
                    {editedFields.has('vendorName') && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleResetField('vendorName')} title="Reset to extracted value">
                        <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-amber-600" />
                      </Button>
                    )}
                    {invoiceData.vendorName?.value && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleVendorContactLookup}
                        className="h-7 px-2 gap-1.5 text-xs"
                      >
                        <Search className="h-3 w-3" />
                        Lookup
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {editedFields.has('vendorName') && editingField !== 'vendorName' && (
              <Badge variant="outline" className="text-xs h-5 px-1.5 mt-1.5 bg-amber-100 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-400">
                Edited
              </Badge>
            )}
          </div>

          {/* Case Number */}
          <div className={cn(
            'p-2.5 rounded-lg border transition-colors',
            (!invoiceData.caseNumber || !invoiceData.caseNumber.trim()) 
              ? 'border-destructive/50 bg-destructive/5' 
              : 'border-border bg-card'
          )}>
            <Label htmlFor="case-number" className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Case Number<span className="text-destructive ml-0.5">*</span>
            </Label>
            <div className="flex gap-1.5">
              <Input
                id="case-number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCaseNumberSubmit();
                  }
                }}
                placeholder="Enter case number..."
                disabled={isSubmittingCaseNumber}
                className="h-8 text-sm flex-1"
              />
              <Button
                type="button"
                onClick={handleCaseNumberSubmit}
                disabled={isSubmittingCaseNumber || !caseNumber.trim()}
                size="icon"
                className="h-8 w-8 flex-shrink-0"
              >
                {isSubmittingCaseNumber ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Plaintiff Name - Compact */}
          <div
            className={cn(
              'p-2.5 rounded-lg border transition-colors',
              caseLookupStatus === 'error'
                ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20'
                : bothNamesPresent && !namesMatch
                ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20'
                : bothNamesPresent && namesMatch
                ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Plaintiff Name</Label>
              {caseLookupStatus === 'error' ? (
                <Badge variant="outline" className="gap-1 border-red-500 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 text-xs h-5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Error
                </Badge>
              ) : bothNamesPresent && (
                namesMatch ? (
                  <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 text-xs h-5">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Match
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-orange-500 text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 text-xs h-5">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Mismatch
                  </Badge>
                )
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-16 flex-shrink-0">AI:</span>
                <span className="text-xs font-medium truncate flex-1" title={aiExtractedPlaintiffName || 'Not extracted'}>
                  {aiExtractedPlaintiffName || 'Not extracted'}
                </span>
                {invoiceData.clientName?.confidence !== undefined && (
                  <ConfidenceBadge score={invoiceData.clientName.confidence} />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Case:</span>
                <span 
                  className={cn(
                    'text-xs font-medium truncate flex-1',
                    caseLookupStatus === 'error' ? 'text-red-600 dark:text-red-400' : ''
                  )}
                  title={casePlaintiffName || 'Search case number first'}
                >
                  {caseLookupStatus === 'error'
                    ? 'Error'
                    : caseLookupStatus === 'loading'
                    ? 'Searching...'
                    : casePlaintiffName || 'Not searched'}
                </span>
              </div>
            </div>
            {/* Compact error/mismatch messages */}
            {caseLookupStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 truncate" title={caseLookupError}>
                {caseLookupError || 'Lookup failed'}
              </p>
            )}
            {bothNamesPresent && !namesMatch && (
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <p className="text-xs text-orange-600 dark:text-orange-400 flex-1">
                  Names don't match
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryPlaintiffName}
                  disabled={isRetryingPlaintiffName}
                  className="h-6 px-2 text-xs"
                >
                  {isRetryingPlaintiffName ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disbursement Fields - Compact Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Disbursement Type */}
        <div className={cn(
          'p-2.5 rounded-lg border transition-colors',
          !selectedDisbursementType ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
        )}>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Disbursement Type<span className="text-destructive ml-0.5">*</span>
          </Label>
          <Combobox
            options={typeOptions}
            value={selectedDisbursementType}
            onValueChange={handleDisbursementTypeChange}
            placeholder="Select type..."
            searchPlaceholder="Search types..."
            emptyText="No type found."
            isLoading={isLoadingTypes}
            triggerClassName="h-8 text-sm"
          />
        </div>

        {/* Disbursement Status */}
        <div className={cn(
          'p-2.5 rounded-lg border transition-colors',
          !selectedDisbursementStatus ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
        )}>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Disbursement Status<span className="text-destructive ml-0.5">*</span>
          </Label>
          <Combobox
            options={statusOptions}
            value={selectedDisbursementStatus}
            onValueChange={setSelectedDisbursementStatus}
            placeholder="Select status..."
            searchPlaceholder="Search statuses..."
            emptyText="No status found."
            isLoading={isLoadingStatuses}
            triggerClassName="h-8 text-sm"
          />
        </div>
      </div>

      {/* Separator */}
      <div className="flex items-center gap-2 my-4">
        <div className="h-px flex-1 bg-border"></div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
          Extracted Data
        </Label>
        <div className="h-px flex-1 bg-border"></div>
      </div>

      {/* Extracted Fields - Editable Single Row Layout */}
      {fieldsToRender.length > 0 && (
        <div className="rounded-md border overflow-hidden divide-y">
          {fieldsToRender.map(({ key, title, value }, index) => {
            const confidence = value?.confidence;
            const reasoning = value?.reasoning;
            const hasBbox = value?.bbox && Array.isArray(value.bbox) && value.bbox.length >= 4;
            const rawValue = value?.value ?? '';
            const isEditing = editingField === key;
            const isEdited = editedFields.has(key);

            // Format currency for amount field
            const isAmountField = key === 'amount';
            const displayValue = isAmountField ? formatCurrency(rawValue) : String(rawValue);

            // Ensure unique key by combining field key with index as fallback
            const uniqueKey = `field-${key}-${index}`;

            return (
              <div
                key={uniqueKey}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 transition-colors group',
                  hoveredField === key
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'hover:bg-muted/50',
                  isAmountField && 'bg-emerald-50/50 dark:bg-emerald-900/10',
                  isEditing && 'bg-blue-50 dark:bg-blue-900/20',
                  isEdited && !isEditing && 'bg-amber-50/50 dark:bg-amber-900/10'
                )}
                onMouseEnter={() => {
                  if (hasBbox && !isEditing) {
                    validateAndSetBbox(value.bbox, key, confidence);
                  }
                }}
                onMouseLeave={() => {
                  if (!isEditing) {
                    onFieldHover(null, null, null);
                  }
                }}
                title={reasoning || undefined}
              >
                {/* Field Label */}
                <div className="w-32 flex-shrink-0">
                  <span className={cn(
                    'text-sm font-medium',
                    hoveredField === key ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground',
                    isAmountField && 'text-emerald-700 dark:text-emerald-400'
                  )}>
                    {title}
                  </span>
                </div>

                {/* Field Value - Editable */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <Input
                      value={editedValues[key] || ''}
                      onChange={(e) => setEditedValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveField(key);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                    />
                  ) : (
                    <span
                      className={cn(
                        'text-sm truncate block cursor-pointer',
                        rawValue ? 'font-medium' : 'text-muted-foreground italic',
                        isAmountField && 'text-emerald-700 dark:text-emerald-300 font-semibold'
                      )}
                      title={displayValue}
                      onClick={() => handleStartEdit(key, String(rawValue))}
                    >
                      {displayValue || 'Not found'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveField(key)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-green-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                        <X className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {isEdited ? (
                        <>
                          <Badge variant="outline" className="text-xs h-5 px-1.5 bg-amber-100 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-400">Edited</Badge>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleResetField(key)} title="Reset to extracted value">
                            <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-amber-600" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {confidence !== undefined && confidence !== null && <ConfidenceBadge score={confidence} />}
                          {hasBbox && (
                            <Badge variant="outline" className={cn('text-xs h-5 px-1.5', hoveredField === key ? 'border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30' : 'bg-muted/50')}>
                              Located
                            </Badge>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Amount Field */}
      <div
        className={cn(
          'p-3 rounded-md border transition-colors cursor-pointer',
          hoveredField === 'amount'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
            : isAmountEdited
            ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-300'
            : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        )}
        onMouseEnter={() => {
          if (amountHasBbox && amountData?.bbox) {
            validateAndSetBbox(amountData.bbox, 'amount', amountConfidence);
          }
        }}
        onMouseLeave={() => onFieldHover(null, null, null)}
      >
        <div className="flex items-center gap-3">
          <Label className="font-medium text-sm flex-shrink-0 w-32 text-emerald-700 dark:text-emerald-400">Amount</Label>
          <div className="flex-1 min-w-0">
            {editingField === 'amount' ? (
              <Input
                value={editedValues['amount'] || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, amount: e.target.value }))}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveField('amount');
                  else if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            ) : (
              <span
                className="text-lg font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                onClick={() => handleStartEdit('amount', String(amountValue || ''))}
              >
                {formatCurrency(amountValue)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {editingField === 'amount' ? (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveField('amount')} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-green-600" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                  <X className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </>
            ) : (
              <>
                {isAmountEdited ? (
                  <>
                    <Badge variant="outline" className="text-xs h-5 px-1.5 bg-amber-100 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-400">Edited</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleResetField('amount')} title="Reset to extracted value">
                      <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-amber-600" />
                    </Button>
                  </>
                ) : (
                  <>
                    {amountConfidence !== undefined && amountConfidence !== null && <ConfidenceBadge score={amountConfidence} />}
                    {amountHasBbox && (
                      <Badge variant="outline" className="text-xs h-5 px-1.5 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300">Located</Badge>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contact Lookup Dialog */}
      <Dialog open={isContactLookupOpen} onOpenChange={setIsContactLookupOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Lookup Vendor in CRM</DialogTitle>
            <DialogDescription>
              Search for vendor contacts in SmartAdvocate CRM to ensure accurate vendor name.
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
                    
                    // Use a composite key to ensure uniqueness even if contactId is 0 or duplicate
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectContact(contact);
                            }}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Select'
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isSearchingContacts && contactSearchResults.length === 0 && !contactSearchError && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Enter a search query and click search to find contacts in CRM.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
