"use client";

import { Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from '@/lib/utils/utils';

interface FileProgress {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  invoiceId?: string;
}

interface BulkProcessingViewProps {
  files: File[];
  progress: FileProgress[];
  currentIndex: number;
}

export function BulkProcessingView({ files, progress, currentIndex }: BulkProcessingViewProps) {
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const errorCount = progress.filter(p => p.status === 'error').length;
  const totalProgress = files.length > 0 ? ((completedCount + errorCount) / files.length) * 100 : 0;
  const isComplete = completedCount + errorCount === files.length;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-6 sm:p-8">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {isComplete ? "Processing Complete" : "Processing Invoices"}
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            {isComplete 
              ? `Successfully processed ${completedCount} of ${files.length} invoices${errorCount > 0 ? `. ${errorCount} failed.` : '.'} Redirecting to invoices...`
              : `Processing invoice ${currentIndex + 1} of ${files.length}...`}
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount + errorCount} / {files.length}
              </span>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </div>
        </Card>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {progress.map((fileProgress, index) => (
            <Card
              key={`${fileProgress.file.name}-${index}`}
              className={cn(
                "p-4 transition-all",
                fileProgress.status === 'processing' && "border-primary bg-primary/5",
                fileProgress.status === 'completed' && "border-green-500/50 bg-green-500/5",
                fileProgress.status === 'error' && "border-destructive/50 bg-destructive/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {fileProgress.status === 'processing' && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                  )}
                  {fileProgress.status === 'completed' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                  {fileProgress.status === 'error' && (
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  )}
                  {fileProgress.status === 'pending' && (
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {fileProgress.file.name}
                    </span>
                    {fileProgress.status === 'processing' && (
                      <span className="text-xs text-muted-foreground">Processing...</span>
                    )}
                    {fileProgress.status === 'completed' && (
                      <span className="text-xs text-green-600 dark:text-green-400">Completed</span>
                    )}
                    {fileProgress.status === 'error' && (
                      <span className="text-xs text-destructive">
                        {fileProgress.error || 'Error processing'}
                      </span>
                    )}
                    {fileProgress.status === 'pending' && (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
