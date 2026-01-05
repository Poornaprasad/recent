"use client";

import { create } from "zustand";
import type { SyncEvent } from "@/lib/types/sync.types";

export type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'completed' | 'error';

export interface ProcessedDocument {
  documentId: number;
  documentName: string;
  caseNumber?: string;
  status: 'success' | 'error' | 'skipped' | 'processing';
  message?: string;
  error?: string;
  invoiceId?: string;
  isUpdate?: boolean;
  timestamp: string;
}

export interface SyncProgress {
  totalDocuments: number;
  filteredDocuments: number;
  processedDocuments: number;
  successful: number;
  failed: number;
  skipped: number;
  updated: number;
  currentPage?: number;
  totalPages?: number;
  currentDocument?: number;
}

interface SyncState {
  // Status
  status: SyncStatus;
  isMinimized: boolean;
  
  // Progress data
  progress: SyncProgress;
  
  // Current document being processed
  currentDocument: ProcessedDocument | null;
  
  // Processed documents history
  processedDocuments: ProcessedDocument[];
  
  // Error documents
  errorDocuments: ProcessedDocument[];
  
  // Sync configuration
  fromDate: string | null;
  toDate: string | null;
  
  // Message
  message: string;
  
  // EventSource instance
  eventSource: EventSource | null;
  
  // Actions
  startSync: (fromDate: string, toDate: string) => void;
  stopSync: () => void;
  minimize: () => void;
  maximize: () => void;
  toggleMinimize: () => void;
  reset: () => void;
  handleEvent: (event: SyncEvent) => void;
}

const initialProgress: SyncProgress = {
  totalDocuments: 0,
  filteredDocuments: 0,
  processedDocuments: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  updated: 0,
};

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  isMinimized: false,
  progress: initialProgress,
  currentDocument: null,
  processedDocuments: [],
  errorDocuments: [],
  fromDate: null,
  toDate: null,
  message: '',
  eventSource: null,

  startSync: (fromDate: string, toDate: string) => {
    const currentState = get();
    
    // Don't start if already syncing
    if (currentState.status === 'syncing' || currentState.status === 'connecting') {
      return;
    }
    
    // Close existing connection if any
    if (currentState.eventSource) {
      currentState.eventSource.close();
    }

    // Get auth token from localStorage (auth-storage is used by useAuthStore)
    let token = '';
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        token = parsed?.state?.token || '';
      }
    } catch (e) {
      console.error('[Sync Store] Failed to get auth token:', e);
    }

    if (!token) {
      set({
        status: 'error',
        message: 'Authentication required. Please log in again.',
      });
      return;
    }

    // Reset state
    set({
      status: 'connecting',
      isMinimized: false,
      progress: initialProgress,
      currentDocument: null,
      processedDocuments: [],
      errorDocuments: [],
      fromDate,
      toDate,
      message: 'Connecting to sync server...',
    });

    // Create SSE connection with token in query string
    const url = `/api/sync/stream?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const syncEvent: SyncEvent = JSON.parse(event.data);
        get().handleEvent(syncEvent);
      } catch (error) {
        console.error('[Sync Store] Failed to parse event:', error);
      }
    };

    eventSource.onerror = () => {
      const state = get();
      
      // EventSource errors don't provide useful error info, so we provide context-based messages
      if (state.status === 'connecting') {
        console.error('[Sync Store] Failed to establish SSE connection');
        set({
          status: 'error',
          message: 'Failed to connect to sync server. Please check your connection and try again.',
        });
      } else if (state.status === 'syncing') {
        console.error('[Sync Store] SSE connection lost during sync');
        set({
          status: 'error',
          message: 'Connection lost during sync. Some documents may have been processed. Check the invoices page.',
        });
      }
      
      eventSource.close();
      set({ eventSource: null });
    };

    eventSource.onopen = () => {
      set({
        status: 'syncing',
        message: 'Connected, starting sync...',
      });
    };

    set({ eventSource });
  },

  stopSync: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
    }
    set({
      eventSource: null,
      status: 'idle',
      message: 'Sync cancelled',
    });
  },

  minimize: () => set({ isMinimized: true }),
  maximize: () => set({ isMinimized: false }),
  toggleMinimize: () => set(state => ({ isMinimized: !state.isMinimized })),

  reset: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
    }
    set({
      status: 'idle',
      isMinimized: false,
      progress: initialProgress,
      currentDocument: null,
      processedDocuments: [],
      errorDocuments: [],
      fromDate: null,
      toDate: null,
      message: '',
      eventSource: null,
    });
  },

  handleEvent: (event: SyncEvent) => {
    const { data, type, timestamp } = event;

    switch (type) {
      case 'start':
        set({
          status: 'syncing',
          message: data.message || 'Starting sync...',
        });
        break;

      case 'progress':
        set({
          progress: {
            totalDocuments: data.totalDocuments ?? 0,
            filteredDocuments: data.filteredDocuments ?? 0,
            processedDocuments: data.processedDocuments ?? 0,
            successful: data.successful ?? 0,
            failed: data.failed ?? 0,
            skipped: data.skipped ?? 0,
            updated: data.updated ?? 0,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            currentDocument: data.currentDocument,
          },
          message: data.message || '',
        });
        break;

      case 'document_processing':
        set({
          currentDocument: {
            documentId: data.documentId!,
            documentName: data.documentName || 'Unknown',
            caseNumber: data.caseNumber,
            status: 'processing',
            message: data.message,
            timestamp,
          },
          progress: {
            ...get().progress,
            currentDocument: data.currentDocument,
          },
        });
        break;

      case 'document_complete':
        const successDoc: ProcessedDocument = {
          documentId: data.documentId!,
          documentName: data.documentName || 'Unknown',
          caseNumber: data.caseNumber,
          status: 'success',
          message: data.message,
          invoiceId: data.invoiceId,
          isUpdate: data.isUpdate,
          timestamp,
        };
        set(state => ({
          processedDocuments: [...state.processedDocuments, successDoc],
          currentDocument: null,
          progress: {
            ...state.progress,
            processedDocuments: data.processedDocuments ?? state.progress.processedDocuments,
            successful: data.successful ?? state.progress.successful,
            failed: data.failed ?? state.progress.failed,
            skipped: data.skipped ?? state.progress.skipped,
            updated: data.updated ?? state.progress.updated,
            currentDocument: data.currentDocument,
          },
        }));
        break;

      case 'document_skipped':
        const skippedDoc: ProcessedDocument = {
          documentId: data.documentId!,
          documentName: data.documentName || 'Unknown',
          caseNumber: data.caseNumber,
          status: 'skipped',
          message: data.message || 'Already exists',
          timestamp,
        };
        set(state => ({
          processedDocuments: [...state.processedDocuments, skippedDoc],
          currentDocument: null,
          progress: {
            ...state.progress,
            processedDocuments: data.processedDocuments ?? state.progress.processedDocuments,
            successful: data.successful ?? state.progress.successful,
            failed: data.failed ?? state.progress.failed,
            skipped: data.skipped ?? state.progress.skipped,
            updated: data.updated ?? state.progress.updated,
            currentDocument: data.currentDocument,
          },
        }));
        break;

      case 'document_error':
        const errorDoc: ProcessedDocument = {
          documentId: data.documentId!,
          documentName: data.documentName || 'Unknown',
          caseNumber: data.caseNumber,
          status: 'error',
          error: data.error,
          timestamp,
        };
        set(state => ({
          processedDocuments: [...state.processedDocuments, errorDoc],
          errorDocuments: [...state.errorDocuments, errorDoc],
          currentDocument: null,
          progress: {
            ...state.progress,
            processedDocuments: data.processedDocuments ?? state.progress.processedDocuments,
            successful: data.successful ?? state.progress.successful,
            failed: data.failed ?? state.progress.failed,
            skipped: data.skipped ?? state.progress.skipped,
            updated: data.updated ?? state.progress.updated,
            currentDocument: data.currentDocument,
          },
        }));
        break;

      case 'page_complete':
        set(state => ({
          progress: {
            ...state.progress,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            processedDocuments: data.processedDocuments ?? state.progress.processedDocuments,
            successful: data.successful ?? state.progress.successful,
            failed: data.failed ?? state.progress.failed,
            skipped: data.skipped ?? state.progress.skipped,
          },
          message: data.message || '',
        }));
        break;

      case 'complete':
        const { eventSource } = get();
        if (eventSource) {
          eventSource.close();
        }
        set({
          status: 'completed',
          eventSource: null,
          currentDocument: null,
          progress: {
            totalDocuments: data.totalDocuments ?? 0,
            filteredDocuments: data.filteredDocuments ?? 0,
            processedDocuments: data.processedDocuments ?? 0,
            successful: data.successful ?? 0,
            failed: data.failed ?? 0,
            skipped: data.skipped ?? 0,
            updated: data.updated ?? 0,
          },
          message: data.message || 'Sync completed',
        });
        break;

      case 'error':
        const { eventSource: es } = get();
        if (es) {
          es.close();
        }
        set({
          status: 'error',
          eventSource: null,
          message: data.error || 'An error occurred',
        });
        break;
    }
  },
}));

// Selector hooks for performance optimization
export const useSyncStatus = () => useSyncStore(state => state.status);
export const useSyncProgress = () => useSyncStore(state => state.progress);
export const useSyncMinimized = () => useSyncStore(state => state.isMinimized);
export const useCurrentDocument = () => useSyncStore(state => state.currentDocument);
export const useProcessedDocuments = () => useSyncStore(state => state.processedDocuments);
export const useErrorDocuments = () => useSyncStore(state => state.errorDocuments);
export const useSyncMessage = () => useSyncStore(state => state.message);
export const useIsSyncing = () => useSyncStore(state => 
  state.status === 'syncing' || state.status === 'connecting'
);

