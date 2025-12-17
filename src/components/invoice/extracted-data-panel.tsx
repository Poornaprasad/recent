'use client';

import { useState, useEffect } from 'react';
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
import { Search, Loader2 } from 'lucide-react';
import type { BoundingBox } from '@/lib/utils/bbox-utils';
import type { StoredInvoice, DocumentType } from '@/lib/domain/types';
import {
  fetchDisbursementTypesAction,
  fetchDisbursementStatusesAction,
  getPreviousDisbursementTypeForVendorAction,
  saveDisbursementTypeMappingAction,
  updateInvoiceCaseNumberAction,
  getInvoiceByIdAction,
} from '@/lib/actions/index';
import { useToast } from '@/hooks/use-toast';
import { getDocumentTypeBadgeClass, getDocumentTypeDescription } from '@/lib/utils/document-type-utils';

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

export function ExtractedDataPanel({
  invoiceData,
  hoveredField,
  onFieldHover,
  onInvoiceUpdate,
  onDocumentTypeChange,
}: ExtractedDataPanelProps) {
  const { toast } = useToast();

  // Case number state (not auto-search, requires explicit submit)
  const [caseNumber, setCaseNumber] = useState(invoiceData.caseNumber || '');
  const [isSubmittingCaseNumber, setIsSubmittingCaseNumber] = useState(false);

  // Document type state
  const [documentType, setDocumentType] = useState<DocumentType | undefined>(invoiceData.documentType);

  // Disbursement dropdown states
  const [disbursementTypes, setDisbursementTypes] = useState<DisbursementOption[]>([]);
  const [disbursementStatuses, setDisbursementStatuses] = useState<DisbursementOption[]>([]);
  const [selectedDisbursementType, setSelectedDisbursementType] = useState<string>('');
  const [selectedDisbursementStatus, setSelectedDisbursementStatus] = useState<string>('');
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

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

  // Handle case number submission
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
    try {
      const result = await updateInvoiceCaseNumberAction(invoiceData.id, caseNumber);
      if (result.success) {
        // Refresh invoice data to get plaintiff name and other updates
        const updatedResult = await getInvoiceByIdAction(invoiceData.id);
        if (updatedResult.data) {
          onInvoiceUpdate(updatedResult.data);

          const plaintiffName = updatedResult.data.clientName?.value || updatedResult.data.customerName?.value;
          let description = 'Case number has been saved.';
          if (plaintiffName) {
            description += ` Plaintiff name "${plaintiffName}" retrieved.`;
          }

          toast({
            title: 'Case Number Updated',
            description,
          });
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: result.error || 'Failed to update case number.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update case number.',
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
  const validateAndSetBbox = (bbox: any, key: string, confidence?: number) => {
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

  // Get plaintiff name from invoice data
  const plaintiffName = invoiceData.clientName?.value || invoiceData.customerName?.value || '';

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
  ];

  const fieldsToRender = Object.entries(invoiceData)
    .filter(([key, value]) => {
      if (value === null) return false;
      return !excludedFields.includes(key);
    })
    .map(([key, value]) => ({ key, title: toTitleCase(key), value }));

  return (
    <div className="space-y-3 p-4">
      {/* Document Type - Editable */}
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <Label className="font-medium">Document Type</Label>
          {documentType && (
            <Badge
              variant="outline"
              className={cn(getDocumentTypeBadgeClass(documentType))}
            >
              {documentType}
            </Badge>
          )}
        </div>
        <Select value={documentType} onValueChange={(v) => handleDocumentTypeChange(v as DocumentType)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select document type..." />
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
          <p className="text-xs text-muted-foreground mt-2 italic">
            {getDocumentTypeDescription(documentType)}
          </p>
        )}
      </div>

      {/* Case Number - with explicit submit button */}
      <div className="p-3 rounded-md border bg-muted/30">
        <Label htmlFor="case-number" className="mb-2 block font-medium">
          Case Number
          <span className="text-destructive ml-1">*</span>
        </Label>
        <div className="flex gap-2">
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
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleCaseNumberSubmit}
            disabled={isSubmittingCaseNumber || !caseNumber.trim()}
            size="icon"
          >
            {isSubmittingCaseNumber ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Enter case number and click search to look up case details
        </p>
      </div>

      {/* Plaintiff Name - populated from case lookup */}
      <div className="p-3 rounded-md border bg-muted/30">
        <Label className="mb-2 block font-medium">Plaintiff Name</Label>
        <Input
          value={plaintiffName}
          readOnly
          placeholder="Will be populated after case number search..."
          className="bg-muted/50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Automatically populated from case information
        </p>
      </div>

      {/* Disbursement Type - Searchable dropdown */}
      <div className="p-3 rounded-md border bg-muted/30">
        <Label className="mb-2 block font-medium">Disbursement Type</Label>
        <Combobox
          options={typeOptions}
          value={selectedDisbursementType}
          onValueChange={handleDisbursementTypeChange}
          placeholder="Select disbursement type..."
          searchPlaceholder="Search types..."
          emptyText="No disbursement type found."
          isLoading={isLoadingTypes}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {selectedDisbursementType
            ? 'Disbursement type selected. Will be remembered for this vendor.'
            : 'Select the type of disbursement for this document.'}
        </p>
      </div>

      {/* Disbursement Status - Searchable dropdown */}
      <div className="p-3 rounded-md border bg-muted/30">
        <Label className="mb-2 block font-medium">Disbursement Status</Label>
        <Combobox
          options={statusOptions}
          value={selectedDisbursementStatus}
          onValueChange={setSelectedDisbursementStatus}
          placeholder="Select status..."
          searchPlaceholder="Search statuses..."
          emptyText="No status found."
          isLoading={isLoadingStatuses}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {documentType === 'Invoice'
            ? 'Default: "Issue Check" for invoices'
            : documentType === 'Receipt'
            ? 'Default: "Paid" for receipts'
            : 'Select the status for this disbursement.'}
        </p>
      </div>

      {/* Extracted Fields - Compact Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fieldsToRender.map(({ key, title, value }) => {
          const confidence = value?.confidence;
          const reasoning = value?.reasoning;
          const hasBbox = value?.bbox && Array.isArray(value.bbox) && value.bbox.length >= 4;
          const displayValue = value?.value ?? '';

          return (
            <div
              key={key}
              className={cn(
                'p-3 rounded-md transition-colors border',
                hoveredField === key
                  ? 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  : 'border-border'
              )}
              onMouseEnter={() => {
                if (hasBbox) {
                  validateAndSetBbox(value.bbox, key, confidence);
                }
              }}
              onMouseLeave={() => {
                onFieldHover(null, null, null);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <Label className={cn('font-medium text-sm', hoveredField === key && 'text-green-600 dark:text-green-400')}>
                  {title}
                </Label>
                <div className="flex items-center gap-1">
                  {confidence !== undefined && (
                    <ConfidenceBadge score={confidence} />
                  )}
                  {hasBbox && (
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20"
                    >
                      Located
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-sm font-mono bg-background/50 px-2 py-1 rounded border truncate" title={String(displayValue)}>
                {String(displayValue) || '-'}
              </div>
              {reasoning && (
                <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1" title={reasoning}>
                  {reasoning}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
