/**
 * State Detection Service
 * Detects state based on case number (CA = California, others = New York)
 */

import 'server-only';

export enum State {
  CALIFORNIA = 'CA',
  NEW_YORK = 'NY',
}

export interface StateDetectionResult {
  state: State;
  confidence: 'high' | 'medium' | 'low';
  method: 'case_number' | 'default';
}

class StateDetectionService {
  /**
   * Detect state from case number
   * If case number contains "CA", it's California, otherwise New York
   */
  detectState(caseNumber?: string | null): StateDetectionResult {
    if (!caseNumber || caseNumber.trim() === '') {
      // Default to New York if no case number
      return {
        state: State.NEW_YORK,
        confidence: 'low',
        method: 'default',
      };
    }

    const caseNumberUpper = caseNumber.toUpperCase();
    
    // Check if case number contains "CA"
    if (caseNumberUpper.includes('CA')) {
      return {
        state: State.CALIFORNIA,
        confidence: 'high',
        method: 'case_number',
      };
    }

    // Default to New York
    return {
      state: State.NEW_YORK,
      confidence: 'high',
      method: 'case_number',
    };
  }

  /**
   * Get state display name
   */
  getStateName(state: State): string {
    switch (state) {
      case State.CALIFORNIA:
        return 'California';
      case State.NEW_YORK:
        return 'New York';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get all available states
   */
  getAllStates(): State[] {
    return [State.CALIFORNIA, State.NEW_YORK];
  }
}

// Export singleton instance
export const stateDetectionService = new StateDetectionService();

