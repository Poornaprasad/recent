/**
 * Document Sync Button Component
 * Allows users to manually trigger document sync from SmartAdvocate
 * with configurable date range
 */

'use client';

import { useState } from 'react';
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
import { RefreshCw, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { syncDocumentsFromSmartAdvocate } from '@/lib/actions/document-sync.actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

interface DocumentSyncButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function DocumentSyncButton({ variant = 'default', size = 'sm', className }: DocumentSyncButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [force, setForce] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      totalDocuments: number;
      filteredDocuments: number;
      processed: number;
      successful: number;
      failed: number;
      skipped: number;
      updated: number;
    };
  } | null>(null);

  // Get yesterday's date as default
  const getYesterday = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  // Get today's date as default
  const getToday = () => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  };

  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getToday());

  const handleSync = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await syncDocumentsFromSmartAdvocate({
        fromDate,
        toDate,
        force,
      });

      if (response.error) {
        setResult({
          success: false,
          message: response.error,
        });
      } else if (response.data) {
        setResult({
          success: true,
          message: 'Document sync completed successfully!',
          details: {
            totalDocuments: response.data.totalDocuments,
            filteredDocuments: response.data.filteredDocuments,
            processed: response.data.processedDocuments,
            successful: response.data.successful,
            failed: response.data.failed,
            skipped: response.data.skipped,
            updated: response.data.updated,
          },
        });

        // Auto-close dialog after 3 seconds on success
        setTimeout(() => {
          setIsOpen(false);
          // Reset state after closing
          setTimeout(() => {
            setResult(null);
            setFromDate(getYesterday());
            setToDate(getToday());
            setForce(false);
          }, 300);
        }, 3000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sync Documents from SmartAdvocate</DialogTitle>
          <DialogDescription>
            Manually trigger document synchronization. Select the date range for documents to sync.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Date Range */}
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
                disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Force sync option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="force"
              checked={force}
              onCheckedChange={(checked) => setForce(checked as boolean)}
              disabled={isLoading}
            />
            <Label
              htmlFor="force"
              className="text-sm font-normal cursor-pointer"
            >
              Force sync (re-process existing documents)
            </Label>
          </div>

          {/* Result display */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>
                {result.message}
                {result.details && (
                  <div className="mt-2 text-sm space-y-1">
                    <div>Total documents: {result.details.totalDocuments}</div>
                    <div>Filtered: {result.details.filteredDocuments}</div>
                    <div>Processed: {result.details.processed}</div>
                    <div className="text-green-600">✓ Successful: {result.details.successful}</div>
                    {result.details.updated > 0 && (
                      <div className="text-blue-600">↻ Updated: {result.details.updated}</div>
                    )}
                    {result.details.skipped > 0 && (
                      <div className="text-gray-600">⊗ Skipped: {result.details.skipped}</div>
                    )}
                    {result.details.failed > 0 && (
                      <div className="text-red-600">✗ Failed: {result.details.failed}</div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Info text */}
          <p className="text-sm text-muted-foreground">
            Default range is yesterday to today. Documents are filtered by category (Invoices and Receipts).
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSync} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Start Sync
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
