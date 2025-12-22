"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from '@/lib/domain/types';

export type StateFilterValue = 'all' | 'CA' | 'NY';
// DocumentTypeFilterValue is a string to support all document types across different pages
// Common values: 'all', 'Invoice', 'Receipt', but can be any document type string
export type DocumentTypeFilterValue = string;

export interface StateOption {
  value: StateFilterValue;
  label: string;
}

export interface DocumentTypeOption {
  value: DocumentTypeFilterValue;
  label: string;
}

export const STATE_OPTIONS: StateOption[] = [
  { value: 'all', label: 'All States' },
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
];

export const DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  { value: 'all', label: 'All Types' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Receipt', label: 'Receipt' },
];

interface StateFilterState {
  selectedState: StateFilterValue;
  setSelectedState: (state: StateFilterValue) => void;
  getStateLabel: () => string;
  documentType: DocumentTypeFilterValue;
  setDocumentType: (type: DocumentTypeFilterValue) => void;
  getDocumentTypeLabel: () => string;
}

export const useStateFilter = create<StateFilterState>()(
  persist(
    (set, get) => ({
      selectedState: 'all',
      setSelectedState: (selectedState) => set({ selectedState }),
      getStateLabel: () => {
        const state = get();
        const option = STATE_OPTIONS.find(opt => opt.value === state.selectedState);
        return option?.label || 'All States';
      },
      documentType: 'all',
      setDocumentType: (documentType) => set({ documentType }),
      getDocumentTypeLabel: () => {
        const state = get();
        const option = DOCUMENT_TYPE_OPTIONS.find(opt => opt.value === state.documentType);
        // If not found in common options, return the value itself (for extended document types)
        return option?.label || (state.documentType === 'all' ? 'All Types' : state.documentType);
      },
    }),
    {
      name: "state-filter-storage",
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // If version is 0 or undefined, or state is invalid, reset to defaults
        if (version === 0 || version === undefined || !persistedState) {
          return {
            selectedState: 'all',
            documentType: 'all',
          };
        }
        
        // Ensure required fields exist with valid defaults
        return {
          selectedState: persistedState.selectedState || 'all',
          documentType: persistedState.documentType || 'all',
        };
      },
    }
  )
);

/**
 * Get states accessible to the user based on their role and assigned states
 * Returns primary and secondary states in order
 */
export function getUserAccessibleStates(user: User | null): string[] {
  if (!user) return ['CA', 'NY'];
  
  // Elevated roles can see all states
  if (['admin', 'director', 'manager', 'senior_accountant'].includes(user.role)) {
    return ['CA', 'NY'];
  }
  
  // State accountants can see their state + assigned states
  const states: string[] = [];
  
  // Parse assignedStates - first is primary, second is secondary
  let primaryState: string | null = null;
  let secondaryState: string | null = null;
  
  if (user.assignedStates) {
    try {
      const parsed = typeof user.assignedStates === 'string' 
        ? JSON.parse(user.assignedStates) 
        : user.assignedStates;
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        primaryState = parsed[0];
        if (parsed.length > 1) {
          secondaryState = parsed[1];
        }
      }
    } catch {
      // If parsing fails, treat as single state or use role default
    }
  }
  
  // For NY/CA accountants, use assigned states or role default
  if (user.role === 'ny_accountant') {
    if (primaryState) {
      states.push(primaryState);
      if (secondaryState) states.push(secondaryState);
    } else {
      // Default: NY is primary
      states.push('NY');
    }
  } else if (user.role === 'ca_accountant') {
    if (primaryState) {
      states.push(primaryState);
      if (secondaryState) states.push(secondaryState);
    } else {
      // Default: CA is primary
      states.push('CA');
    }
  }
  
  return states;
}

/**
 * Get primary state for a user
 */
export function getUserPrimaryState(user: User | null): string | null {
  const states = getUserAccessibleStates(user);
  return states.length > 0 ? states[0] : null;
}

/**
 * Get secondary state for a user
 */
export function getUserSecondaryState(user: User | null): string | null {
  const states = getUserAccessibleStates(user);
  return states.length > 1 ? states[1] : null;
}

/**
 * Check if user can access multiple states
 */
export function hasMultiStateAccess(user: User | null): boolean {
  return getUserAccessibleStates(user).length > 1;
}

/**
 * Determine if state filter dropdown should be shown
 */
export function shouldShowStateFilter(user: User | null): boolean {
  return hasMultiStateAccess(user);
}

/**
 * Get filtered state options for the user (only states they can access)
 */
export function getStateOptionsForUser(user: User | null): StateOption[] {
  const accessibleStates = getUserAccessibleStates(user);
  
  // If user has access to all states, return all options
  if (accessibleStates.length === 2 && accessibleStates.includes('CA') && accessibleStates.includes('NY')) {
    return STATE_OPTIONS;
  }
  
  // Filter options to only accessible states
  return STATE_OPTIONS.filter(option => 
    option.value === 'all' || accessibleStates.includes(option.value)
  );
}

/**
 * Check if user has both primary and secondary states
 */
export function hasPrimaryAndSecondaryStates(user: User | null): boolean {
  const states = getUserAccessibleStates(user);
  return states.length === 2;
}

/**
 * Get the opposite state for switching (if user has access to both)
 */
export function getOppositeState(user: User | null, currentState: StateFilterValue): StateFilterValue | null {
  if (!user || currentState === 'all') return null;
  
  const accessibleStates = getUserAccessibleStates(user);
  if (accessibleStates.length !== 2) return null;
  
  const opposite = accessibleStates.find(state => state !== currentState);
  return opposite ? (opposite as StateFilterValue) : null;
}

/**
 * Get display name for a state code
 */
export function getStateDisplayName(state: string): string {
  switch (state) {
    case 'CA':
      return 'California';
    case 'NY':
      return 'New York';
    default:
      return state;
  }
}

/**
 * Get effective state filter for a user
 * For single-state users, returns their only accessible state
 * For multi-state users, returns the selected state (or 'all' if not set)
 */
export function getEffectiveStateFilter(user: User | null, selectedState: StateFilterValue): StateFilterValue {
  const accessibleStates = getUserAccessibleStates(user);
  
  // If user has only one accessible state, use that
  if (accessibleStates.length === 1) {
    return accessibleStates[0] as StateFilterValue;
  }
  
  // For multi-state users, validate selected state is accessible
  if (selectedState !== 'all' && accessibleStates.includes(selectedState)) {
    return selectedState;
  }
  
  // Default to primary state if selected state is not accessible
  if (accessibleStates.length > 0) {
    return accessibleStates[0] as StateFilterValue;
  }
  
  return selectedState;
}

/**
 * Helper function to filter invoices by state
 * Can be used in both client and server-side code
 */
export function filterByState<T extends { state?: string | null }>(
  items: T[],
  stateFilter: StateFilterValue
): T[] {
  if (stateFilter === 'all') {
    return items;
  }
  return items.filter(item => item.state === stateFilter);
}
