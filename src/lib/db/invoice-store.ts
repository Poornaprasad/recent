/**
 * @deprecated This file is deprecated. Use lib/repositories/invoice.repository.ts instead
 * Kept for backward compatibility only
 */

import 'server-only';

// Re-export from repository for backward compatibility
export {
  findAllInvoices as getInvoices,
  findInvoiceById as getInvoiceById,
  upsertInvoice as addInvoice,
  updateInvoiceStatus,
  checkForDuplicateInvoice,
} from '../repositories/invoice.repository';
