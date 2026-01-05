/**
 * Types for Document Sync SSE (Server-Sent Events)
 * Shared between API route and client components
 */

export type SyncEventType = 
  | 'start'
  | 'progress'
  | 'document_processing'
  | 'document_complete'
  | 'document_skipped'
  | 'document_error'
  | 'page_complete'
  | 'complete'
  | 'error';

export interface SyncEventData {
  // Progress data
  currentDocument?: number;
  totalDocuments?: number;
  filteredDocuments?: number;
  processedDocuments?: number;
  successful?: number;
  failed?: number;
  skipped?: number;
  updated?: number;
  currentPage?: number;
  totalPages?: number;
  // Document data
  documentId?: number;
  documentName?: string;
  caseNumber?: string;
  status?: 'processing' | 'success' | 'error' | 'skipped';
  message?: string;
  error?: string;
  invoiceId?: string;
  isUpdate?: boolean;
}

export interface SyncEvent {
  type: SyncEventType;
  timestamp: string;
  data: SyncEventData;
}

