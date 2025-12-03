
'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, MessageSquare, Flag, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { type StoredInvoice } from '@/lib/domain/types';
import { cn } from '@/lib/utils/utils';
import dynamic from 'next/dynamic';
import { updateInvoiceStatusAction, getInvoiceByIdAction, getInvoiceDataUriAction, flagInvoiceForReviewAction, addInvoiceCommentAction, getPendingVendorByInvoiceIdAction, completeVendorSetupAction, getVendorTypesAction, updateInvoiceCaseNumberAction } from '@/lib/actions/index';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ConfidenceBadge } from '@/components/invoice/confidence-badge';
import { decodeId } from '@/lib/utils/id-utils';
import { getDocumentTypeBadgeClass, getDocumentTypeDescription } from '@/lib/utils/document-type-utils';
import { parseInvoiceAmount, formatTotalAmount } from '@/lib/utils/invoice-utils';
import { normalizeBoundingBox, type BoundingBox } from '@/lib/utils/bbox-utils';

const PDFViewer = dynamic(() => import('@/components/invoice/pdf-viewer').then(mod => mod.PDFViewer), {
  ssr: false,
  loading: () => <p>Loading PDF...</p>
});

const toTitleCase = (str: string) => {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
};

export default function InvoiceDetailPage() {
  const params = useParams();
  // Decode the ID from URL (handles URL-encoded IDs)
  const id = decodeId(params.id as string);
  const router = useRouter();
  const { toast } = useToast();
  const [invoiceData, setInvoiceData] = useState<StoredInvoice | null>(null);
  const [invoiceDataUri, setInvoiceDataUri] = useState<string>('');
  const [highlightBox, setHighlightBox] = useState<BoundingBox | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [hoveredConfidence, setHoveredConfidence] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isVendorSetupDialogOpen, setIsVendorSetupDialogOpen] = useState(false);
  const [pendingVendor, setPendingVendor] = useState<any>(null);
  const [vendorTypes, setVendorTypes] = useState<Array<{ name: string; description?: string }>>([]);
  const [vendorType, setVendorType] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [requires1099, setRequires1099] = useState(true);
  const [isProcessingVendor, setIsProcessingVendor] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
    if (id) {
        const result = await getInvoiceByIdAction(id);
        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error,
          });
          setInvoiceData(null);
          setInvoiceDataUri('');
        } else if (result.data) {
          // Debug: Log the invoice data to check for bounding boxes
          console.log('Fetched invoice data:', result.data);
          console.log('Invoice number:', result.data.invoiceNumber);
          console.log('Invoice number bbox:', result.data.invoiceNumber?.bbox);
          console.log('Vendor name:', result.data.vendorName);
          console.log('Vendor name bbox:', result.data.vendorName?.bbox);
          console.log('Customer name:', result.data.customerName);
          console.log('Customer name bbox:', result.data.customerName?.bbox);
          console.log('Total amount:', result.data.totalAmount);
          console.log('Total amount bbox:', result.data.totalAmount?.bbox);
          
          setInvoiceData(result.data);
          // Convert file path to data URI if needed
          const uriResult = await getInvoiceDataUriAction(result.data.invoiceDataUri);
          if (uriResult.dataUri) {
            setInvoiceDataUri(uriResult.dataUri);
          } else {
            setInvoiceDataUri(result.data.invoiceDataUri);
          }
        }
      }
    };
    fetchInvoice();
  }, [id, toast]);

  // Update image dimensions when window resizes or highlight box changes
  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current && containerRef.current) {
        const img = imageRef.current;
        const container = containerRef.current;
        const rect = img.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setImageDimensions({
          width: rect.width,
          height: rect.height,
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
        });
      } else if (containerRef.current) {
        // Try to find the image element
        const img = containerRef.current.querySelector('img');
        if (img) {
          imageRef.current = img;
          const rect = img.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          setImageDimensions({
            width: rect.width,
            height: rect.height,
            left: rect.left - containerRect.left,
            top: rect.top - containerRect.top,
          });
        }
      }
    };

    // Update immediately
    const timeout = setTimeout(updateImageDimensions, 100);
    
    window.addEventListener('resize', updateImageDimensions);
    // Update periodically to catch image load and layout changes
    const interval = setInterval(updateImageDimensions, 300);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateImageDimensions);
      clearInterval(interval);
    };
  }, [invoiceDataUri, highlightBox]);

  const handleStatusUpdate = async (status: 'Pending' | 'Draft') => {
    if (!invoiceData) return;
    setIsUpdating(true);
    try {
        await updateInvoiceStatusAction(invoiceData.id, status);
        toast({
            title: `Invoice ${status === 'Pending' ? 'Approved' : 'Rejected'}`,
            description: status === 'Pending' 
              ? 'The invoice has been approved and moved to the invoices list.'
              : 'The invoice has been rejected and marked as draft.',
        });
        // Redirect based on status: approved goes to invoices, rejected stays on approvals
        if (status === 'Pending') {
          router.push('/invoices');
        } else {
        router.push('/approvals');
        }
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: 'Could not update the invoice status.',
        });
    } finally {
        setIsUpdating(false);
    }
  }

  const handleFlagForReview = async () => {
    if (!invoiceData) return;
    setIsUpdating(true);
    try {
      const result = await flagInvoiceForReviewAction(invoiceData.id);
      if (result.success) {
        toast({
          title: 'Invoice Flagged for Review',
          description: 'The invoice has been flagged for review and moved to the approvals queue.',
        });
        // Refresh invoice data
        const updatedResult = await getInvoiceByIdAction(invoiceData.id);
        if (updatedResult.data) {
          setInvoiceData(updatedResult.data);
        }
        router.refresh();
      } else {
        throw new Error(result.error || 'Failed to flag invoice');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Flag Invoice',
        description: error instanceof Error ? error.message : 'Could not flag invoice for review.',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  const handleAddComment = async () => {
    if (!invoiceData || !commentText.trim()) return;
    setIsAddingComment(true);
    try {
      const result = await addInvoiceCommentAction(invoiceData.id, commentText.trim());
      if (result.success) {
        toast({
          title: 'Comment Added',
          description: 'Your comment has been added to the invoice.',
        });
        // Refresh invoice data
        const updatedResult = await getInvoiceByIdAction(invoiceData.id);
        if (updatedResult.data) {
          setInvoiceData(updatedResult.data);
        }
        setCommentText('');
        setIsCommentDialogOpen(false);
      } else {
        throw new Error(result.error || 'Failed to add comment');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Add Comment',
        description: error instanceof Error ? error.message : 'Could not add comment.',
      });
    } finally {
      setIsAddingComment(false);
    }
  }

  const handleCompleteVendorSetup = async () => {
    if (!pendingVendor || !vendorType) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a vendor type.',
      });
      return;
    }

    setIsProcessingVendor(true);
    try {
      const result = await completeVendorSetupAction(pendingVendor.id, {
        vendorType,
        email: vendorEmail || undefined,
        phone: vendorPhone || undefined,
        address: vendorAddress || undefined,
        requires1099,
      });

      if (result.success) {
        toast({
          title: 'Vendor Setup Completed',
          description: 'The vendor has been added to your vendor list.',
        });
        setIsVendorSetupDialogOpen(false);
        setPendingVendor(null);
        // Refresh invoice data
        if (invoiceData) {
          const updatedResult = await getInvoiceByIdAction(invoiceData.id);
          if (updatedResult.data) {
            setInvoiceData(updatedResult.data);
          }
        }
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to complete vendor setup.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to complete vendor setup.',
      });
    } finally {
      setIsProcessingVendor(false);
    }
  };

  const fieldsToRender = useMemo(() => {
    if (!invoiceData) return [];
    
    // This will flatten all fields except for lineItems and documentType, which will be handled separately.
    const fields = Object.entries(invoiceData)
      .filter(([key, value]) => value !== null && !['id', 'invoiceDataUri', 'status', 'isDuplicate', 'duplicateReason', 'lineItems', 'documentType'].includes(key))
      .map(([key, value]) => ({ key, title: toTitleCase(key), value }));

    return fields;
  }, [invoiceData]);

  const lineItems = useMemo(() => {
      if (!invoiceData || !invoiceData.lineItems || !Array.isArray(invoiceData.lineItems.value)) {
          return [];
      }
      return invoiceData.lineItems.value;
  }, [invoiceData]);


  if (!invoiceData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="p-4 md:p-8 md:pb-4 pb-4 border-b self-start w-full">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
              <Link href="/invoices">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">
              Invoice {id}
            </h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p>Invoice data not found.</p>
        </div>
      </div>
    );
  }

  const renderField = (fieldValue: any) => {
      const value = fieldValue?.value;
      // Convert null/undefined to empty string for input components
      const safeValue = value === null || value === undefined ? '' : String(value);
      
      if (typeof value === 'string' && value.length > 100) {
          return <Textarea value={safeValue} readOnly rows={4} />;
      }
      const fieldType = typeof value === 'number' ? 'number' : 'text';
      return <Input value={safeValue} readOnly type={fieldType} />;
  };

  const isPdf = invoiceDataUri && invoiceDataUri.startsWith('data:application/pdf');

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-4 md:p-8 md:pb-4 pb-4 border-b">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon">
            <Link href={invoiceData.status === 'Review' ? '/approvals' : '/invoices'}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">
              {invoiceData.documentType || 'Invoice'} {invoiceData.invoiceNumber?.value || id}
            </h2>
            {invoiceData.documentType && (
              <Badge 
                variant="outline" 
                className={cn(getDocumentTypeBadgeClass(invoiceData.documentType))}
              >
                {invoiceData.documentType}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-row overflow-hidden">
        <div className="w-1/2 border-r p-4 flex items-center justify-center bg-muted/40 relative" ref={containerRef}>
            {isPdf ? (
                 <div className="relative w-full h-full">
                   <PDFViewer file={invoiceDataUri} />
                 </div>
            ) : (
                <div className="relative w-full h-full">
                    <Image
                        src={invoiceDataUri || 'https://placehold.co/595x842.png'}
                        alt={"Invoice " + id}
                        data-ai-hint="invoice document"
                        width={0}
                        height={0}
                        sizes="100vw"
                        className="w-full h-full object-contain"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          imageRef.current = img;
                          if (containerRef.current) {
                            const rect = img.getBoundingClientRect();
                            const containerRect = containerRef.current.getBoundingClientRect();
                            setImageDimensions({
                              width: rect.width,
                              height: rect.height,
                              left: rect.left - containerRect.left,
                              top: rect.top - containerRect.top,
                            });
                          }
                        }}
                        />
                </div>
            )}
            {highlightBox && highlightBox.length >= 4 && (() => {
                      const normalized = normalizeBoundingBox(
                        highlightBox,
                        imageDimensions ? { width: imageDimensions.width, height: imageDimensions.height } : undefined
                      );
                      
                      if (!normalized) {
                        console.warn('Invalid bounding box points:', highlightBox);
                        return null;
                      }
                      
                      const { minX: normalizedMinX, maxX: normalizedMaxX, minY: normalizedMinY, maxY: normalizedMaxY } = normalized;
                      
                      console.log('Rendering bounding box:', {
                        normalized: { normalizedMinX, normalizedMaxX, normalizedMinY, normalizedMaxY },
                        imageDimensions,
                        isPdf,
                        hoveredField
                      });
                      
                      // For PDFs, always use percentage-based positioning
                      // For images, use pixel-based if dimensions are available
                      if (!isPdf && imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0) {
                        // Use normalized coordinates
                        const boxLeft = imageDimensions.left + normalizedMinX * imageDimensions.width;
                        const boxTop = imageDimensions.top + normalizedMinY * imageDimensions.height;
                        const boxWidth = (normalizedMaxX - normalizedMinX) * imageDimensions.width;
                        const boxHeight = (normalizedMaxY - normalizedMinY) * imageDimensions.height;
                        
                        return (
                          <div
                            className="absolute border-2 border-green-500 bg-green-500/20 pointer-events-none z-10"
                            style={{
                              left: `${boxLeft}px`,
                              top: `${boxTop}px`,
                              width: `${boxWidth}px`,
                              height: `${boxHeight}px`,
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-2">
                              <span>{hoveredField && toTitleCase(hoveredField)}</span>
                              {hoveredConfidence !== null && (
                                <span className="font-mono bg-green-600 px-1.5 py-0.5 rounded">
                                  {Math.round(hoveredConfidence * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        // Fallback to percentage-based positioning (works for both PDFs and images)
                        // Coordinates are already normalized and clamped
                        return (
                          <div
                            className="absolute border-2 border-green-500 bg-green-500/20 pointer-events-none z-10"
                style={{
                              left: `${normalizedMinX * 100}%`,
                              top: `${normalizedMinY * 100}%`,
                              width: `${(normalizedMaxX - normalizedMinX) * 100}%`,
                              height: `${(normalizedMaxY - normalizedMinY) * 100}%`,
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-2">
                              <span>{hoveredField && toTitleCase(hoveredField)}</span>
                              {hoveredConfidence !== null && (
                                <span className="font-mono bg-green-600 px-1.5 py-0.5 rounded">
                                  {Math.round(hoveredConfidence * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })()}
        </div>
        <div className="w-1/2">
          <ScrollArea className="h-full">
            <div className="p-4 sm:p-6 lg:p-8">
              <Card>
                <CardHeader>
                  <CardTitle>Extracted Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invoiceData.isDuplicate && invoiceData.duplicateReason && (
                    <div className="p-3 rounded-md border border-destructive/50 bg-destructive/10">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium text-destructive">Duplicate Alert</Label>
                        <Badge variant="destructive">
                          Duplicate
                        </Badge>
                      </div>
                      <p className="text-xs text-destructive/80 mt-2">
                        {invoiceData.duplicateReason}
                      </p>
                    </div>
                  )}
                  {invoiceData.vendorRequires1099 && (
                    <div className="p-3 rounded-md border border-destructive/50 bg-destructive/10">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium text-destructive">1099 Request Required</Label>
                        <div className="flex gap-2">
                          <Badge variant="destructive">
                            1099 Required
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsVendorSetupDialogOpen(true)}
                          >
                            Complete Setup
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-destructive/80 mt-2">
                        {invoiceData.vendorName?.value 
                          ? `Vendor "${invoiceData.vendorName.value}" is not in your vendor list. Please complete vendor setup to proceed with this invoice.`
                          : 'This vendor is not in your vendor list. Please complete vendor setup to proceed.'}
                      </p>
                    </div>
                  )}
                  {invoiceData.requiresEscalation && invoiceData.highValueReason && (
                    <div className={`p-3 rounded-md border ${
                      invoiceData.escalationLevel === 'critical'
                        ? 'border-red-500/50 bg-red-500/10'
                        : invoiceData.escalationLevel === 'high'
                        ? 'border-orange-500/50 bg-orange-500/10'
                        : 'border-yellow-500/50 bg-yellow-500/10'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className={`font-medium ${
                          invoiceData.escalationLevel === 'critical'
                            ? 'text-red-700 dark:text-red-400'
                            : invoiceData.escalationLevel === 'high'
                            ? 'text-orange-700 dark:text-orange-400'
                            : 'text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {invoiceData.escalationLevel === 'critical' 
                            ? 'Critical: Executive Approval Required'
                            : invoiceData.escalationLevel === 'high'
                            ? 'High Value: Manager Approval Required'
                            : 'High Value: Review Required'}
                        </Label>
                        <Badge 
                          variant="outline" 
                          className={
                            invoiceData.escalationLevel === 'critical'
                              ? 'border-red-500 text-red-700 dark:text-red-400'
                              : invoiceData.escalationLevel === 'high'
                              ? 'border-orange-500 text-orange-700 dark:text-orange-400'
                              : 'border-yellow-500 text-yellow-700 dark:text-yellow-400'
                          }
                        >
                          {invoiceData.escalationLevel ? invoiceData.escalationLevel.toUpperCase() : 'HIGH VALUE'}
                        </Badge>
                      </div>
                      <p className={`text-xs mt-2 ${
                        invoiceData.escalationLevel === 'critical'
                          ? 'text-red-700/80 dark:text-red-400/80'
                          : invoiceData.escalationLevel === 'high'
                          ? 'text-orange-700/80 dark:text-orange-400/80'
                          : 'text-yellow-700/80 dark:text-yellow-400/80'
                      }`}>
                        {invoiceData.highValueReason}
                      </p>
                    </div>
                  )}
                  {invoiceData.hasAmountAnomaly && invoiceData.amountAnomalyReason && (
                    <div className="p-3 rounded-md border border-orange-500/50 bg-orange-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium text-orange-700 dark:text-orange-400">Amount Anomaly Detected</Label>
                        <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
                          Anomaly
                        </Badge>
                      </div>
                      <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-2">
                        {invoiceData.amountAnomalyReason}
                      </p>
                      {invoiceData.expectedAmount !== undefined && (
                        <p className="text-xs text-orange-700/60 dark:text-orange-400/60 mt-1">
                          Expected: ${invoiceData.expectedAmount.toFixed(2)} | 
                          Current: ${formatTotalAmount(invoiceData.totalAmount?.value)}
                        </p>
                      )}
                    </div>
                  )}
                  {invoiceData.isRecurring && invoiceData.recurringPattern && (
                    <div className="p-3 rounded-md border border-blue-500/50 bg-blue-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium text-blue-700 dark:text-blue-400">Recurring Bill</Label>
                        <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
                          {invoiceData.recurringPattern.charAt(0).toUpperCase() + invoiceData.recurringPattern.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-2">
                        This appears to be a {invoiceData.recurringPattern} recurring bill from {invoiceData.vendorName?.value || 'this vendor'}.
                      </p>
                    </div>
                  )}
                  {invoiceData.documentType && (
                    <div className="p-3 rounded-md border bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium">Document Type</Label>
                        <Badge 
                          variant="outline" 
                          className={cn(getDocumentTypeBadgeClass(invoiceData.documentType))}
                        >
                          {invoiceData.documentType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {getDocumentTypeDescription(invoiceData.documentType)}
                      </p>
                    </div>
                  )}
                  <div className="p-3 rounded-md border bg-muted/30">
                    <Label htmlFor="case-number" className="mb-2 block">Case Number</Label>
                    <Input
                      id="case-number"
                      value={invoiceData.caseNumber || ''}
                      onChange={async (e) => {
                        const caseNumber = e.target.value;
                        if (invoiceData) {
                          const result = await updateInvoiceCaseNumberAction(invoiceData.id, caseNumber);
                          if (result.success) {
                            // Refresh invoice data
                            const updatedResult = await getInvoiceByIdAction(invoiceData.id);
                            if (updatedResult.data) {
                              setInvoiceData(updatedResult.data);
                            }
                            toast({
                              title: 'Case Number Updated',
                              description: 'The case number has been saved.',
                            });
                          } else {
                            toast({
                              variant: 'destructive',
                              title: 'Update Failed',
                              description: result.error || 'Failed to update case number.',
                            });
                          }
                        }
                      }}
                      placeholder="Enter case number..."
                    />
                  </div>
                  {fieldsToRender.map(({key, title, value}) => {
                    const confidence = value?.confidence;
                    const reasoning = value?.reasoning;
                    const hasBbox = value?.bbox && Array.isArray(value.bbox) && value.bbox.length >= 4;
                    
                    return (
                    <div
                      key={key}
                        className={cn("p-3 rounded-md transition-colors border", hoveredField === key ? 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'border-border')}
                        onMouseEnter={() => {
                          if (hasBbox) {
                            // Validate bounding box coordinates
                            const bbox = value.bbox;
                            console.log(`Hovering over field ${key}, bbox:`, bbox);
                            if (Array.isArray(bbox) && bbox.length >= 4) {
                              // Check if all points have valid x and y coordinates
                              const isValid = bbox.every(p => 
                                typeof p === 'object' && 
                                p !== null && 
                                typeof p.x === 'number' && 
                                typeof p.y === 'number' &&
                                !isNaN(p.x) && 
                                !isNaN(p.y)
                              );
                              if (isValid) {
                                // Normalize coordinates if they're not already (0-1 range)
                                const normalizedBbox = bbox.map(p => {
                                  // If coordinates are > 1, they might be in pixel format
                                  // We'll assume they're already normalized for now
                                  return { x: p.x, y: p.y };
                                });
                                console.log(`Setting highlight box for ${key}:`, normalizedBbox);
                                setHighlightBox(normalizedBbox);
                                setHoveredField(key);
                                setHoveredConfidence(confidence || null);
                              } else {
                                console.warn(`Invalid bounding box for field ${key}:`, bbox);
                              }
                            } else {
                              console.warn(`Bounding box for ${key} is not a valid array or has < 4 points:`, bbox);
                            }
                          } else {
                            console.log(`Field ${key} has no bounding box. hasBbox:`, hasBbox, 'value:', value);
                          }
                        }}
                        onMouseLeave={() => {
                          setHighlightBox(null);
                          setHoveredField(null);
                          setHoveredConfidence(null);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Label className={cn('font-medium', hoveredField === key && 'text-green-600 dark:text-green-400')}>
                            {title}
                          </Label>
                          {confidence !== undefined && (
                            <div className="flex items-center gap-2">
                              <div
                                onMouseEnter={() => {
                                  if (hasBbox) {
                                    const bbox = value.bbox;
                                    if (Array.isArray(bbox) && bbox.length >= 4) {
                                      const isValid = bbox.every(p => 
                                        typeof p === 'object' && 
                                        p !== null && 
                                        typeof p.x === 'number' && 
                                        typeof p.y === 'number' &&
                                        !isNaN(p.x) && 
                                        !isNaN(p.y)
                                      );
                                      if (isValid) {
                                        setHighlightBox(bbox);
                                        setHoveredField(key);
                                        setHoveredConfidence(confidence);
                                      }
                                    }
                                  }
                                }}
                                onMouseLeave={() => {
                                  setHighlightBox(null);
                                  setHoveredField(null);
                                  setHoveredConfidence(null);
                                }}
                                className="cursor-pointer"
                              >
                                <ConfidenceBadge score={confidence} />
                              </div>
                              {hasBbox && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20"
                      onMouseEnter={() => {
                                    if (hasBbox) {
                                      const bbox = value.bbox;
                                      if (Array.isArray(bbox) && bbox.length >= 4) {
                                        const isValid = bbox.every(p => 
                                          typeof p === 'object' && 
                                          p !== null && 
                                          typeof p.x === 'number' && 
                                          typeof p.y === 'number' &&
                                          !isNaN(p.x) && 
                                          !isNaN(p.y)
                                        );
                                        if (isValid) {
                                          setHighlightBox(bbox);
                          setHoveredField(key);
                                          setHoveredConfidence(confidence);
                                        }
                                      }
                        }
                      }}
                      onMouseLeave={() => {
                        setHighlightBox(null);
                        setHoveredField(null);
                                    setHoveredConfidence(null);
                                  }}
                                >
                                  📍 Located
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      <div className="mt-1">
                        {renderField(value)}
                        </div>
                        {reasoning && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            {reasoning}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  
                  {lineItems.length > 0 && invoiceData.lineItems && (
                     <div 
                        className={cn("p-3 rounded-md transition-colors border", hoveredField === 'lineItems' ? 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'border-border')}
                        onMouseEnter={() => {
                            if (invoiceData.lineItems?.bbox && Array.isArray(invoiceData.lineItems.bbox) && invoiceData.lineItems.bbox.length >= 4) {
                                const bbox = invoiceData.lineItems.bbox;
                                const isValid = bbox.every(p => 
                                  typeof p === 'object' && 
                                  p !== null && 
                                  typeof p.x === 'number' && 
                                  typeof p.y === 'number' &&
                                  !isNaN(p.x) && 
                                  !isNaN(p.y)
                                );
                                if (isValid) {
                                  setHighlightBox(bbox);
                                setHoveredField('lineItems');
                                  setHoveredConfidence(invoiceData.lineItems.confidence || null);
                                }
                            }
                        }}
                        onMouseLeave={() => {
                            setHighlightBox(null);
                            setHoveredField(null);
                            setHoveredConfidence(null);
                        }}
                    >
                         <div className="flex items-center justify-between mb-2">
                           <Label className={cn('font-medium', hoveredField === 'lineItems' && 'text-green-600 dark:text-green-400')}>
                             Line Items
                           </Label>
                           {invoiceData.lineItems.confidence !== undefined && (
                             <div className="flex items-center gap-2">
                               <div
                                 onMouseEnter={() => {
                                   if (invoiceData.lineItems?.bbox && Array.isArray(invoiceData.lineItems.bbox) && invoiceData.lineItems.bbox.length >= 4) {
                                     setHighlightBox(invoiceData.lineItems.bbox);
                                     setHoveredField('lineItems');
                                     setHoveredConfidence(invoiceData.lineItems.confidence);
                                   }
                                 }}
                                 onMouseLeave={() => {
                                   setHighlightBox(null);
                                   setHoveredField(null);
                                   setHoveredConfidence(null);
                                 }}
                                 className="cursor-pointer"
                               >
                                 <ConfidenceBadge score={invoiceData.lineItems.confidence} />
                               </div>
                               {invoiceData.lineItems.bbox && Array.isArray(invoiceData.lineItems.bbox) && invoiceData.lineItems.bbox.length >= 4 && (
                                 <Badge 
                                   variant="outline" 
                                   className="text-xs cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20"
                                 onMouseEnter={() => {
                                   if (invoiceData.lineItems?.bbox && Array.isArray(invoiceData.lineItems.bbox) && invoiceData.lineItems.bbox.length >= 4) {
                                     const bbox = invoiceData.lineItems.bbox;
                                     const isValid = bbox.every(p => 
                                       typeof p === 'object' && 
                                       p !== null && 
                                       typeof p.x === 'number' && 
                                       typeof p.y === 'number' &&
                                       !isNaN(p.x) && 
                                       !isNaN(p.y)
                                     );
                                     if (isValid) {
                                       setHighlightBox(bbox);
                                       setHoveredField('lineItems');
                                       setHoveredConfidence(invoiceData.lineItems.confidence || null);
                                     }
                                   }
                                 }}
                                   onMouseLeave={() => {
                                     setHighlightBox(null);
                                     setHoveredField(null);
                                     setHoveredConfidence(null);
                                   }}
                                 >
                                   📍 Located
                                 </Badge>
                               )}
                             </div>
                           )}
                         </div>
                         {invoiceData.lineItems.reasoning && (
                           <p className="text-xs text-muted-foreground mb-2 italic">
                             {invoiceData.lineItems.reasoning}
                           </p>
                         )}
                         <div className="space-y-2 mt-1">
                             {lineItems.map((item, index) => (
                                 <Card key={index} className="p-3 bg-muted/50">
                                    <div className="space-y-1">
                                     {typeof item === 'object' && item !== null ? 
                                         Object.entries(item).map(([itemKey, itemValue]) => (
                                             <div key={itemKey} className="flex justify-between text-sm">
                                                 <span className="text-muted-foreground">{toTitleCase(itemKey)}</span>
                                                 <span className="font-mono text-right">{String(itemValue)}</span>
                                             </div>
                                         ))
                                     : <p>{String(item)}</p>}
                                     </div>
                                 </Card>
                             ))}
                         </div>
                     </div>
                  )}
                  {invoiceData.comment && (
                    <div className="p-3 rounded-md border bg-muted/50">
                      <Label className="font-medium mb-2 block">Comment</Label>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoiceData.comment}</p>
                    </div>
                  )}

                </CardContent>
                <CardFooter className="justify-end gap-2">
                    {invoiceData.status === 'Review' ? (
                        <>
                            <Button variant="outline" size="lg" onClick={() => handleStatusUpdate('Draft')} disabled={isUpdating || invoiceData.vendorRequires1099}>
                                <X className="mr-2 h-4 w-4" />
                                Reject
                            </Button>
                            <Button size="lg" onClick={() => handleStatusUpdate('Pending')} disabled={isUpdating || invoiceData.vendorRequires1099} title={invoiceData.vendorRequires1099 ? 'Vendor must be set up before approving' : ''}>
                                <Check className="mr-2 h-4 w-4" />
                                Approve
                            </Button>
                            {invoiceData.vendorRequires1099 && (
                              <p className="text-xs text-muted-foreground self-center">
                                Complete vendor setup to approve
                              </p>
                            )}
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={handleFlagForReview} disabled={isUpdating || invoiceData.vendorRequires1099} title={invoiceData.vendorRequires1099 ? 'Vendor must be set up first' : ''}>
                                <Flag className="mr-2 h-4 w-4" />
                                Flag for Review
                            </Button>
                            <Button variant="outline" onClick={() => setIsCommentDialogOpen(true)}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Add Comment
                            </Button>
                            <Button>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </Button>
                        </>
                    )}
                </CardFooter>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Comment Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
            <DialogDescription>
              Add a comment or note to this invoice. This will be visible to all users reviewing the invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter your comment here..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCommentDialogOpen(false);
              setCommentText('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddComment} disabled={!commentText.trim() || isAddingComment}>
              {isAddingComment ? 'Adding...' : 'Add Comment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Setup Dialog */}
      <Dialog open={isVendorSetupDialogOpen} onOpenChange={setIsVendorSetupDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Complete Vendor Setup</DialogTitle>
            <DialogDescription>
              Vendor "{pendingVendor?.name || invoiceData?.vendorName?.value}" needs to be added to your vendor list before this invoice can be processed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendor Type *</Label>
              <Select value={vendorType} onValueChange={setVendorType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent>
                  {vendorTypes.map((type) => (
                    <SelectItem key={type.name} value={type.name}>
                      {type.name}
                      {type.description && (
                        <span className="text-xs text-muted-foreground ml-2">
                          - {type.description}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="vendor@example.com"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="123 Main St, City, State ZIP"
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires1099"
                checked={requires1099}
                onCheckedChange={(checked) => setRequires1099(checked === true)}
              />
              <Label htmlFor="requires1099" className="cursor-pointer">
                Requires 1099 form
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVendorSetupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteVendorSetup} disabled={!vendorType || isProcessingVendor}>
              {isProcessingVendor ? 'Processing...' : 'Complete Setup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
