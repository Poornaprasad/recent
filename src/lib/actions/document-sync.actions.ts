/**
 * Document sync server actions
 * Next.js server actions for syncing documents from SmartAdvocate
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  getDocumentsByDate,
  getDocumentContent,
  extractDocumentMetadata,
  filterDocumentsByCategory,
} from '../crm/smartadvocate/document';
import { mapSmartAdvocateDocumentToInvoice } from '../utils/smartadvocate-mapper';
import { getConfig } from '../crm/smartadvocate/utils';
import { processInvoiceAction } from './invoice.actions';
import { withActionHandler, type ActionResult } from '../utils/action-wrapper';
import type { SmartAdvocateDocument } from '../crm/smartadvocate/types';
import { findInvoiceByDocumentHash } from '../repositories/invoice.repository';
import { createDocumentSyncError } from '../repositories/document-sync-error.repository';
import {
  syncDocumentsCore,
  getYesterdayDateRange,
  type DocumentSyncResult,
  type DocumentProcessor,
} from '../services/document-sync.service';

/**
 * Sync documents from SmartAdvocate API
 * Fetches documents by date range, filters by category (Invoices/Receipts),
 * and processes each document through the invoice processing flow
 * @param options Sync options (fromDate, toDate, categoryIDs)
 */
export async function syncDocumentsFromSmartAdvocate(
  options?: {
    fromDate?: string;
    toDate?: string;
    categoryIDs?: number[];
  }
): Promise<ActionResult<DocumentSyncResult>> {
  return withActionHandler(async () => {
    const config = getConfig();

    // Get date range from options or environment variables
    // If not provided, use yesterday's range
    let fromDate = options?.fromDate || config.SA_DOCUMENT_SYNC_FROM_DATE;
    let toDate = options?.toDate || config.SA_DOCUMENT_SYNC_TO_DATE;

    // If still no date range, use yesterday's range for auto-sync
    if (!fromDate || !toDate) {
      const dateRange = getYesterdayDateRange();
      fromDate = dateRange.fromDate;
      toDate = dateRange.toDate;
      console.log(`[Document Sync] Using default yesterday range: ${fromDate} to ${toDate}`);
    }

    // Default category IDs: 78 (Invoices) and 1080 (Receipts)
    const categoryIDs = options?.categoryIDs || [78, 1080];
    const pageSize = config.SA_DOCUMENT_SYNC_PAGE_SIZE || 100;

    // Create document processor for server actions
    const processor: DocumentProcessor = {
      getDocumentsByDate,
      getDocumentContent,
      findInvoiceByDocumentHash: async (hash: string) => {
        const invoice = await findInvoiceByDocumentHash(hash);
        if (!invoice) return null;
        return {
          id: invoice.id,
          status: invoice.status,
          saModifiedDate: invoice.saModifiedDate,
        };
      },
      processDocument: async (doc: SmartAdvocateDocument, content) => {
        const metadata = extractDocumentMetadata(doc);
        const saMetadata = mapSmartAdvocateDocumentToInvoice(doc);

        return await processInvoiceAction({
          invoiceDataUri: content.dataUri,
          caseNumber: metadata.caseNumber,
          documentID: metadata.documentID,
          description: metadata.description || undefined,
          comment: metadata.comments || undefined,
          smartAdvocateMetadata: saMetadata,
        });
      },
      createSyncError: async ({ documentID, error, errorType, doc, contentType, fileSize }) => {
        await createDocumentSyncError({
          documentID,
          error,
          errorType,
          caseID: doc.caseID,
          caseNumber: doc.caseNumber,
          documentName: doc.documentName,
          contentType,
          fileSize,
          categoryID: doc.categoryID,
          categoryName: doc.categoryName,
          subCategoryID: doc.subCategoryID,
          subCategoryName: doc.subCategoryName,
          subSubCategoryID: doc.subSubCategoryID,
          subSubSubCategoryID: doc.subSubSubCategoryID,
          description: doc.description,
          comments: doc.comments,
          createdDate: doc.createdDate ? new Date(doc.createdDate) : undefined,
          modifiedDate: doc.modifiedDate ? new Date(doc.modifiedDate) : undefined,
          saFromUniqueContactId: doc.fromUniqueContactID,
          saToContactName: doc.toContactName,
          saFromContactName: doc.fromContactName,
          saDocType: doc.docType,
          saTemplateId: doc.templateID,
          saAttachFlag: doc.attachFlag,
          saCreatedUserId: doc.createdUserID,
          saModifiedUserId: doc.modifiedUserID,
          saMedProvUniqueContactId: doc.medProvUniqueContactID,
          saIsReviewed: doc.isReviewed,
          saToUniqueContactId: doc.toUniqueContactID,
          saDocumentDate: doc.documentDate ? new Date(doc.documentDate) : undefined,
          saPriority: doc.priority,
          saPriorityName: doc.priorityName,
          saDocumentDirection: doc.documentDirection,
          saDirectionName: doc.directionName,
          saDocumentOrigin: doc.documentOrigin,
          saOriginName: doc.originName,
          saIsSharedInPortal: doc.isSharedInPortal,
          saIsSharedWithEveryoneInPortal: doc.isSharedWithEveryoneInPortal,
          saCaseDocumentId: doc.caseDocumentID,
          saDeliveryMethodId: (doc as any).deliveryMethodId,
          saDeliveryName: (doc as any).deliveryName,
        });
      },
    };

    // Run the core sync logic
    const result = await syncDocumentsCore(
      {
        fromDate,
        toDate,
        categoryIDs,
        pageSize,
      },
      processor,
      console.log
    );

    // Revalidate paths after sync
    revalidatePath('/invoices');
    revalidatePath('/approvals');
    revalidatePath('/dashboard');

    return result;
  }, 'Failed to sync documents from SmartAdvocate');
}

/**
 * Get documents metadata from SmartAdvocate (without processing)
 * Useful for previewing what documents would be synced
 */
export async function previewDocumentsFromSmartAdvocate(
  options?: {
    fromDate?: string;
    toDate?: string;
    categoryIDs?: number[];
    maxPages?: number;
  }
): Promise<ActionResult<{ documents: Array<ReturnType<typeof extractDocumentMetadata>>; totalPages: number }>> {
  return withActionHandler(async () => {
    const config = getConfig();

    // Get date range from options or environment variables
    const fromDate = options?.fromDate || config.SA_DOCUMENT_SYNC_FROM_DATE;
    const toDate = options?.toDate || config.SA_DOCUMENT_SYNC_TO_DATE;

    if (!fromDate || !toDate) {
      throw new Error(
        'Date range not provided. Set SA_DOCUMENT_SYNC_FROM_DATE and SA_DOCUMENT_SYNC_TO_DATE in .env or provide fromDate/toDate in options.'
      );
    }

    // Default category IDs: 78 (Invoices) and 1080 (Receipts)
    const categoryIDs = options?.categoryIDs || [78, 1080];
    const maxPages = options?.maxPages ?? 1;

    const allDocuments: SmartAdvocateDocument[] = [];
    let currentPage = 0;
    const pageSize = config.SA_DOCUMENT_SYNC_PAGE_SIZE || 1000;

    // Fetch pages
    while (currentPage < maxPages) {
      const response = await getDocumentsByDate({
        modifiedFromDateTime: fromDate,
        modifiedToDateTime: toDate,
        currentPage,
        pageSize,
      });

      allDocuments.push(...(response.documents || []));

      const totalPages = response.pageRequest?.totalPages ?? 0;
      if (currentPage >= totalPages - 1) {
        break;
      }
      currentPage++;
    }

    // Filter documents by category
    const filteredDocs = filterDocumentsByCategory(allDocuments, categoryIDs);

    // Extract metadata
    const documents = filteredDocs.map(extractDocumentMetadata);

    return {
      documents,
      totalPages: Math.ceil((allDocuments.length || 0) / 100),
    };
  }, 'Failed to preview documents from SmartAdvocate');
}

