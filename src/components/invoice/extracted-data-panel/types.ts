/**
 * Shared types for ExtractedDataPanel components
 */

import type { BoundingBox } from '@/lib/utils/bbox-utils';
import type { StoredInvoice, DocumentType } from '@/lib/domain/types';

export interface DisbursementOption {
  id: number;
  description: string;
}

export interface ExtractedDataPanelProps {
  invoiceData: StoredInvoice;
  hoveredField: string | null;
  onFieldHover: (field: string | null, bbox: BoundingBox | null, confidence: number | null) => void;
  onInvoiceUpdate: (updatedInvoice: StoredInvoice) => void;
  onDocumentTypeChange?: (documentType: DocumentType) => void;
  onValidationChange?: (isValid: boolean, missingFields: string[]) => void;
}

export interface EditableFieldState {
  editingField: string | null;
  editedValues: Record<string, string>;
  editedFields: Set<string>;
  isSaving: boolean;
}

export interface CaseLookupState {
  caseNumber: string;
  isSubmitting: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string;
  plaintiffName: string;
}

export interface DisbursementState {
  types: DisbursementOption[];
  statuses: DisbursementOption[];
  selectedType: string;
  selectedStatus: string;
  isLoadingTypes: boolean;
  isLoadingStatuses: boolean;
}

export interface ExtractedFieldData {
  key: string;
  title: string;
  value: {
    value: any;
    confidence?: number;
    bbox?: any;
    reasoning?: string;
  };
}

// Document types available for selection
export const DOCUMENT_TYPES: DocumentType[] = [
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

// Fields excluded from the extracted fields list
export const EXCLUDED_FIELDS = [
  'id', 'invoiceDataUri', 'status', 'isDuplicate', 'duplicateReason',
  'lineItems', 'documentType', 'isHighValue', 'highValueReason',
  'requiresEscalation', 'escalationLevel', 'escalationReason',
  'caseNumber', 'state', 'approvalStatus', 'approvedBy', 'approvedAt',
  'createdBy', 'assignedTo', 'isRecurring', 'recurringPattern',
  'hasAmountAnomaly', 'amountAnomalyReason', 'expectedAmount',
  'amountDeviationPercent', 'hasMultipleVendors', 'accuracyScore',
  'requiresSpecialHandling', 'specialHandlingReason', 'vendorRequires1099',
  'comment', 'description', 'paymentType', 'clientName', 'customerName',
  'totalAmount', 'amount', 'vendorName',
];
