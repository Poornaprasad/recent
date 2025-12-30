'use client';

import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { cn } from '@/lib/utils/utils';
import type { DisbursementState } from './types';

interface DisbursementSectionProps {
  disbursement: DisbursementState;
  onTypeChange: (typeId: string) => void;
  onStatusChange: (statusId: string) => void;
}

export function DisbursementSection({
  disbursement,
  onTypeChange,
  onStatusChange,
}: DisbursementSectionProps) {
  const typeOptions: ComboboxOption[] = disbursement.types.map(t => ({
    value: String(t.id),
    label: t.description,
    id: t.id,
  }));

  const statusOptions: ComboboxOption[] = disbursement.statuses.map(s => ({
    value: String(s.id),
    label: s.description,
    id: s.id,
  }));

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {/* Disbursement Type */}
      <div className={cn(
        'p-2.5 rounded-lg border transition-colors',
        !disbursement.selectedType ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
      )}>
        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Disbursement Type<span className="text-destructive ml-0.5">*</span>
        </Label>
        <Combobox
          options={typeOptions}
          value={disbursement.selectedType}
          onValueChange={onTypeChange}
          placeholder="Select type..."
          searchPlaceholder="Search types..."
          emptyText="No type found."
          isLoading={disbursement.isLoadingTypes}
          triggerClassName="h-8 text-sm"
        />
      </div>

      {/* Disbursement Status */}
      <div className={cn(
        'p-2.5 rounded-lg border transition-colors',
        !disbursement.selectedStatus ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
      )}>
        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Disbursement Status<span className="text-destructive ml-0.5">*</span>
        </Label>
        <Combobox
          options={statusOptions}
          value={disbursement.selectedStatus}
          onValueChange={onStatusChange}
          placeholder="Select status..."
          searchPlaceholder="Search statuses..."
          emptyText="No status found."
          isLoading={disbursement.isLoadingStatuses}
          triggerClassName="h-8 text-sm"
        />
      </div>
    </div>
  );
}
