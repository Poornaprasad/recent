/**
 * ExtractedDataPanel Component
 *
 * This component has been refactored into smaller, focused components.
 * See src/components/invoice/extracted-data-panel/ for the implementation.
 *
 * Components:
 * - ExtractedDataPanel (main orchestrating component)
 * - DocumentInfoSection (collapsible document info/comments)
 * - KeyInformationSection (document type, vendor, case number, plaintiff)
 * - DisbursementSection (disbursement type and status selectors)
 * - ExtractedFieldsList (editable extracted data fields)
 * - AmountField (prominent amount display/edit)
 * - ContactLookupDialog (vendor contact CRM lookup)
 */

export { ExtractedDataPanel } from './extracted-data-panel/index';
export type { ExtractedDataPanelProps } from './extracted-data-panel/types';
