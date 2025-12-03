'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  placeholder?: string;
  options: FilterOption[];
  width?: string;
}

export interface TableFiltersProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: {
    value: string;
    onChange: (value: string) => void;
    config: FilterConfig;
  }[];
  rowsPerPage?: number;
  onRowsPerPageChange?: (value: number) => void;
}

export function TableFilters({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  filters = [],
  rowsPerPage,
  onRowsPerPageChange,
}: TableFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      {filters.map((filter, index) => (
        <Select key={index} value={filter.value} onValueChange={filter.onChange}>
          <SelectTrigger className={filter.config.width || 'w-[150px]'}>
            <SelectValue placeholder={filter.config.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {filter.config.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {rowsPerPage && onRowsPerPageChange && (
        <Select value={rowsPerPage.toString()} onValueChange={(value) => onRowsPerPageChange(Number(value))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
