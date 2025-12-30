'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfidenceBadge } from '@/components/invoice/confidence-badge';
import { cn } from '@/lib/utils/utils';
import { Loader2, Save, X, RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/invoice-utils';
import type { BoundingBox } from '@/lib/utils/bbox-utils';
import type { ExtractedFieldData } from './types';
import { toTitleCase, isValidBbox } from './utils';

interface ExtractedFieldsListProps {
  fields: ExtractedFieldData[];
  hoveredField: string | null;
  editingField: string | null;
  editedValues: Record<string, string>;
  editedFields: Set<string>;
  isSaving: boolean;
  onFieldHover: (field: string | null, bbox: BoundingBox | null, confidence: number | null) => void;
  onStartEdit: (key: string, currentValue: string) => void;
  onSaveField: (key: string) => void;
  onCancelEdit: () => void;
  onResetField: (key: string) => void;
  onEditValueChange: (key: string, value: string) => void;
}

export function ExtractedFieldsList({
  fields,
  hoveredField,
  editingField,
  editedValues,
  editedFields,
  isSaving,
  onFieldHover,
  onStartEdit,
  onSaveField,
  onCancelEdit,
  onResetField,
  onEditValueChange,
}: ExtractedFieldsListProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <>
      {/* Separator */}
      <div className="flex items-center gap-2 my-4">
        <div className="h-px flex-1 bg-border"></div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
          Extracted Data
        </Label>
        <div className="h-px flex-1 bg-border"></div>
      </div>

      <div className="rounded-md border overflow-hidden divide-y">
        {fields.map(({ key, title, value }, index) => {
          const confidence = value?.confidence;
          const reasoning = value?.reasoning;
          const hasBbox = isValidBbox(value?.bbox);
          const rawValue = value?.value ?? '';
          const isEditing = editingField === key;
          const isEdited = editedFields.has(key);
          const isAmountField = key === 'amount';
          const displayValue = isAmountField ? formatCurrency(rawValue) : String(rawValue);
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
                  onFieldHover(key, value.bbox, confidence ?? null);
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

              {/* Field Value */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={editedValues[key] || ''}
                    onChange={(e) => onEditValueChange(key, e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveField(key);
                      else if (e.key === 'Escape') onCancelEdit();
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
                    onClick={() => onStartEdit(key, String(rawValue))}
                  >
                    {displayValue || 'Not found'}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isEditing ? (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onSaveField(key)} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-green-600" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelEdit}>
                      <X className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <>
                    {isEdited ? (
                      <>
                        <Badge variant="outline" className="text-xs h-5 px-1.5 bg-amber-100 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-400">Edited</Badge>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onResetField(key)} title="Reset to extracted value">
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
    </>
  );
}
