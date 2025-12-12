'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfidenceBadge } from '@/components/invoice/confidence-badge';
import { cn } from '@/lib/utils/utils';
import type { BoundingBox } from '@/lib/utils/bbox-utils';
import type { StoredInvoice } from '@/lib/domain/types';

const toTitleCase = (str: string) => {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
};

interface FieldsListProps {
  invoiceData: StoredInvoice;
  hoveredField: string | null;
  onFieldHover: (field: string | null, bbox: BoundingBox | null, confidence: number | null) => void;
}

export function FieldsList({ invoiceData, hoveredField, onFieldHover }: FieldsListProps) {
  const renderField = (fieldValue: any) => {
    const value = fieldValue?.value;
    // Convert null/undefined to empty string for input components
    const safeValue = value === null || value === undefined ? '' : String(value);

    if (typeof value === 'string' && value.length > 100) {
      return <Textarea value={safeValue} readOnly rows={4} />;
    }
    const fieldType = typeof value === 'number' ? 'number' : 'text';
    return <Input value={safeValue} readOnly type={fieldType} />;
  };

  const validateAndSetBbox = (bbox: any, key: string, confidence?: number) => {
    if (bbox && Array.isArray(bbox) && bbox.length >= 4) {
      const isValid = bbox.every(p =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        !isNaN(p.x) &&
        !isNaN(p.y)
      );
      if (isValid) {
        onFieldHover(key, bbox, confidence || null);
      } else {
        console.warn(`Invalid bounding box for field ${key}:`, bbox);
      }
    }
  };

  // Flatten all fields except for lineItems, documentType, and internal/system fields
  const fieldsToRender = Object.entries(invoiceData)
    .filter(([key, value]) => {
      // Skip null values and excluded fields
      if (value === null) return false;
      const excludedFields = [
        'id', 
        'invoiceDataUri', 
        'status', 
        'isDuplicate', 
        'duplicateReason', 
        'lineItems', 
        'documentType',
        'isHighValue',
        'highValueReason',
        'requiresEscalation',
        'escalationLevel',
        'escalationReason',
        'caseNumber', // Case number is shown separately in the detail page
        'state', // State is auto-detected and shown separately
        'approvalStatus', // Approval status is internal, not shown to users
        'approvedBy',
        'approvedAt',
        'createdBy',
        'assignedTo',
        'isRecurring',
        'recurringPattern',
        'hasAmountAnomaly',
        'amountAnomalyReason',
        'expectedAmount',
        'amountDeviationPercent',
        'hasMultipleVendors',
        'accuracyScore',
        'requiresSpecialHandling',
        'specialHandlingReason',
        'vendorRequires1099',
        'comment', // Comment is shown separately
        'paymentType',
      ];
      return !excludedFields.includes(key);
    })
    .map(([key, value]) => ({ key, title: toTitleCase(key), value }));

  const lineItems = invoiceData.lineItems && Array.isArray(invoiceData.lineItems.value)
    ? invoiceData.lineItems.value
    : [];

  return (
    <div className="space-y-4">
      {fieldsToRender.map(({ key, title, value }) => {
        const confidence = value?.confidence;
        const reasoning = value?.reasoning;
        const hasBbox = value?.bbox && Array.isArray(value.bbox) && value.bbox.length >= 4;

        return (
          <div
            key={key}
            className={cn(
              "p-3 rounded-md transition-colors border",
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
            <div className="flex items-center justify-between mb-2">
              <Label className={cn('font-medium', hoveredField === key && 'text-green-600 dark:text-green-400')}>
                {title}
              </Label>
              {confidence !== undefined && (
                <div className="flex items-center gap-2">
                  <div
                    onMouseEnter={() => {
                      if (hasBbox) {
                        validateAndSetBbox(value.bbox, key, confidence);
                      }
                    }}
                    onMouseLeave={() => {
                      onFieldHover(null, null, null);
                    }}
                    className="cursor-pointer"
                  >
                    <ConfidenceBadge score={confidence} />
                  </div>
                  {hasBbox && (
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20"
                      onMouseEnter={() => {
                        validateAndSetBbox(value.bbox, key, confidence);
                      }}
                      onMouseLeave={() => {
                        onFieldHover(null, null, null);
                      }}
                    >
                      📍 Located
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1">
              {renderField(value)}
            </div>
            {reasoning && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                {reasoning}
              </p>
            )}
          </div>
        );
      })}

      {lineItems.length > 0 && invoiceData.lineItems && (
        <div
          className={cn(
            "p-3 rounded-md transition-colors border",
            hoveredField === 'lineItems'
              ? 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : 'border-border'
          )}
          onMouseEnter={() => {
            if (invoiceData.lineItems?.bbox) {
              validateAndSetBbox(
                invoiceData.lineItems.bbox,
                'lineItems',
                invoiceData.lineItems.confidence
              );
            }
          }}
          onMouseLeave={() => {
            onFieldHover(null, null, null);
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <Label className={cn('font-medium', hoveredField === 'lineItems' && 'text-green-600 dark:text-green-400')}>
              Line Items
            </Label>
            {invoiceData.lineItems.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <div
                  onMouseEnter={() => {
                    if (invoiceData.lineItems?.bbox) {
                      validateAndSetBbox(
                        invoiceData.lineItems.bbox,
                        'lineItems',
                        invoiceData.lineItems.confidence
                      );
                    }
                  }}
                  onMouseLeave={() => {
                    onFieldHover(null, null, null);
                  }}
                  className="cursor-pointer"
                >
                  <ConfidenceBadge score={invoiceData.lineItems.confidence} />
                </div>
                {invoiceData.lineItems.bbox && Array.isArray(invoiceData.lineItems.bbox) && invoiceData.lineItems.bbox.length >= 4 && (
                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20"
                    onMouseEnter={() => {
                      if (invoiceData.lineItems?.bbox) {
                        validateAndSetBbox(
                          invoiceData.lineItems.bbox,
                          'lineItems',
                          invoiceData.lineItems.confidence
                        );
                      }
                    }}
                    onMouseLeave={() => {
                      onFieldHover(null, null, null);
                    }}
                  >
                    📍 Located
                  </Badge>
                )}
              </div>
            )}
          </div>
          {invoiceData.lineItems.reasoning && (
            <p className="text-xs text-muted-foreground mb-2 italic">
              {invoiceData.lineItems.reasoning}
            </p>
          )}
          <div className="space-y-2 mt-1">
            {lineItems.map((item, index) => (
              <Card key={index} className="p-3 bg-muted/50">
                <div className="space-y-1">
                  {typeof item === 'object' && item !== null ?
                    Object.entries(item).map(([itemKey, itemValue]) => (
                      <div key={itemKey} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{toTitleCase(itemKey)}</span>
                        <span className="font-mono text-right">{String(itemValue)}</span>
                      </div>
                    ))
                  : <p>{String(item)}</p>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
