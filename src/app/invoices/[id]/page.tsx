'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, MessageSquare, Flag, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { type StoredInvoice, type DocumentType } from '@/lib/domain/types';
import { cn } from '@/lib/utils/utils';
import { updateInvoiceStatusAction, getInvoiceByIdAction, getInvoiceDataUriAction, flagInvoiceForReviewAction, addInvoiceCommentAction, completeVendorSetupAction, getInvoicesAction } from '@/lib/actions/index';
import { getCaseInfoAction } from '@/lib/actions/case.actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VendorSetupDialog } from '@/components/dialogs/vendor-setup-dialog';
import { CommentDialog } from '@/components/dialogs/comment-dialog';
import { InvoiceViewer } from '@/components/invoice/invoice-viewer';
import { ExtractedDataPanel } from '@/components/invoice/extracted-data-panel';
import { DisbursementFormModal } from '@/components/invoice/disbursement-form-modal';
import { decodeId, encodeId } from '@/lib/utils/id-utils';
import { getDocumentTypeBadgeClass } from '@/lib/utils/document-type-utils';
import { formatTotalAmount, formatCurrency } from '@/lib/utils/invoice-utils';
import type { BoundingBox } from '@/lib/utils/bbox-utils';
import { useAuthStore } from '@/hooks/use-auth-store';

export default function InvoiceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = decodeId(params.id as string);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  
  // Get source context from URL params
  const source = searchParams.get('source') || 'invoices'; // 'approvals', 'escalations', 'invoices'
  const autoAdvance = searchParams.get('autoAdvance') === 'true';

  const [invoiceData, setInvoiceData] = useState<StoredInvoice | null>(null);
  const [invoiceDataUri, setInvoiceDataUri] = useState<string>('');
  const [highlightBox, setHighlightBox] = useState<BoundingBox | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [hoveredConfidence, setHoveredConfidence] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isVendorSetupDialogOpen, setIsVendorSetupDialogOpen] = useState(false);
  const [pendingVendor, setPendingVendor] = useState<any>(null);
  const [isProcessingVendor, setIsProcessingVendor] = useState(false);
  const [invoiceList, setInvoiceList] = useState<StoredInvoice[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(autoAdvance);
  const [caseName, setCaseName] = useState<string | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('Disbursement modal state changed:', isDisbursementModalOpen);
    console.log('Invoice data available:', !!invoiceData);
  }, [isDisbursementModalOpen, invoiceData]);

  // Load invoice list for navigation
  useEffect(() => {
    const loadInvoiceList = async () => {
      setIsLoadingList(true);
      try {
        const userPermissions = user ? {
          role: user.role,
          assignedStates: user.assignedStates
        } : undefined;
        
        const result = await getInvoicesAction(userPermissions);
        if (result.data) {
          let filtered = result.data;
          
          // Filter based on source context
          if (source === 'approvals') {
            // Show all uploaded/ingested invoices that are not approved
            filtered = filtered.filter(inv => 
              inv.status !== 'Paid' && 
              inv.approvalStatus !== 'Approved'
            );
          } else if (source === 'escalations') {
            filtered = filtered.filter(inv => inv.requiresEscalation === true);
          } else if (source === 'approved-invoices') {
            // Filter for approved invoices: approvalStatus is 'Approved' OR status is 'Pending' (approved invoices)
            filtered = filtered.filter(inv => 
              inv.approvalStatus === 'Approved' || (inv.status === 'Pending' && inv.approvalStatus !== 'Rejected')
            );
          } else {
            // For invoices page, filter out drafts
            filtered = filtered.filter(inv => inv.status !== 'Draft');
          }
          
          setInvoiceList(filtered);
        }
      } catch (error) {
        console.error('Failed to load invoice list:', error);
      } finally {
        setIsLoadingList(false);
      }
    };
    loadInvoiceList();
  }, [source, user]);

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
          setInvoiceData(result.data);
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

  // Memoize validation callback to prevent infinite loops
  const handleValidationChange = useCallback((isValid: boolean, missing: string[]) => {
    setIsFormValid(isValid);
    setMissingFields(missing);
  }, []);

  // Fetch case info when caseNumber is available
  useEffect(() => {
    const fetchCaseInfo = async () => {
      const currentCaseNumber = invoiceData?.caseNumber;
      if (currentCaseNumber) {
        try {
          const result = await getCaseInfoAction(currentCaseNumber);
          if (result.data) {
            setCaseName(result.data.caseName || null);
          } else {
            setCaseName(null);
          }
        } catch (error) {
          console.error('Failed to fetch case info:', error);
          setCaseName(null);
        }
      } else {
        setCaseName(null);
      }
    };
    fetchCaseInfo();
  }, [invoiceData?.caseNumber]);

  // Get current index and navigation info
  const navigationInfo = useMemo(() => {
    const currentIndex = invoiceList.findIndex(inv => inv.id === id);
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < invoiceList.length - 1;
    const previousId = hasPrevious ? invoiceList[currentIndex - 1].id : null;
    const nextId = hasNext ? invoiceList[currentIndex + 1].id : null;
    const position = currentIndex >= 0 ? `${currentIndex + 1} of ${invoiceList.length}` : null;
    
    return { currentIndex, hasPrevious, hasNext, previousId, nextId, position };
  }, [invoiceList, id]);


  const navigateToInvoice = (invoiceId: string) => {
    const params = new URLSearchParams();
    params.set('source', source);
    if (autoAdvanceEnabled) {
      params.set('autoAdvance', 'true');
    }
    router.push(`/invoices/${encodeId(invoiceId)}?${params.toString()}`);
  };

  const handleStatusUpdate = async (status: 'Pending' | 'Draft') => {
    if (!invoiceData) return;
    setIsUpdating(true);
    try {
      await updateInvoiceStatusAction(invoiceData.id, status);
      
      // If approved, open disbursement modal
      if (status === 'Pending') {
        console.log('✅ Invoice approved, opening disbursement modal');
        console.log('Invoice data:', invoiceData?.id);
        console.log('Setting modal state to true');
        
        // Open the disbursement modal FIRST
        setIsDisbursementModalOpen(true);
        
        // Small delay to ensure state is set
        setTimeout(() => {
          console.log('Modal state after timeout:', isDisbursementModalOpen);
        }, 100);
        
        toast({
          title: `Invoice Approved`,
          description: 'Opening disbursement form...',
        });
        
        // Don't auto-advance or reload yet - let modal handle it when closed
        setIsUpdating(false);
        return;
      } else {
        // Rejection - show toast and continue
        toast({
          title: `Invoice Rejected`,
          description: 'The invoice has been rejected and marked as draft.',
        });
      }
      
      // Auto-advance to next invoice if enabled and available
      if (autoAdvanceEnabled && navigationInfo.hasNext && navigationInfo.nextId) {
        // Small delay to show the toast
        setTimeout(() => {
          navigateToInvoice(navigationInfo.nextId!);
        }, 500);
      } else {
        // Reload the list to get updated data
        const userPermissions = user ? {
          role: user.role,
          assignedStates: user.assignedStates
        } : undefined;
        
        const result = await getInvoicesAction(userPermissions);
        if (result.data) {
          let filtered = result.data;
          if (source === 'approvals') {
            filtered = filtered.filter(inv => 
              inv.status === 'Review' && inv.approvalStatus !== 'Approved'
            );
          } else if (source === 'escalations') {
            filtered = filtered.filter(inv => inv.requiresEscalation === true);
          }
          
          // If there are still invoices in the list, navigate to next
          if (filtered.length > 0) {
            const currentIndex = filtered.findIndex(inv => inv.id === id);
            if (currentIndex >= 0 && currentIndex < filtered.length - 1) {
              navigateToInvoice(filtered[currentIndex + 1].id);
            } else if (filtered.length > 0) {
              // Go to first invoice if we were at the end
              navigateToInvoice(filtered[0].id);
            } else {
              // No more invoices, go back to list
              router.push(`/${source}`);
            }
          } else {
            // No more invoices, go back to list
            router.push(`/${source}`);
          }
        } else {
          router.push(`/${source}`);
        }
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
  };

  const handleFlagForReview = async () => {
    if (!invoiceData) return;
    
    // Prevent flagging escalated invoices
    if (invoiceData.requiresEscalation === true) {
      toast({
        variant: 'destructive',
        title: 'Cannot Flag Escalated Invoice',
        description: 'Escalated invoices cannot be flagged for review. They require role-based approval and are handled separately in the Escalations page.',
      });
      return;
    }
    
    setIsUpdating(true);
    try {
      const result = await flagInvoiceForReviewAction(invoiceData.id);
      if (result.success) {
        toast({
          title: 'Invoice Flagged for Review',
          description: 'The invoice has been flagged for review and moved to the approvals queue.',
        });
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
  };

  const handleAddComment = async (comment: string) => {
    if (!invoiceData) return;
    setIsAddingComment(true);
    try {
      const result = await addInvoiceCommentAction(invoiceData.id, comment);
      if (result.success) {
        toast({
          title: 'Comment Added',
          description: 'Your comment has been added to the invoice.',
        });
        const updatedResult = await getInvoiceByIdAction(invoiceData.id);
        if (updatedResult.data) {
          setInvoiceData(updatedResult.data);
        }
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
  };

  const handleCompleteVendorSetup = async (data: {
    vendorType: string;
    email: string;
    phone: string;
    address: string;
    requires1099: boolean;
  }) => {
    if (!pendingVendor) return;

    setIsProcessingVendor(true);
    try {
      const result = await completeVendorSetupAction(pendingVendor.id, {
        vendorType: data.vendorType,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        requires1099: data.requires1099,
      });

      if (result.success) {
        toast({
          title: 'Vendor Setup Completed',
          description: 'The vendor has been added to your vendor list.',
        });
        setIsVendorSetupDialogOpen(false);
        setPendingVendor(null);
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

  const handleFieldHover = (field: string | null, bbox: BoundingBox | null, confidence: number | null) => {
    setHoveredField(field);
    setHighlightBox(bbox);
    setHoveredConfidence(confidence);
  };

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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-4 md:p-8 md:pb-4 pb-4 border-b">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Button asChild variant="outline" size="icon">
              <Link href={`/${source}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3 flex-1">
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
              {navigationInfo.position && (
                <span className="text-sm text-muted-foreground">
                  ({navigationInfo.position})
                </span>
              )}
            </div>
          </div>
          
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            {source === 'approvals' && (
              <div className="flex items-center gap-2 mr-4">
                <Label htmlFor="auto-advance" className="text-sm text-muted-foreground cursor-pointer">
                  Auto-advance
                </Label>
                <Switch
                  id="auto-advance"
                  checked={autoAdvanceEnabled}
                  onCheckedChange={(checked) => {
                    setAutoAdvanceEnabled(checked);
                    const params = new URLSearchParams();
                    params.set('source', source);
                    if (checked) {
                      params.set('autoAdvance', 'true');
                    }
                    router.replace(`/invoices/${encodeId(id)}?${params.toString()}`);
                  }}
                />
              </div>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigationInfo.previousId && navigateToInvoice(navigationInfo.previousId)}
              disabled={!navigationInfo.hasPrevious || isLoadingList}
              title="Previous invoice"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigationInfo.nextId && navigateToInvoice(navigationInfo.nextId)}
              disabled={!navigationInfo.hasNext || isLoadingList}
              title="Next invoice"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Document Viewer - Left Panel */}
        <InvoiceViewer
          invoiceDataUri={invoiceDataUri}
          invoiceId={id}
          highlightBox={highlightBox}
          hoveredField={hoveredField}
          hoveredConfidence={hoveredConfidence}
        />

        {/* Extracted Data Panel - Right Panel (No Scroll) */}
        <div className="w-1/2 flex flex-col overflow-y-auto bg-background">
          <div className="flex-1 p-4">
            {/* Alerts Section - Compact */}
            <div className="space-y-2 mb-4">
              {invoiceData.isDuplicate && invoiceData.duplicateReason && (
                <div className="p-2 rounded-md border border-destructive/50 bg-destructive/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">Duplicate</Badge>
                    <span className="text-xs text-destructive/80">{invoiceData.duplicateReason}</span>
                  </div>
                </div>
              )}
              {invoiceData.vendorRequires1099 && (
                <div className="p-2 rounded-md border border-destructive/50 bg-destructive/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">1099 Required</Badge>
                    <span className="text-xs text-destructive/80">
                      {invoiceData.vendorName?.value
                        ? `"${invoiceData.vendorName.value}" not in vendor list`
                        : 'Vendor not in list'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsVendorSetupDialogOpen(true)}>
                    Setup
                  </Button>
                </div>
              )}
              {invoiceData.hasAmountAnomaly && invoiceData.amountAnomalyReason && (
                <div className="p-2 rounded-md border border-orange-500/50 bg-orange-500/10 flex items-center gap-2">
                  <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400 text-xs">Anomaly</Badge>
                  <span className="text-xs text-orange-700/80 dark:text-orange-400/80">{invoiceData.amountAnomalyReason}</span>
                  {invoiceData.expectedAmount !== undefined && (
                    <span className="text-xs text-orange-700/60 dark:text-orange-400/60 ml-auto">
                      Expected: ${invoiceData.expectedAmount.toFixed(2)} | Current: ${formatTotalAmount(invoiceData.totalAmount?.value)}
                    </span>
                  )}
                </div>
              )}
              {invoiceData.isRecurring && invoiceData.recurringPattern && (
                <div className="p-2 rounded-md border border-blue-500/50 bg-blue-500/10 flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400 text-xs">
                    {invoiceData.recurringPattern.charAt(0).toUpperCase() + invoiceData.recurringPattern.slice(1)}
                  </Badge>
                  <span className="text-xs text-blue-700/80 dark:text-blue-400/80">
                    Recurring bill from {invoiceData.vendorName?.value || 'this vendor'}
                  </span>
                </div>
              )}
            </div>

            {/* Main Extracted Data Panel */}
            <Card className="flex-1">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {invoiceData.caseNumber && caseName
                      ? `${invoiceData.caseNumber} - ${caseName}`
                      : invoiceData.caseNumber
                      ? invoiceData.caseNumber
                      : 'Extracted Data'}
                  </CardTitle>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(invoiceData.amount?.value)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ExtractedDataPanel
                  invoiceData={invoiceData}
                  hoveredField={hoveredField}
                  onFieldHover={handleFieldHover}
                  onInvoiceUpdate={setInvoiceData}
                  onDocumentTypeChange={(newType) => {
                    setInvoiceData(prev => prev ? { ...prev, documentType: newType } : null);
                  }}
                  onValidationChange={handleValidationChange}
                />

                {/* Comment Section */}
                {invoiceData.comment && (
                  <div className="p-3 mx-4 mb-4 rounded-md border bg-muted/50">
                    <Label className="font-medium mb-1 block text-sm">Comment</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoiceData.comment}</p>
                  </div>
                )}

                {/* Disbursement Response Section */}
                {invoiceData.disbursementResponse && (
                  <div className="p-3 mx-4 mb-4 rounded-md border bg-muted/50">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="disbursement-response" className="border-none">
                        <AccordionTrigger className="py-2 hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <Label className="font-medium text-sm">Disbursement Response</Label>
                            <Badge variant="outline" className="text-xs">
                              {(() => {
                                const response = invoiceData.disbursementResponse;
                                if (typeof response === 'object' && response !== null) {
                                  if (response.id && typeof response.id === 'number') {
                                    return `ID: ${response.id}`;
                                  }
                                  if (response.disbursementId && typeof response.disbursementId === 'number') {
                                    return `ID: ${response.disbursementId}`;
                                  }
                                  if (response.status) {
                                    if (typeof response.status === 'string') return response.status;
                                    if (typeof response.status === 'object' && response.status !== null) {
                                      return response.status.description || `Status ID: ${response.status.id}` || 'Status';
                                    }
                                  }
                                  return 'View Details';
                                }
                                return 'View Response';
                              })()}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-4 space-y-4">
                            {(() => {
                              const response = invoiceData.disbursementResponse;
                              if (typeof response !== 'object' || response === null) {
                                return (
                                  <div className="text-sm text-muted-foreground">
                                    {String(response)}
                                  </div>
                                );
                              }

                              // Helper to get value from response
                              const getValue = (key: string): any => {
                                return response[key];
                              };

                              // Helper to format object values (id, description)
                              const formatObjectValue = (obj: any): string => {
                                if (!obj || typeof obj !== 'object') return '';
                                if (obj.description) return obj.description;
                                if (obj.id) return String(obj.id);
                                return JSON.stringify(obj);
                              };

                              // Helper to format date
                              const formatDate = (dateStr: string): string => {
                                if (!dateStr) return '';
                                try {
                                  const date = new Date(dateStr);
                                  return date.toISOString().split('T')[0];
                                } catch {
                                  return dateStr;
                                }
                              };

                              // Helper to format datetime
                              const formatDateTime = (dateStr: string): string => {
                                if (!dateStr) return '';
                                try {
                                  const date = new Date(dateStr);
                                  const year = date.getFullYear();
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const day = String(date.getDate()).padStart(2, '0');
                                  const hours = String(date.getHours()).padStart(2, '0');
                                  const minutes = String(date.getMinutes()).padStart(2, '0');
                                  return `${year}-${month}-${day}T${hours}:${minutes}`;
                                } catch {
                                  return dateStr;
                                }
                              };

                              return (
                                <>
                                  {/* Case ID and Case Number */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Case ID</Label>
                                      <Input
                                        value={getValue('caseID') || ''}
                                        disabled
                                        placeholder="N/A"
                                      />
                                    </div>
                                    <div>
                                      <Label>Case Number</Label>
                                      <Input
                                        value={invoiceData.caseNumber || ''}
                                        disabled
                                        placeholder="No case number"
                                      />
                                    </div>
                                  </div>

                                  {/* Invoice Number and Check Number */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Invoice Number</Label>
                                      <Input
                                        value={getValue('invoiceNumber') || ''}
                                        disabled
                                        placeholder="N/A"
                                      />
                                    </div>
                                    <div>
                                      <Label>Check Number</Label>
                                      <Input
                                        value={getValue('checkNumber') || ''}
                                        disabled
                                        placeholder="N/A"
                                      />
                                    </div>
                                  </div>

                                  {/* Amount */}
                                  <div>
                                    <Label>Amount</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={getValue('amount') || ''}
                                      disabled
                                      placeholder="0.00"
                                    />
                                  </div>

                                  {/* Description */}
                                  <div>
                                    <Label>Description</Label>
                                    <Textarea
                                      value={getValue('description') || ''}
                                      disabled
                                      placeholder="N/A"
                                      rows={3}
                                    />
                                  </div>

                                  {/* Invoice Date */}
                                  <div>
                                    <Label>Invoice Date</Label>
                                    <Input
                                      type="date"
                                      value={formatDate(getValue('invoiceDate') || '')}
                                      disabled
                                    />
                                  </div>

                                  {/* Disbursement Type and Status */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Disbursement Type</Label>
                                      <Input
                                        value={formatObjectValue(getValue('disbursementType'))}
                                        disabled
                                        placeholder="N/A"
                                      />
                                    </div>
                                    <div>
                                      <Label>Disbursement Status</Label>
                                      <Input
                                        value={formatObjectValue(getValue('status'))}
                                        disabled
                                        placeholder="N/A"
                                      />
                                    </div>
                                  </div>

                                  {/* Payee */}
                                  <div>
                                    <Label>Payee (Vendor)</Label>
                                    <div className="space-y-2">
                                      <Input
                                        value={getValue('payee')?.name || ''}
                                        disabled
                                        placeholder="N/A"
                                      />
                                      {getValue('payee')?.contactId && (
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 border-green-300 text-green-700 dark:text-green-400">
                                            ✓ Contact ID: {getValue('payee').contactId}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Plaintiff ID */}
                                  <div>
                                    <Label>Plaintiff ID</Label>
                                    <Input
                                      type="number"
                                      value={getValue('client')?.[0]?.id || ''}
                                      disabled
                                      placeholder="N/A"
                                    />
                                  </div>

                                  {/* Checkboxes */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={getValue('recoverable') || false}
                                        disabled
                                        className="rounded"
                                      />
                                      <Label className="cursor-default">Recoverable</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={getValue('shareAcrossClients') || false}
                                        disabled
                                        className="rounded"
                                      />
                                      <Label className="cursor-default">Share Across Clients</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={getValue('waived') || false}
                                        disabled
                                        className="rounded"
                                      />
                                      <Label className="cursor-default">Waived</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={getValue('isLienor') || false}
                                        disabled
                                        className="rounded"
                                      />
                                      <Label className="cursor-default">Is Lienor</Label>
                                    </div>
                                  </div>

                                  {/* Comments */}
                                  <div>
                                    <Label>Comments</Label>
                                    <Textarea
                                      value={getValue('comments') || ''}
                                      disabled
                                      placeholder="N/A"
                                      rows={3}
                                    />
                                  </div>

                                  {/* Additional Fields */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Document IDs</Label>
                                      <Input
                                        value={Array.isArray(getValue('documentIDs')) 
                                          ? getValue('documentIDs').join(', ') 
                                          : getValue('documentIDs') || ''}
                                        disabled
                                        placeholder="N/A"
                                      />
                                    </div>
                                    <div>
                                      <Label>Status Date</Label>
                                      <Input
                                        type="datetime-local"
                                        value={formatDateTime(getValue('statusDate') || '')}
                                        disabled
                                      />
                                    </div>
                                  </div>

                                  {/* Custom Field */}
                                  <div>
                                    <Label>Custom Field 1</Label>
                                    <Input
                                      value={getValue('customField1') || ''}
                                      disabled
                                      placeholder="N/A"
                                    />
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </CardContent>

              {/* Action Buttons */}
              <CardFooter className="justify-end gap-2 py-3 px-4 border-t">
                {invoiceData.status === 'Review' ? (
                  <>
                    <Button variant="outline" onClick={() => handleStatusUpdate('Draft')} disabled={isUpdating || invoiceData.vendorRequires1099}>
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button 
                      onClick={() => handleStatusUpdate('Pending')} 
                      disabled={isUpdating || invoiceData.vendorRequires1099 || !isFormValid} 
                      title={
                        invoiceData.vendorRequires1099 
                          ? 'Vendor must be set up before approving' 
                          : !isFormValid && missingFields.length > 0
                          ? `Please fill in required fields: ${missingFields.join(', ')}`
                          : ''
                      }
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    {invoiceData.vendorRequires1099 && (
                      <p className="text-xs text-muted-foreground self-center">
                        Complete vendor setup to approve
                      </p>
                    )}
                    {!isFormValid && missingFields.length > 0 && !invoiceData.vendorRequires1099 && (
                      <p className="text-xs text-destructive self-center">
                        Required fields missing: {missingFields.join(', ')}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFlagForReview}
                      disabled={isUpdating || invoiceData.vendorRequires1099 || invoiceData.requiresEscalation === true}
                      title={
                        invoiceData.vendorRequires1099
                          ? 'Vendor must be set up first'
                          : invoiceData.requiresEscalation === true
                          ? 'Escalated invoices cannot be flagged for review'
                          : ''
                      }
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      Flag
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsCommentDialogOpen(true)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Comment
                    </Button>
                    <Button size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      <CommentDialog
        open={isCommentDialogOpen}
        onOpenChange={setIsCommentDialogOpen}
        title="Add Comment"
        description="Add a comment or note to this invoice. This will be visible to all users reviewing the invoice."
        placeholder="Enter your comment here..."
        isSubmitting={isAddingComment}
        onSubmit={handleAddComment}
      />

      {/* Disbursement Form Modal */}
      {invoiceData && (
        <DisbursementFormModal
          isOpen={isDisbursementModalOpen}
          onOpenChange={(open) => {
            console.log('Disbursement modal onOpenChange called with:', open);
            setIsDisbursementModalOpen(open);
            if (!open && invoiceData) {
              // Reload invoice list to get updated data
              const reloadData = async () => {
                const userPermissions = user ? {
                  role: user.role,
                  assignedStates: user.assignedStates
                } : undefined;
                
                const result = await getInvoicesAction(userPermissions);
                if (result.data) {
                  let filtered = result.data;
                  if (source === 'approvals') {
                    filtered = filtered.filter(inv => 
                      inv.status !== 'Paid' && 
                      inv.approvalStatus !== 'Approved'
                    );
                  }
                  setInvoiceList(filtered);
                }
              };
              
              reloadData();
              
              // If auto-advance is enabled, navigate to next invoice
              if (autoAdvanceEnabled && navigationInfo.hasNext && navigationInfo.nextId) {
                setTimeout(() => {
                  navigateToInvoice(navigationInfo.nextId!);
                }, 500);
              } else if (source === 'approvals') {
                // If on approvals page, go back to approvals list
                router.push('/approvals');
              }
            }
          }}
          invoice={invoiceData}
        />
      )}

      <VendorSetupDialog
        open={isVendorSetupDialogOpen}
        onOpenChange={setIsVendorSetupDialogOpen}
        vendor={pendingVendor}
        caseNumber={invoiceData?.caseNumber}
        invoiceId={invoiceData?.id}
        isProcessing={isProcessingVendor}
        onSubmit={handleCompleteVendorSetup}
      />
    </div>
  );
}
