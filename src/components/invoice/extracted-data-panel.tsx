'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Search, Loader2, AlertTriangle, CheckCircle2, DollarSign, Save, X, RotateCcw } from 'lucide-react';
import type { BoundingBox } from '@/lib/utils/bbox-utils';
import type { StoredInvoice, DocumentType } from '@/lib/domain/types';
import {
  fetchDisbursementTypesAction,
  fetchDisbursementStatusesAction,
  getPreviousDisbursementTypeForVendorAction,
  saveDisbursementTypeMappingAction,
  updateInvoiceCaseNumberAction,
  lookupCaseInfoAction,
  updateInvoiceFieldAction,
  lookupContactsAction,
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
import { getDocumentTypeBadgeClass } from '@/lib/utils/document-type-utils';

const toTitleCase = (str: string) => {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
};

// Format amount as currency
const formatCurrency = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null || value === '') return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
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
}: ExtractedDataPanelProps) {
  const { toast } = useToast();

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
  // Case Sourced (from case number lookup) - fetched separately from SmartAdvocate API
  const [casePlaintiffName, setCasePlaintiffName] = useState<string>('');

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
    setCasePlaintiffName(''); // Clear previous result

    try {
      // First save the case number to the invoice
      const saveResult = await updateInvoiceCaseNumberAction(invoiceData.id, caseNumber);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save case number');
      }

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
        setCasePlaintiffName(lookupResult.data.name);
        setCaseLookupStatus('success');
        toast({
          title: 'Case Found',
          description: `Plaintiff: ${lookupResult.data.name}`,
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
      const result = await updateInvoiceFieldAction(invoiceData.id, key, fieldValue, true);

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
      const result = await updateInvoiceFieldAction(invoiceData.id, key, originalValue, false);

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

  // Compare plaintiff names - normalize for comparison
  const normalizeNameForComparison = (name: string): string => {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  const hasAiExtractedName = aiExtractedPlaintiffName.trim().length > 0;
  const hasCaseName = casePlaintiffName.trim().length > 0;
  const caseSearchSuccessful = caseLookupStatus === 'success';
  const bothNamesPresent = hasAiExtractedName && hasCaseName && caseSearchSuccessful;
  const namesMatch = bothNamesPresent
    ? normalizeNameForComparison(aiExtractedPlaintiffName) === normalizeNameForComparison(casePlaintiffName)
    : false;

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
      const result = await updateInvoiceFieldAction(invoiceData.id, 'vendorName', contactName, true);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update vendor name');
      }

      // Update local state
      const updatedInvoice = { ...invoiceData };
      if (updatedInvoice.vendorName) {
        updatedInvoice.vendorName = {
          ...updatedInvoice.vendorName,
          value: contactName,
          confidence: undefined,
          reasoning: 'User selected from CRM',
        };
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
    'comment', 'paymentType', 'clientName', 'customerName', // plaintiff name handled separately
    'totalAmount', // only show amount field
    'vendorName', // vendor name handled separately with CRM lookup
  ];

  const fieldsToRender = Object.entries(invoiceData)
    .filter(([key, value]) => {
      if (value === null) return false;
      return !excludedFields.includes(key);
    })
    .map(([key, value]) => ({ key, title: toTitleCase(key), value }));

  // Get amount data for header display
  const amountData = invoiceData.amount;
  const amountValue = amountData?.value;
  const amountConfidence = amountData?.confidence;
  const amountHasBbox = amountData?.bbox && Array.isArray(amountData.bbox) && amountData.bbox.length >= 4;

  return (
    <div className="space-y-3 p-4">
      {/* Header with Amount Display */}
      <div className="flex items-center justify-between pb-2 border-b">
        <h3 className="font-semibold text-base">Extracted Data</h3>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors',
            hoveredField === 'amount'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
              : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
          )}
          onMouseEnter={() => {
            if (amountHasBbox && amountData?.bbox) {
              validateAndSetBbox(amountData.bbox, 'amount', amountConfidence);
            }
          }}
          onMouseLeave={() => onFieldHover(null, null, null)}
        >
          <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(amountValue)}
          </span>
          {amountConfidence !== undefined && amountConfidence !== null && (
            <ConfidenceBadge score={amountConfidence} />
          )}
          {amountHasBbox && (
            <Badge
              variant="outline"
              className="text-xs h-5 px-1.5 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300"
            >
              Located
            </Badge>
          )}
        </div>
      </div>

      {/* Document Type - Single Line */}
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="flex items-center gap-3">
          <Label className="font-medium text-sm flex-shrink-0 w-32">Document Type</Label>
          <div className="flex-1">
            <Select value={documentType} onValueChange={(v) => handleDocumentTypeChange(v as DocumentType)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {documentType && (
            <Badge
              variant="outline"
              className={cn('flex-shrink-0', getDocumentTypeBadgeClass(documentType))}
            >
              {documentType}
            </Badge>
          )}
        </div>
      </div>

      {/* Vendor Name - Single Line with CRM lookup */}
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="flex items-center gap-3">
          <Label className="font-medium text-sm flex-shrink-0 w-32">Vendor Name</Label>
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm font-medium flex-1 truncate">
              {invoiceData.vendorName?.value || 'Not found'}
            </span>
            {invoiceData.vendorName?.value && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVendorContactLookup}
                className="h-8 gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                Lookup in CRM
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Case Number - Single Line with submit button */}
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="flex items-center gap-3">
          <Label htmlFor="case-number" className="font-medium text-sm flex-shrink-0 w-32">
            Case Number<span className="text-destructive">*</span>
          </Label>
          <div className="flex-1 flex gap-2">
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
              className="flex-1 h-9"
            />
            <Button
              type="button"
              onClick={handleCaseNumberSubmit}
              disabled={isSubmittingCaseNumber || !caseNumber.trim()}
              size="icon"
              className="h-9 w-9 flex-shrink-0"
            >
              {isSubmittingCaseNumber ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Plaintiff Name - Side by Side Comparison */}
      <div
        className={cn(
          'p-3 rounded-md border',
          caseLookupStatus === 'error'
            ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20'
            : bothNamesPresent && !namesMatch
            ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20'
            : bothNamesPresent && namesMatch
            ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
            : 'bg-muted/30'
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <Label className="font-medium">Plaintiff Name</Label>
          {caseLookupStatus === 'error' ? (
            <Badge variant="outline" className="gap-1 border-red-500 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-3 w-3" />
              Lookup Failed
            </Badge>
          ) : bothNamesPresent && (
            namesMatch ? (
              <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-3 w-3" />
                Match
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-orange-500 text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="h-3 w-3" />
                Mismatch
              </Badge>
            )
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* From Document (AI Extracted) */}
          <div
            className={cn(
              'rounded-md p-2 border',
              bothNamesPresent && !namesMatch
                ? 'border-orange-300 dark:border-orange-700'
                : 'border-border'
            )}
          >
            <Label className="text-xs text-muted-foreground mb-1 block">From Document (AI)</Label>
            <div
              className={cn(
                'text-sm font-mono px-2 py-1.5 rounded bg-background/70 truncate',
                hasAiExtractedName ? '' : 'text-muted-foreground italic'
              )}
              title={aiExtractedPlaintiffName || 'Not extracted'}
            >
              {aiExtractedPlaintiffName || 'Not extracted'}
            </div>
            {invoiceData.clientName?.confidence !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <ConfidenceBadge score={invoiceData.clientName.confidence} />
                {invoiceData.clientName?.bbox && (
                  <Badge variant="outline" className="text-xs">Located</Badge>
                )}
              </div>
            )}
          </div>

          {/* From Case (Case Lookup) */}
          <div
            className={cn(
              'rounded-md p-2 border',
              caseLookupStatus === 'error'
                ? 'border-red-300 dark:border-red-700'
                : bothNamesPresent && !namesMatch
                ? 'border-orange-300 dark:border-orange-700'
                : 'border-border'
            )}
          >
            <Label className="text-xs text-muted-foreground mb-1 block">From Case</Label>
            <div
              className={cn(
                'text-sm font-mono px-2 py-1.5 rounded bg-background/70 truncate',
                caseLookupStatus === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : hasCaseName
                  ? ''
                  : 'text-muted-foreground italic'
              )}
              title={
                caseLookupStatus === 'error'
                  ? caseLookupError
                  : casePlaintiffName || 'Search case number first'
              }
            >
              {caseLookupStatus === 'error'
                ? 'Error - See details below'
                : caseLookupStatus === 'loading'
                ? 'Searching...'
                : casePlaintiffName || 'Search case number first'}
            </div>
            {caseSearchSuccessful && hasCaseName && (
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-700 dark:text-blue-400">
                  Case Data
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Error Message for Failed Lookup */}
        {caseLookupStatus === 'error' && (
          <div className="mt-3 flex items-start gap-2 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              <span className="font-medium">Case lookup failed.</span> {caseLookupError || 'Unable to retrieve case details. Please verify the case number and try again.'}
            </p>
          </div>
        )}

        {/* Mismatch Warning Message */}
        {bothNamesPresent && !namesMatch && (
          <div className="mt-3 flex items-start gap-2 p-2 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              <span className="font-medium">Name mismatch detected.</span> The name extracted from the document does not match the case plaintiff name. Please verify and confirm the correct party.
            </p>
          </div>
        )}

        {/* Match Success Message */}
        {bothNamesPresent && namesMatch && (
          <div className="mt-3 flex items-start gap-2 p-2 rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              <span className="font-medium">Names match.</span> The document plaintiff name matches the case record.
            </p>
          </div>
        )}

        {/* Help text when no case lookup yet */}
        {caseLookupStatus === 'idle' && (
          <p className="text-xs text-muted-foreground mt-2">
            Enter a case number above and search to compare with the AI-extracted name.
          </p>
        )}
      </div>

      {/* Disbursement Type - Single Line */}
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="flex items-center gap-3">
          <Label className="font-medium text-sm flex-shrink-0 w-32">Disbursement Type</Label>
          <div className="flex-1">
            <Combobox
              options={typeOptions}
              value={selectedDisbursementType}
              onValueChange={handleDisbursementTypeChange}
              placeholder="Select type..."
              searchPlaceholder="Search types..."
              emptyText="No type found."
              isLoading={isLoadingTypes}
              triggerClassName="h-9"
            />
          </div>
        </div>
      </div>

      {/* Disbursement Status - Single Line */}
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="flex items-center gap-3">
          <Label className="font-medium text-sm flex-shrink-0 w-32">Disbursement Status</Label>
          <div className="flex-1">
            <Combobox
              options={statusOptions}
              value={selectedDisbursementStatus}
              onValueChange={setSelectedDisbursementStatus}
              placeholder="Select status..."
              searchPlaceholder="Search statuses..."
              emptyText="No status found."
              isLoading={isLoadingStatuses}
              triggerClassName="h-9"
            />
          </div>
        </div>
      </div>

      {/* Reset All Edited Fields Button - Always reserve space to prevent UI shift */}
      <div className="flex justify-end h-8">
        {editedFields.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              for (const key of editedFields) {
                await handleResetField(key);
              }
            }}
            disabled={isSaving}
            className="gap-1.5 text-xs"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Reset All Edited ({editedFields.size})
          </Button>
        )}
      </div>

      {/* Extracted Fields - Editable Single Row Layout */}
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

              {/* Badges & Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isEditing ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleSaveField(key)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Show Edited badge instead of confidence when edited */}
                    {isEdited ? (
                      <>
                        <Badge
                          variant="outline"
                          className="text-xs h-5 px-1.5 bg-amber-100 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-400"
                        >
                          Edited
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleResetField(key)}
                          title="Reset to extracted value"
                        >
                          <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-amber-600" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {confidence !== undefined && confidence !== null && (
                          <ConfidenceBadge score={confidence} />
                        )}
                        {hasBbox && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs h-5 px-1.5',
                              hoveredField === key
                                ? 'border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                                : 'bg-muted/50'
                            )}
                          >
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
