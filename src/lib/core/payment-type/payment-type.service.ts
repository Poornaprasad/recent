/**
 * Payment Type Service
 * Categorizes documents by payment type (Receipt, Invoice, Non-Financial, Other)
 * State-specific categorization
 */

import 'server-only';

import { State } from '../state/state-detection.service';

export enum PaymentType {
  RECEIPT = 'Receipt',
  INVOICE = 'Invoice',
  NON_FINANCIAL = 'Non-Financial',
  OTHER = 'Other',
}

export interface PaymentTypeCategory {
  type: PaymentType;
  description: string;
  state: State;
  workflow?: string; // Optional workflow identifier
}

class PaymentTypeService {
  /**
   * Detect payment type from document data
   * This is a basic implementation - can be enhanced with ML/AI
   */
  detectPaymentType(
    documentType: string | undefined,
    totalAmount: number | null | undefined,
    state: State
  ): PaymentType {
    // If document type is already classified
    if (documentType) {
      const docTypeLower = documentType.toLowerCase();
      
      if (docTypeLower.includes('receipt')) {
        return PaymentType.RECEIPT;
      }
      
      if (docTypeLower.includes('invoice')) {
        return PaymentType.INVOICE;
      }
      
      if (docTypeLower.includes('reimbursement')) {
        return PaymentType.RECEIPT; // Reimbursements are receipts
      }
      
      if (docTypeLower.includes('credit card bill')) {
        return PaymentType.INVOICE; // Credit card bills are invoices
      }
    }

    // If no amount or zero amount, might be non-financial
    if (!totalAmount || totalAmount === 0) {
      return PaymentType.NON_FINANCIAL;
    }

    // Default to Invoice if amount is positive
    if (totalAmount > 0) {
      return PaymentType.INVOICE;
    }

    // Negative amount might be a receipt (refund, credit)
    if (totalAmount < 0) {
      return PaymentType.RECEIPT;
    }

    return PaymentType.OTHER;
  }

  /**
   * Get payment type categories for a state
   */
  getPaymentTypeCategories(state: State): PaymentTypeCategory[] {
    const baseCategories: PaymentTypeCategory[] = [
      {
        type: PaymentType.RECEIPT,
        description: 'Payment received or refund issued',
        state,
      },
      {
        type: PaymentType.INVOICE,
        description: 'Payment due or bill to be paid',
        state,
      },
      {
        type: PaymentType.NON_FINANCIAL,
        description: 'Non-financial document received by mistake',
        state,
      },
      {
        type: PaymentType.OTHER,
        description: 'Other or uncategorized document',
        state,
      },
    ];

    // State-specific customizations can be added here
    if (state === State.CALIFORNIA) {
      // California-specific categories
      return baseCategories;
    } else if (state === State.NEW_YORK) {
      // New York-specific categories
      return baseCategories;
    }

    return baseCategories;
  }

  /**
   * Get payment type display name
   */
  getPaymentTypeName(type: PaymentType): string {
    return type;
  }

  /**
   * Get payment type description
   */
  getPaymentTypeDescription(type: PaymentType, state: State): string {
    const categories = this.getPaymentTypeCategories(state);
    const category = categories.find(c => c.type === type);
    return category?.description || type;
  }

  /**
   * Check if payment type requires approval
   */
  requiresApproval(type: PaymentType): boolean {
    // Non-financial documents might not need approval
    if (type === PaymentType.NON_FINANCIAL) {
      return false;
    }

    // Receipts and Invoices require approval
    return true;
  }
}

// Export singleton instance
export const paymentTypeService = new PaymentTypeService();

