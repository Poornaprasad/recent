'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfidenceBadge } from '@/components/invoice/confidence-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/utils';
import { Search, Loader2, AlertTriangle, CheckCircle2, Save, X, RotateCcw } from 'lucide-react';
import { getDocumentTypeBadgeClass } from '@/lib/utils/document-type-utils';
import type { DocumentType, StoredInvoice } from '@/lib/domain/types';
import type { CaseLookupState } from './types';
import { DOCUMENT_TYPES } from './types';

interface KeyInformationSectionProps {
  // Invoice data
  invoiceData: StoredInvoice;

  // Document type
  documentType: DocumentType | undefined;
  onDocumentTypeChange: (type: DocumentType) => void;

  // Vendor name editing
  vendorName: string;
  isEditingVendor: boolean;
  editedVendorValue: string;
  isVendorEdited: boolean;
  isSaving: boolean;
  onStartEditVendor: () => void;
  onVendorValueChange: (value: string) => void;
  onSaveVendor: () => void;
  onCancelEditVendor: () => void;
  onResetVendor: () => void;
  onVendorLookup: () => void;

  // Case number
  caseLookup: CaseLookupState;
  onCaseNumberChange: (value: string) => void;
  onCaseNumberSubmit: () => void;

  // Plaintiff name comparison
  aiExtractedPlaintiffName: string;
  plaintiffNameConfidence?: number;
  namesMatch: boolean;
  bothNamesPresent: boolean;
  isRetryingPlaintiffName: boolean;
  onRetryPlaintiffName: () => void;
}

export function KeyInformationSection({
  invoiceData,
  documentType,
  onDocumentTypeChange,
  vendorName,
  isEditingVendor,
  editedVendorValue,
  isVendorEdited,
  isSaving,
  onStartEditVendor,
  onVendorValueChange,
  onSaveVendor,
  onCancelEditVendor,
  onResetVendor,
  onVendorLookup,
  caseLookup,
  onCaseNumberChange,
  onCaseNumberSubmit,
  aiExtractedPlaintiffName,
  plaintiffNameConfidence,
  namesMatch,
  bothNamesPresent,
  isRetryingPlaintiffName,
  onRetryPlaintiffName,
}: KeyInformationSectionProps) {
  const caseSearchSuccessful = caseLookup.status === 'success';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-border"></div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
          Key Information
        </Label>
        <div className="h-px flex-1 bg-border"></div>
      </div>

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
            <Select value={documentType} onValueChange={(v) => onDocumentTypeChange(v as DocumentType)}>
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

        {/* Vendor Name */}
        <div className={cn(
          'p-2.5 rounded-lg border transition-colors',
          isEditingVendor
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : isVendorEdited
            ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10'
            : 'border-border bg-card'
        )}>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Vendor Name
          </Label>
          <div className="flex items-center gap-1.5">
            {isEditingVendor ? (
              <Input
                value={editedVendorValue}
                onChange={(e) => onVendorValueChange(e.target.value)}
                className="h-8 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveVendor();
                  else if (e.key === 'Escape') onCancelEditVendor();
                }}
              />
            ) : (
              <span
                className="text-sm font-medium flex-1 truncate cursor-pointer"
                title={vendorName || 'Not found'}
                onClick={onStartEditVendor}
              >
                {vendorName || 'Not found'}
              </span>
            )}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isEditingVendor ? (
                <>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSaveVendor} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-green-600" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelEditVendor}>
                    <X className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </>
              ) : (
                <>
                  {isVendorEdited && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onResetVendor} title="Reset to extracted value">
                      <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-amber-600" />
                    </Button>
                  )}
                  {vendorName && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onVendorLookup}
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
          {isVendorEdited && !isEditingVendor && (
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
              value={caseLookup.caseNumber}
              onChange={(e) => onCaseNumberChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCaseNumberSubmit();
                }
              }}
              placeholder="Enter case number..."
              disabled={caseLookup.isSubmitting}
              className="h-8 text-sm flex-1"
            />
            <Button
              type="button"
              onClick={onCaseNumberSubmit}
              disabled={caseLookup.isSubmitting || !caseLookup.caseNumber.trim()}
              size="icon"
              className="h-8 w-8 flex-shrink-0"
            >
              {caseLookup.isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Plaintiff Name */}
        <div
          className={cn(
            'p-2.5 rounded-lg border transition-colors',
            caseLookup.status === 'error'
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
            {caseLookup.status === 'error' ? (
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
              {plaintiffNameConfidence !== undefined && (
                <ConfidenceBadge score={plaintiffNameConfidence} />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Case:</span>
              <span
                className={cn(
                  'text-xs font-medium truncate flex-1',
                  caseLookup.status === 'error' ? 'text-red-600 dark:text-red-400' : ''
                )}
                title={caseLookup.plaintiffName || 'Search case number first'}
              >
                {caseLookup.status === 'error'
                  ? 'Error'
                  : caseLookup.status === 'loading'
                  ? 'Searching...'
                  : caseLookup.plaintiffName || 'Not searched'}
              </span>
            </div>
          </div>
          {caseLookup.status === 'error' && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 truncate" title={caseLookup.error}>
              {caseLookup.error || 'Lookup failed'}
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
                onClick={onRetryPlaintiffName}
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
  );
}
