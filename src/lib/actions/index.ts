/**
 * Server actions index
 * Re-export all server actions from a single entry point
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
  updateInvoiceFieldAction,
  updateInvoiceDisbursementResponseAction,
  updateInvoiceCrmStatusAction,
  retryPlaintiffNameAction,
  canApproveInvoiceAction,
} from './invoice.actions';

export {
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
  getVendorInvoicesFor1099Action,
  updateVendor1099StatusAction,
} from './vendor.actions';

export {
  getPendingVendorsAction,
  getPendingVendorByIdAction,
  getPendingVendorByInvoiceIdAction,
  completeVendorSetupAction,
  rejectPendingVendorAction,
} from './pending-vendor.actions';

export {
  getDashboardStatsAction,
  getDashboardTimeComparisonAction,
  getDuplicateAlertsAction,
  getOcrConfidenceDataAction,
  getInvoiceUrgencyDataAction,
} from './dashboard.actions';

export {
  getUsersAction,
  getUserByIdAction,
  createUserAction,
  updateUserAction,
  deleteUserAction,
  getUsersByRoleAction,
} from './user.actions';

export {
  getAllAuditLogsAction,
} from './audit.actions';

export {
  fetchDisbursementTypesAction,
  fetchDisbursementStatusesAction,
  getPreviousDisbursementTypeAction,
  getPreviousDisbursementTypeForVendorAction,
  saveDisbursementTypeMappingAction,
  getDisbursementTypesForVendorAction,
  createDisbursementAction,
  checkCaseForDuplicatesAction,
  type DuplicateCheckResult,
} from './disbursement-type.actions';

export {
  fetchContactTypesAction,
} from './contact-type.actions';

export {
  lookupCaseInfoAction,
  getCaseInfoAction,
} from './case.actions';

export {
  lookupContactsAction,
} from './contact.actions';

