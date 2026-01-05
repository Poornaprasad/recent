/**
 * Document Sync Button Component
 * Enhanced with SSE for real-time progress updates and background processing
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Minimize2,
  X,
  FileText,
  Clock,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import {
  useSyncStore,
  useSyncStatus,
  useSyncProgress,
  useCurrentDocument,
  useProcessedDocuments,
  useErrorDocuments,
  useSyncMessage,
  useIsSyncing,
  useSyncMinimized,
  type ProcessedDocument,
} from '@/hooks/use-sync-store';

interface DocumentSyncButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

// Get yesterday's and today's dates
const getYesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

const getToday = () => new Date().toISOString().split('T')[0];

// Document status icon component
function DocumentStatusIcon({ status }: { status: ProcessedDocument['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-yellow-500 shrink-0" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

// Single document item in the list
function DocumentItem({ doc }: { doc: ProcessedDocument }) {
  const statusColors = {
    success: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900',
    error: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    skipped: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900',
    processing: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all duration-200',
        statusColors[doc.status]
      )}
    >
      <DocumentStatusIcon status={doc.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{doc.documentName}</span>
          {doc.isUpdate && (
            <Badge variant="outline" className="text-xs">Updated</Badge>
          )}
        </div>
        {doc.caseNumber && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Case: {doc.caseNumber}
          </p>
        )}
        {doc.error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
            {doc.error}
          </p>
        )}
        {doc.message && doc.status !== 'error' && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.message}
          </p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        #{doc.documentId}
      </span>
    </div>
  );
}

// Progress stats component
function ProgressStats() {
  const progress = useSyncProgress();
  
  return (
    <div className="grid grid-cols-4 gap-3 text-center">
      <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
        <div className="text-lg font-bold text-green-600 dark:text-green-400">
          {progress.successful}
        </div>
        <div className="text-xs text-green-700 dark:text-green-300">Success</div>
      </div>
      <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
        <div className="text-lg font-bold text-red-600 dark:text-red-400">
          {progress.failed}
        </div>
        <div className="text-xs text-red-700 dark:text-red-300">Failed</div>
      </div>
      <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
          {progress.skipped}
        </div>
        <div className="text-xs text-yellow-700 dark:text-yellow-300">Skipped</div>
      </div>
      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
          {progress.updated}
        </div>
        <div className="text-xs text-blue-700 dark:text-blue-300">Updated</div>
      </div>
    </div>
  );
}

// Main Sync Button Component
export function DocumentSyncButton({
  variant = 'default',
  size = 'sm',
  className,
}: DocumentSyncButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getToday());
  const [showDetails, setShowDetails] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync store state
  const status = useSyncStatus();
  const progress = useSyncProgress();
  const currentDocument = useCurrentDocument();
  const processedDocuments = useProcessedDocuments();
  const errorDocuments = useErrorDocuments();
  const message = useSyncMessage();
  const isSyncing = useIsSyncing();
  const isMinimized = useSyncMinimized();

  // Actions
  const { startSync, stopSync, minimize, maximize, reset } = useSyncStore();

  // Auto-scroll to latest document
  useEffect(() => {
    if (scrollRef.current && processedDocuments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [processedDocuments.length]);

  // Calculate progress percentage
  const progressPercentage = progress.filteredDocuments > 0
    ? Math.round((progress.processedDocuments / progress.filteredDocuments) * 100)
    : 0;

  const handleStartSync = useCallback(() => {
    startSync(fromDate, toDate);
  }, [startSync, fromDate, toDate]);

  const handleClose = useCallback(() => {
    if (isSyncing) {
      minimize();
    }
    setIsOpen(false);
  }, [isSyncing, minimize]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      if (status === 'idle' || status === 'completed' || status === 'error') {
        // Reset for new sync if previous is done
        if (status !== 'idle') {
          reset();
        }
        setFromDate(getYesterday());
        setToDate(getToday());
      }
      setIsOpen(true);
    } else {
      handleClose();
    }
  }, [status, reset, handleClose]);

  // If syncing and minimized, clicking button should reopen
  useEffect(() => {
    if (isSyncing && !isMinimized && !isOpen) {
      setIsOpen(true);
    }
  }, [isSyncing, isMinimized, isOpen]);

  const renderContent = () => {
    // Initial state - show date picker
    if (status === 'idle') {
      return (
        <>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="from-date" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  From Date
                </Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="to-date" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  To Date
                </Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Documents are filtered by category (Invoices and Receipts).
              Already synced documents will be skipped unless modified.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartSync}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Sync
            </Button>
          </DialogFooter>
        </>
      );
    }

    // Connecting state
    if (status === 'connecting') {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{message || 'Connecting...'}</p>
        </div>
      );
    }

    // Syncing, completed, or error states
    return (
      <>
        <div className="space-y-4 py-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {status === 'syncing' ? 'Syncing Documents...' : 
                 status === 'completed' ? 'Sync Complete!' : 
                 'Sync Failed'}
              </span>
              <span className="text-muted-foreground">
                {progress.processedDocuments} / {progress.filteredDocuments}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progressPercentage}% complete
            </p>
          </div>

          {/* Current document being processed */}
          {currentDocument && status === 'syncing' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {currentDocument.documentName}
                </p>
                {currentDocument.caseNumber && (
                  <p className="text-xs text-muted-foreground">
                    Case: {currentDocument.caseNumber}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <ProgressStats />

          {/* Message */}
          {message && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              status === 'error' 
                ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                : status === 'completed'
                ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                : "bg-muted"
            )}>
              {status === 'error' && <AlertCircle className="h-4 w-4" />}
              {status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
              {status === 'syncing' && <Clock className="h-4 w-4" />}
              {message}
            </div>
          )}

          {/* Document details toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>Processed Documents ({processedDocuments.length})</span>
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {/* Document list */}
          {showDetails && processedDocuments.length > 0 && (
            <div ref={scrollRef} className="h-[200px] overflow-y-auto rounded-md border">
              <div className="space-y-2 p-2">
                {processedDocuments.map((doc, index) => (
                  <DocumentItem key={`${doc.documentId}-${index}`} doc={doc} />
                ))}
              </div>
            </div>
          )}

          {/* Error summary */}
          {errorDocuments.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-300">
                {errorDocuments.length} document{errorDocuments.length !== 1 ? 's' : ''} failed. 
                Check the Sync Errors page for details.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {status === 'syncing' && (
            <>
              <Button variant="outline" onClick={minimize}>
                <Minimize2 className="h-4 w-4 mr-2" />
                Minimize
              </Button>
              <Button variant="destructive" onClick={stopSync}>
                <X className="h-4 w-4 mr-2" />
                Cancel Sync
              </Button>
            </>
          )}
          {(status === 'completed' || status === 'error') && (
            <>
              <Button variant="outline" onClick={() => {
                reset();
              }}>
                Sync Again
              </Button>
              <Button onClick={() => setIsOpen(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={cn("relative", className)}>
          <RefreshCw className={cn(
            "h-4 w-4 mr-2",
            isSyncing && !isOpen && "animate-spin"
          )} />
          Sync Documents
          {isSyncing && isMinimized && (
            <span className="absolute -top-1 -right-1 h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className={cn(
              "h-5 w-5",
              isSyncing && "animate-spin text-primary"
            )} />
            Document Sync
            {isSyncing && (
              <Badge variant="secondary" className="ml-2">
                In Progress
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {status === 'idle' 
              ? 'Sync documents from SmartAdvocate. Select a date range to begin.'
              : status === 'syncing'
              ? 'Documents are being synced in real-time. You can minimize and continue working.'
              : status === 'completed'
              ? 'All documents have been processed successfully.'
              : status === 'error'
              ? 'An error occurred during sync.'
              : 'Connecting to sync server...'}
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
