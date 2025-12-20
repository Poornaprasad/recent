"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from '@/lib/domain/types';

export type StateFilterValue = 'all' | 'CA' | 'NY';

export interface StateOption {
  value: StateFilterValue;
  label: string;
}

export const STATE_OPTIONS: StateOption[] = [
  { value: 'all', label: 'All States' },
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
];

interface StateFilterState {
  selectedState: StateFilterValue;
  setSelectedState: (state: StateFilterValue) => void;
  getStateLabel: () => string;
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
    }),
    {
      name: "state-filter-storage",
    }
  )
);

/**
 * Get states accessible to the user based on their role and assigned states
 */
export function getUserAccessibleStates(user: User | null): string[] {
  if (!user) return ['CA', 'NY'];
  
  // Elevated roles can see all states
  if (['admin', 'director', 'manager', 'senior_accountant'].includes(user.role)) {
    return ['CA', 'NY'];
  }
  
  // State accountants can see their state + assigned states
  const states: string[] = [];
  if (user.role === 'ny_accountant') {
    states.push('NY');
  } else if (user.role === 'ca_accountant') {
    states.push('CA');
  }
  
  // Add assigned states
  if (user.assignedStates) {
    user.assignedStates.forEach(state => {
      if (!states.includes(state)) {
        states.push(state);
      }
    });
  }
  
  return states;
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
 * For multi-state users, returns the selected state
 */
export function getEffectiveStateFilter(user: User | null, selectedState: StateFilterValue): StateFilterValue {
  const accessibleStates = getUserAccessibleStates(user);
  
  // If user has only one accessible state, use that
  if (accessibleStates.length === 1) {
    return accessibleStates[0] as StateFilterValue;
  }
  
  // For multi-state users, return the selected state
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
