/**
 * Invoice store - backward compatibility layer
 * Re-exports from repository for backward compatibility
 * @deprecated Use repositories/invoice.repository.ts instead
 */

export {
  findAllInvoices as getInvoices,
  findInvoiceById as getInvoiceById,
  upsertInvoice as addInvoice,
  updateInvoiceStatus,
  checkForDuplicateInvoice,
} from './repositories/invoice.repository';
