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
import { isValidBbox } from './utils';

interface AmountFieldProps {
  amountValue: any;
  amountConfidence?: number;
  amountBbox?: any;
  hoveredField: string | null;
  isEditing: boolean;
  editedValue: string;
  isEdited: boolean;
  isSaving: boolean;
  onFieldHover: (field: string | null, bbox: BoundingBox | null, confidence: number | null) => void;
  onStartEdit: () => void;
  onSaveField: () => void;
  onCancelEdit: () => void;
  onResetField: () => void;
  onValueChange: (value: string) => void;
}

export function AmountField({
  amountValue,
  amountConfidence,
  amountBbox,
  hoveredField,
  isEditing,
  editedValue,
  isEdited,
  isSaving,
  onFieldHover,
  onStartEdit,
  onSaveField,
  onCancelEdit,
  onResetField,
  onValueChange,
}: AmountFieldProps) {
  const hasBbox = isValidBbox(amountBbox);

  return (
    <div
      className={cn(
        'p-3 rounded-md border transition-colors cursor-pointer',
        hoveredField === 'amount'
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
          : isEdited
          ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-300'
          : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
      )}
      onMouseEnter={() => {
        if (hasBbox) {
          onFieldHover('amount', amountBbox, amountConfidence ?? null);
        }
      }}
      onMouseLeave={() => onFieldHover(null, null, null)}
    >
      <div className="flex items-center gap-3">
        <Label className="font-medium text-sm flex-shrink-0 w-32 text-emerald-700 dark:text-emerald-400">Amount</Label>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editedValue}
              onChange={(e) => onValueChange(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveField();
                else if (e.key === 'Escape') onCancelEdit();
              }}
            />
          ) : (
            <span
              className="text-lg font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
              onClick={onStartEdit}
            >
              {formatCurrency(amountValue)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isEditing ? (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSaveField} disabled={isSaving}>
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
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onResetField} title="Reset to extracted value">
                    <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-amber-600" />
                  </Button>
                </>
              ) : (
                <>
                  {amountConfidence !== undefined && amountConfidence !== null && <ConfidenceBadge score={amountConfidence} />}
                  {hasBbox && (
                    <Badge variant="outline" className="text-xs h-5 px-1.5 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300">Located</Badge>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
