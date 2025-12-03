/**
 * @deprecated Use actions/index.ts instead
 * This file is kept for backward compatibility
 * Note: This file does not have 'use server' because it's just re-exporting.
 * The actual server actions are in actions/invoice.actions.ts
 */

export {
  processInvoiceAction,
  getInvoiceByIdAction,
  getInvoiceDataUriAction,
  updateInvoiceStatusAction,
  getInvoicesAction,
  flagInvoiceForReviewAction,
  addInvoiceCommentAction,
  updateInvoiceCaseNumberAction,
  getVendorsAction,
  getVendorByIdAction,
  getVendorByNameAction,
  getSuggestedVendorTypesAction,
  saveVendorAction,
  deleteVendorAction,
  getVendorTypesAction,
  createVendorTypeAction,
  checkVendorExistsAction,
  syncVendorTypesFromCrmAction,
  getPendingVendorsAction,
  getPendingVendorByIdAction,
  getPendingVendorByInvoiceIdAction,
  completeVendorSetupAction,
  rejectPendingVendorAction,
  getDashboardStatsAction,
  getDashboardTimeComparisonAction,
  getDuplicateAlertsAction,
  getOcrConfidenceDataAction,
  getInvoiceUrgencyDataAction,
} from './actions/index';
