/**
 * Sync Progress Indicator
 * A global indicator that shows sync progress in the header/sidebar
 * Allows users to track background sync operations
 */

'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  X,
  Maximize2,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import {
  useSyncStore,
  useSyncStatus,
  useSyncProgress,
  useCurrentDocument,
  useSyncMessage,
  useIsSyncing,
  useSyncMinimized,
} from '@/hooks/use-sync-store';

interface SyncProgressIndicatorProps {
  className?: string;
}

function SyncProgressIndicatorComponent({ className }: SyncProgressIndicatorProps) {
  const status = useSyncStatus();
  const progress = useSyncProgress();
  const currentDocument = useCurrentDocument();
  const message = useSyncMessage();
  const isSyncing = useIsSyncing();
  const isMinimized = useSyncMinimized();

  const { maximize, stopSync, reset } = useSyncStore();

  // Don't render if not syncing and not minimized
  if (status === 'idle' || (!isSyncing && !isMinimized && status !== 'completed' && status !== 'error')) {
    return null;
  }

  const progressPercentage = progress.filteredDocuments > 0
    ? Math.round((progress.processedDocuments / progress.filteredDocuments) * 100)
    : 0;

  const getStatusColor = () => {
    switch (status) {
      case 'syncing':
      case 'connecting':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-muted';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
      case 'connecting':
        return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'error':
        return <XCircle className="h-3.5 w-3.5" />;
      default:
        return <RefreshCw className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative gap-2 h-8",
            isSyncing && "animate-pulse",
            className
          )}
        >
          <span className={cn(
            "h-2 w-2 rounded-full",
            getStatusColor()
          )} />
          {getStatusIcon()}
          <span className="text-xs font-medium">
            {status === 'syncing' ? `${progressPercentage}%` : 
             status === 'completed' ? 'Done' : 
             status === 'error' ? 'Error' : 
             'Sync'}
          </span>
          {isSyncing && (
            <span className="absolute -top-0.5 -right-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              Document Sync
              {isSyncing && (
                <Badge variant="secondary" className="text-xs">
                  In Progress
                </Badge>
              )}
            </h4>
            {(status === 'completed' || status === 'error') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={reset}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Progress */}
          {(status === 'syncing' || status === 'completed') && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progress.processedDocuments} / {progress.filteredDocuments}</span>
              </div>
              <Progress value={progressPercentage} className="h-1.5" />
            </div>
          )}

          {/* Current document */}
          {currentDocument && status === 'syncing' && (
            <div className="text-xs">
              <span className="text-muted-foreground">Processing: </span>
              <span className="font-medium truncate block">
                {currentDocument.documentName}
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="flex flex-col items-center gap-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="font-semibold">{progress.successful}</span>
              <span className="text-muted-foreground">Success</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="font-semibold">{progress.failed}</span>
              <span className="text-muted-foreground">Failed</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <SkipForward className="h-3.5 w-3.5 text-yellow-500" />
              <span className="font-semibold">{progress.skipped}</span>
              <span className="text-muted-foreground">Skipped</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-semibold">{progress.updated}</span>
              <span className="text-muted-foreground">Updated</span>
            </div>
          </div>

          {/* Message */}
          {message && (
            <p className={cn(
              "text-xs p-2 rounded",
              status === 'error' ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400" :
              status === 'completed' ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400" :
              "bg-muted text-muted-foreground"
            )}>
              {message}
            </p>
          )}

          {/* Error warning */}
          {progress.failed > 0 && (
            <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{progress.failed} errors - check Sync Errors page</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {isSyncing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-7"
                  onClick={maximize}
                >
                  <Maximize2 className="h-3 w-3 mr-1" />
                  View Details
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs h-7"
                  onClick={stopSync}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </>
            )}
            {status === 'completed' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={reset}
              >
                Dismiss
              </Button>
            )}
            {status === 'error' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={reset}
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const SyncProgressIndicator = memo(SyncProgressIndicatorComponent);

