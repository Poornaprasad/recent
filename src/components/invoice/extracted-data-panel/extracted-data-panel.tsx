'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/hooks/use-auth-store';
import type { StoredInvoice, DocumentType } from '@/lib/domain/types';
import type { BoundingBox } from '@/lib/utils/bbox-utils';
import type { ContactLookupResult } from '@/lib/crm/smartadvocate/types';
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
import { matchPlaintiffData, formatNameFirstLast } from '@/lib/utils/name-matching';
import { logger } from '@/lib/core/logging/client-logger';

import { DocumentInfoSection } from './document-info-section';
import { KeyInformationSection } from './key-information-section';
import { DisbursementSection } from './disbursement-section';
import { ExtractedFieldsList } from './extracted-fields-list';
import { AmountField } from './amount-field';
import { ContactLookupDialog } from './contact-lookup-dialog';
import type { ExtractedDataPanelProps, DisbursementOption, ExtractedFieldData, CaseLookupState, DisbursementState } from './types';
import { EXCLUDED_FIELDS, toTitleCase, getDefaultStatusId, isValidBbox } from './utils';

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

  // Original field data for reset functionality
  const originalFieldsRef = useRef<Record<string, any>>({});

  // Document type state
  const [documentType, setDocumentType] = useState<DocumentType | undefined>(invoiceData.documentType);

  // Case lookup state
  const [caseLookup, setCaseLookup] = useState<CaseLookupState>({
    caseNumber: invoiceData.caseNumber || '',
    isSubmitting: false,
    status: 'idle',
    error: '',
    plaintiffName: invoiceData.plaintiffName || '',
  });

  // Disbursement state
  const [disbursement, setDisbursement] = useState<DisbursementState>({
    types: [],
    statuses: [],
    selectedType: '',
    selectedStatus: '',
    isLoadingTypes: false,
    isLoadingStatuses: false,
  });

  // Editable fields state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Contact lookup state
  const [contactLookup, setContactLookup] = useState({
    isOpen: false,
    searchQuery: '',
    results: [] as ContactLookupResult[],
    isSearching: false,
    error: '',
  });

  // Retry plaintiff name state
  const [isRetryingPlaintiffName, setIsRetryingPlaintiffName] = useState(false);

  // Track auto-fetch attempts
  const hasAutoFetchedRef = useRef<Set<string>>(new Set());
  const prevValidationRef = useRef<{ isValid: boolean; missingFields: string[] } | null>(null);

  // Sync case number when invoiceData changes
  useEffect(() => {
    const newCaseNumber = invoiceData.caseNumber || '';
    if (newCaseNumber !== caseLookup.caseNumber) {
      setCaseLookup(prev => ({ ...prev, caseNumber: newCaseNumber }));
    }
  }, [invoiceData.caseNumber]);

  // Load plaintiff name from database on initial load
  useEffect(() => {
    const storedPlaintiffName = invoiceData.plaintiffName || '';
    if (storedPlaintiffName && !caseLookup.plaintiffName) {
      setCaseLookup(prev => ({ ...prev, plaintiffName: storedPlaintiffName }));
    }
  }, [invoiceData.id]);

  // Auto-fetch plaintiff name if case number exists but plaintiff name is missing
  useEffect(() => {
    const fetchPlaintiffName = async () => {
      const currentCaseNumber = invoiceData.caseNumber?.trim();
      const hasStoredPlaintiffName = invoiceData.plaintiffName && invoiceData.plaintiffName.trim().length > 0;
      const invoiceKey = `${invoiceData.id}-${currentCaseNumber}`;

      if (
        currentCaseNumber &&
        !hasStoredPlaintiffName &&
        !hasAutoFetchedRef.current.has(invoiceKey) &&
        !caseLookup.isSubmitting &&
        caseLookup.status !== 'loading'
      ) {
        hasAutoFetchedRef.current.add(invoiceKey);

        try {
          setCaseLookup(prev => ({ ...prev, status: 'loading' }));
          const lookupResult = await lookupCaseInfoAction(currentCaseNumber);

          if (lookupResult.error) {
            setCaseLookup(prev => ({ ...prev, status: 'error', error: lookupResult.error || '' }));
            return;
          }

          if (lookupResult.data) {
            const formattedName = formatNameFirstLast(lookupResult.data.name);
            setCaseLookup(prev => ({ ...prev, plaintiffName: formattedName, status: 'success' }));

            const savePlaintiffResult = await updateInvoicePlaintiffNameAction(
              invoiceData.id,
              formattedName,
              user?.id
            );

            if (savePlaintiffResult.success) {
              onInvoiceUpdate({ ...invoiceData, plaintiffName: formattedName });
            }
          }
        } catch (error) {
          logger.error('Failed to auto-fetch plaintiff name', { error });
          setCaseLookup(prev => ({
            ...prev,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to fetch plaintiff name',
          }));
          hasAutoFetchedRef.current.delete(invoiceKey);
        }
      }
    };

    fetchPlaintiffName();
  }, [invoiceData.caseNumber, invoiceData.plaintiffName, invoiceData.id]);

  // Validate mandatory fields
  const savedCaseNumber = useMemo(() => invoiceData?.caseNumber || '', [invoiceData?.caseNumber]);

  useEffect(() => {
    if (!onValidationChange) return;

    const optionsLoaded = disbursement.types.length > 0 && disbursement.statuses.length > 0;
    const loadingComplete = !disbursement.isLoadingTypes && !disbursement.isLoadingStatuses;

    if (!loadingComplete && !optionsLoaded) return;

    const missingFields: string[] = [];
    if (!documentType) missingFields.push('Document Type');
    if (!savedCaseNumber.trim()) missingFields.push('Case Number');
    if (!disbursement.selectedType) missingFields.push('Disbursement Type');
    if (!disbursement.selectedStatus) missingFields.push('Disbursement Status');

    const isValid = missingFields.length === 0;
    const prevValidation = prevValidationRef.current;

    if (!prevValidation ||
      prevValidation.isValid !== isValid ||
      JSON.stringify(prevValidation.missingFields) !== JSON.stringify(missingFields)) {
      prevValidationRef.current = { isValid, missingFields };
      onValidationChange(isValid, missingFields);
    }
  }, [documentType, savedCaseNumber, disbursement.selectedType, disbursement.selectedStatus, disbursement.isLoadingTypes, disbursement.isLoadingStatuses, disbursement.types.length, disbursement.statuses.length, onValidationChange]);

  // Initialize original field data
  useEffect(() => {
    const originals: Record<string, any> = {};
    const alreadyEdited = new Set<string>();

    Object.entries(invoiceData).forEach(([key, value]) => {
      if (value && typeof value === 'object' && 'value' in value) {
        originals[key] = { ...value };
        if (value.reasoning === 'User edited' && value.confidence === undefined) {
          alreadyEdited.add(key);
        }
      }
    });

    originalFieldsRef.current = originals;
    if (alreadyEdited.size > 0) {
      setEditedFields(alreadyEdited);
    }
  }, []);

  // Load disbursement options
  useEffect(() => {
    const loadDisbursementOptions = async () => {
      setDisbursement(prev => ({ ...prev, isLoadingTypes: true, isLoadingStatuses: true }));

      try {
        const [typesResult, statusesResult] = await Promise.all([
          fetchDisbursementTypesAction(),
          fetchDisbursementStatusesAction(),
        ]);

        setDisbursement(prev => {
          const newState = { ...prev };
          if (typesResult.data) newState.types = typesResult.data;
          if (statusesResult.data) {
            newState.statuses = statusesResult.data;
            const defaultStatus = getDefaultStatusId(invoiceData.documentType);
            if (defaultStatus) newState.selectedStatus = defaultStatus;
          }
          newState.isLoadingTypes = false;
          newState.isLoadingStatuses = false;
          return newState;
        });
      } catch (error) {
        logger.error('Failed to load disbursement options', { error });
        setDisbursement(prev => ({ ...prev, isLoadingTypes: false, isLoadingStatuses: false }));
      }
    };

    loadDisbursementOptions();
  }, [invoiceData.documentType]);

  // Load previous disbursement type for vendor
  useEffect(() => {
    const loadPreviousDisbursementType = async () => {
      const vendorName = invoiceData.vendorName?.value;
      if (!vendorName || disbursement.types.length === 0) return;

      try {
        const result = await getPreviousDisbursementTypeForVendorAction(vendorName);
        if (result.data) {
          const matchingType = disbursement.types.find(
            t => t.description.toLowerCase() === result.data?.toLowerCase()
          );
          if (matchingType) {
            setDisbursement(prev => ({ ...prev, selectedType: String(matchingType.id) }));
          }
        }
      } catch (error) {
        logger.error('Failed to load previous disbursement type', { error });
      }
    };

    loadPreviousDisbursementType();
  }, [invoiceData.vendorName?.value, disbursement.types]);

  // Handle case number submit
  const handleCaseNumberSubmit = async () => {
    if (!caseLookup.caseNumber.trim()) {
      toast({ variant: 'destructive', title: 'Case Number Required', description: 'Please enter a case number.' });
      return;
    }

    setCaseLookup(prev => ({ ...prev, isSubmitting: true, status: 'loading', error: '' }));

    try {
      const saveResult = await updateInvoiceCaseNumberAction(invoiceData.id, caseLookup.caseNumber, user?.id);
      if (!saveResult.success) throw new Error(saveResult.error || 'Failed to save case number');

      onInvoiceUpdate({ ...invoiceData, caseNumber: caseLookup.caseNumber.trim() });

      const lookupResult = await lookupCaseInfoAction(caseLookup.caseNumber);

      if (lookupResult.error) {
        setCaseLookup(prev => ({ ...prev, status: 'error', error: lookupResult.error || '' }));
        toast({ variant: 'destructive', title: 'Case Lookup Failed', description: lookupResult.error });
        return;
      }

      if (lookupResult.data) {
        const formattedName = formatNameFirstLast(lookupResult.data.name);
        setCaseLookup(prev => ({ ...prev, plaintiffName: formattedName, status: 'success' }));

        const savePlaintiffResult = await updateInvoicePlaintiffNameAction(invoiceData.id, formattedName, user?.id);
        if (savePlaintiffResult.success) {
          onInvoiceUpdate({ ...invoiceData, plaintiffName: formattedName });
        }

        toast({ title: 'Case Found', description: `Plaintiff: ${formattedName}` });
      } else {
        setCaseLookup(prev => ({ ...prev, status: 'error', error: 'No plaintiff found in case' }));
        toast({ variant: 'destructive', title: 'Case Lookup Failed', description: 'No plaintiff found in case record.' });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to lookup case';
      setCaseLookup(prev => ({ ...prev, status: 'error', error: errorMsg }));
      toast({ variant: 'destructive', title: 'Case Lookup Failed', description: errorMsg });
    } finally {
      setCaseLookup(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Handle document type change
  const handleDocumentTypeChange = (newType: DocumentType) => {
    setDocumentType(newType);
    onDocumentTypeChange?.(newType);
    const defaultStatus = getDefaultStatusId(newType);
    if (defaultStatus) {
      setDisbursement(prev => ({ ...prev, selectedStatus: defaultStatus }));
    }
  };

  // Handle disbursement type change
  const handleDisbursementTypeChange = async (typeId: string) => {
    setDisbursement(prev => ({ ...prev, selectedType: typeId }));

    const vendorName = invoiceData.vendorName?.value;
    if (vendorName && caseLookup.caseNumber && typeId) {
      const selectedType = disbursement.types.find(t => String(t.id) === typeId);
      if (selectedType) {
        try {
          await saveDisbursementTypeMappingAction(caseLookup.caseNumber, vendorName, selectedType.description, invoiceData.id);
        } catch (error) {
          logger.error('Failed to save disbursement type mapping', { error });
        }
      }
    }
  };

  // Handle field editing
  const handleStartEdit = (key: string, currentValue: string) => {
    setEditingField(key);
    setEditedValues(prev => ({ ...prev, [key]: currentValue }));
  };

  const handleSaveField = async (key: string) => {
    setIsSaving(true);
    try {
      const fieldValue = editedValues[key];
      const originalField = originalFieldsRef.current[key];
      const originalValue = originalField?.value !== undefined ? String(originalField.value) : '';

      const result = await updateInvoiceFieldAction(invoiceData.id, key, fieldValue, true, user?.id);
      if (!result.success) throw new Error(result.error || 'Failed to save field');

      const updatedInvoice = { ...invoiceData };
      if (updatedInvoice[key as keyof StoredInvoice]) {
        (updatedInvoice as any)[key] = {
          ...(updatedInvoice as any)[key],
          value: fieldValue,
          confidence: undefined,
          reasoning: 'User edited',
        };
      }

      if (fieldValue !== originalValue) {
        setEditedFields(prev => new Set(prev).add(key));
      }

      onInvoiceUpdate(updatedInvoice);
      setEditingField(null);
      toast({ title: 'Field Saved', description: `${toTitleCase(key)} has been saved to database.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error instanceof Error ? error.message : 'Failed to save field.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => setEditingField(null);

  const handleResetField = async (key: string) => {
    const originalField = originalFieldsRef.current[key];
    if (!originalField) return;

    const originalValue = originalField.value !== undefined ? String(originalField.value) : '';
    setIsSaving(true);

    try {
      const result = await updateInvoiceFieldAction(invoiceData.id, key, originalValue, false, user?.id);
      if (!result.success) throw new Error(result.error || 'Failed to reset field');

      const updatedInvoice = { ...invoiceData };
      if (updatedInvoice[key as keyof StoredInvoice]) {
        (updatedInvoice as any)[key] = { ...originalField };
      }

      setEditedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });

      onInvoiceUpdate(updatedInvoice);
      toast({ title: 'Field Reset', description: `${toTitleCase(key)} has been reset to extracted value.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: error instanceof Error ? error.message : 'Failed to reset field.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Validate and set bounding box for hover
  const validateAndSetBbox = useCallback((bbox: any, key: string, confidence?: number) => {
    if (isValidBbox(bbox)) {
      onFieldHover(key, bbox, confidence ?? null);
    }
  }, [onFieldHover]);

  // Plaintiff name comparison
  const aiExtractedPlaintiffName = invoiceData.clientName?.value || invoiceData.customerName?.value || '';
  const hasAiExtractedName = aiExtractedPlaintiffName.trim().length > 0;
  const hasCaseName = caseLookup.plaintiffName.trim().length > 0;
  const caseSearchSuccessful = caseLookup.status === 'success';
  const bothNamesPresent = hasAiExtractedName && hasCaseName && caseSearchSuccessful;

  const matchResult = bothNamesPresent
    ? matchPlaintiffData(aiExtractedPlaintiffName, caseLookup.plaintiffName)
    : { isMatch: false, matchType: 'none', confidence: 'none' };
  const namesMatch = matchResult.isMatch;

  // Retry plaintiff name extraction
  const handleRetryPlaintiffName = async () => {
    if (!caseLookup.plaintiffName || !caseSearchSuccessful) {
      toast({ variant: 'destructive', title: 'Case Name Required', description: 'Please search for a case number first to get the plaintiff name.' });
      return;
    }

    setIsRetryingPlaintiffName(true);
    try {
      const result = await retryPlaintiffNameAction(invoiceData.id, caseLookup.plaintiffName);

      if (result.error) {
        toast({ variant: 'destructive', title: 'Retry Failed', description: result.error });
      } else if (result.found) {
        toast({ title: 'Name Found', description: `Found "${caseLookup.plaintiffName}" in the document.` });
        const updatedInvoice = await getInvoiceByIdAction(invoiceData.id);
        if (updatedInvoice.data) onInvoiceUpdate(updatedInvoice.data);
      } else {
        toast({ variant: 'destructive', title: 'Name Not Found', description: `Could not find "${caseLookup.plaintiffName}" in the document.` });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to retry plaintiff name extraction' });
    } finally {
      setIsRetryingPlaintiffName(false);
    }
  };

  // Contact lookup handlers
  const handleVendorContactLookup = async () => {
    const vendorName = invoiceData.vendorName?.value;
    if (!vendorName) {
      toast({ variant: 'destructive', title: 'Vendor Name Required', description: 'Please ensure vendor name is extracted from the invoice.' });
      return;
    }

    setContactLookup(prev => ({ ...prev, isOpen: true, searchQuery: vendorName }));
    await searchContacts(vendorName);
  };

  const searchContacts = async (query: string) => {
    if (!query.trim()) {
      setContactLookup(prev => ({ ...prev, results: [] }));
      return;
    }

    setContactLookup(prev => ({ ...prev, isSearching: true, error: '' }));

    try {
      const nameParts = query.trim().split(/\s+/);
      const params: { name?: string; firstName?: string; lastName?: string } = {};

      if (nameParts.length === 1) {
        params.name = nameParts[0];
      } else if (nameParts.length >= 2) {
        params.firstName = nameParts[0];
        params.lastName = nameParts.slice(1).join(' ');
      }

      const result = await lookupContactsAction({ ...params, rowLimit: 20 });

      if (result.error) {
        setContactLookup(prev => ({ ...prev, error: result.error || '', results: [] }));
      } else if (result.data) {
        setContactLookup(prev => ({
          ...prev,
          results: result.data || [],
          error: result.data?.length === 0 ? 'No contacts found matching the search criteria.' : '',
        }));
      }
    } catch (error) {
      setContactLookup(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to search contacts',
        results: [],
      }));
    } finally {
      setContactLookup(prev => ({ ...prev, isSearching: false }));
    }
  };

  const handleSelectContact = async (contact: ContactLookupResult) => {
    const contactName = contact.name || (contact.firstName && contact.lastName
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : contact.firstName || contact.lastName || '');

    if (!contactName) {
      toast({ variant: 'destructive', title: 'Invalid Contact', description: 'Contact does not have a valid name.' });
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateInvoiceFieldAction(invoiceData.id, 'vendorName', contactName, true, user?.id);
      if (!result.success) throw new Error(result.error || 'Failed to update vendor name');

      const updatedInvoice = { ...invoiceData };
      if (updatedInvoice.vendorName) {
        updatedInvoice.vendorName = {
          ...updatedInvoice.vendorName,
          value: contactName,
          reasoning: 'User selected from CRM',
        };
        delete (updatedInvoice.vendorName as any).confidence;
      }

      setEditedFields(prev => new Set(prev).add('vendorName'));
      onInvoiceUpdate(updatedInvoice);
      setContactLookup(prev => ({ ...prev, isOpen: false, results: [], searchQuery: '' }));
      toast({ title: 'Vendor Name Updated', description: `Vendor name updated to "${contactName}" from CRM.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error instanceof Error ? error.message : 'Failed to update vendor name.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare fields to render
  const fieldsToRender: ExtractedFieldData[] = Object.entries(invoiceData)
    .filter(([key, value]) => {
      if (EXCLUDED_FIELDS.includes(key)) return false;
      if (value === null || value === undefined) return false;
      if (typeof value === 'object' && 'value' in value) return true;
      return false;
    })
    .map(([key, value]) => ({
      key,
      title: toTitleCase(key),
      value: value as ExtractedFieldData['value'],
    }));

  // Amount data
  const amountData = invoiceData.amount;
  const commentValue = invoiceData.comment ? String(invoiceData.comment) : '';

  return (
    <div className="space-y-4 p-4">
      {/* Document Info Section */}
      <DocumentInfoSection comment={commentValue} />

      {/* Key Information Section */}
      <KeyInformationSection
        invoiceData={invoiceData}
        documentType={documentType}
        onDocumentTypeChange={handleDocumentTypeChange}
        vendorName={invoiceData.vendorName?.value || ''}
        isEditingVendor={editingField === 'vendorName'}
        editedVendorValue={editedValues['vendorName'] || ''}
        isVendorEdited={editedFields.has('vendorName')}
        isSaving={isSaving}
        onStartEditVendor={() => handleStartEdit('vendorName', invoiceData.vendorName?.value || '')}
        onVendorValueChange={(value) => setEditedValues(prev => ({ ...prev, vendorName: value }))}
        onSaveVendor={() => handleSaveField('vendorName')}
        onCancelEditVendor={handleCancelEdit}
        onResetVendor={() => handleResetField('vendorName')}
        onVendorLookup={handleVendorContactLookup}
        caseLookup={caseLookup}
        onCaseNumberChange={(value) => setCaseLookup(prev => ({ ...prev, caseNumber: value }))}
        onCaseNumberSubmit={handleCaseNumberSubmit}
        aiExtractedPlaintiffName={aiExtractedPlaintiffName}
        plaintiffNameConfidence={invoiceData.clientName?.confidence}
        namesMatch={namesMatch}
        bothNamesPresent={bothNamesPresent}
        isRetryingPlaintiffName={isRetryingPlaintiffName}
        onRetryPlaintiffName={handleRetryPlaintiffName}
      />

      {/* Disbursement Section */}
      <DisbursementSection
        disbursement={disbursement}
        onTypeChange={handleDisbursementTypeChange}
        onStatusChange={(statusId) => setDisbursement(prev => ({ ...prev, selectedStatus: statusId }))}
      />

      {/* Extracted Fields List */}
      <ExtractedFieldsList
        fields={fieldsToRender}
        hoveredField={hoveredField}
        editingField={editingField}
        editedValues={editedValues}
        editedFields={editedFields}
        isSaving={isSaving}
        onFieldHover={onFieldHover}
        onStartEdit={handleStartEdit}
        onSaveField={handleSaveField}
        onCancelEdit={handleCancelEdit}
        onResetField={handleResetField}
        onEditValueChange={(key, value) => setEditedValues(prev => ({ ...prev, [key]: value }))}
      />

      {/* Amount Field */}
      <AmountField
        amountValue={amountData?.value}
        amountConfidence={amountData?.confidence}
        amountBbox={amountData?.bbox}
        hoveredField={hoveredField}
        isEditing={editingField === 'amount'}
        editedValue={editedValues['amount'] || ''}
        isEdited={editedFields.has('amount')}
        isSaving={isSaving}
        onFieldHover={onFieldHover}
        onStartEdit={() => handleStartEdit('amount', String(amountData?.value || ''))}
        onSaveField={() => handleSaveField('amount')}
        onCancelEdit={handleCancelEdit}
        onResetField={() => handleResetField('amount')}
        onValueChange={(value) => setEditedValues(prev => ({ ...prev, amount: value }))}
      />

      {/* Contact Lookup Dialog */}
      <ContactLookupDialog
        isOpen={contactLookup.isOpen}
        onOpenChange={(open) => setContactLookup(prev => ({ ...prev, isOpen: open }))}
        searchQuery={contactLookup.searchQuery}
        onSearchQueryChange={(query) => setContactLookup(prev => ({ ...prev, searchQuery: query }))}
        onSearch={() => searchContacts(contactLookup.searchQuery)}
        isSearching={contactLookup.isSearching}
        searchError={contactLookup.error}
        searchResults={contactLookup.results}
        onSelectContact={handleSelectContact}
        isSaving={isSaving}
      />
    </div>
  );
}
