'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, MessageSquare, Flag, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect } from 'react';
import { type StoredInvoice } from '@/lib/domain/types';
import { cn } from '@/lib/utils/utils';
import { updateInvoiceStatusAction, getInvoiceByIdAction, getInvoiceDataUriAction, flagInvoiceForReviewAction, addInvoiceCommentAction, updateInvoiceCaseNumberAction, completeVendorSetupAction } from '@/lib/actions/index';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { VendorSetupDialog } from '@/components/dialogs/vendor-setup-dialog';
import { CommentDialog } from '@/components/dialogs/comment-dialog';
import { InvoiceViewer } from '@/components/invoice/invoice-viewer';
import { FieldsList } from '@/components/invoice/fields-list';
import { decodeId } from '@/lib/utils/id-utils';
import { getDocumentTypeBadgeClass, getDocumentTypeDescription } from '@/lib/utils/document-type-utils';
import { formatTotalAmount } from '@/lib/utils/invoice-utils';
import type { BoundingBox } from '@/lib/utils/bbox-utils';

export default function InvoiceDetailPage() {
  const params = useParams();
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
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isVendorSetupDialogOpen, setIsVendorSetupDialogOpen] = useState(false);
  const [pendingVendor, setPendingVendor] = useState<any>(null);
  const [isProcessingVendor, setIsProcessingVendor] = useState(false);

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
  };

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
        <InvoiceViewer
          invoiceDataUri={invoiceDataUri}
          invoiceId={id}
          highlightBox={highlightBox}
          hoveredField={hoveredField}
          hoveredConfidence={hoveredConfidence}
        />
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
                    <Label htmlFor="case-number" className="mb-2 block">
                      Case Number
                      {(invoiceData.clientName || invoiceData.customerName) && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      id="case-number"
                      value={invoiceData.caseNumber || ''}
                      onChange={async (e) => {
                        const caseNumber = e.target.value;
                        if (invoiceData) {
                          const result = await updateInvoiceCaseNumberAction(invoiceData.id, caseNumber);
                          if (result.success) {
                            const updatedResult = await getInvoiceByIdAction(invoiceData.id);
                            if (updatedResult.data) {
                              setInvoiceData(updatedResult.data);
                              const stateName = updatedResult.data.state === 'CA' ? 'California' : updatedResult.data.state === 'NY' ? 'New York' : null;
                              toast({
                                title: 'Case Number Updated',
                                description: stateName ? `Case number saved. State auto-detected: ${stateName}.` : 'The case number has been saved.',
                              });
                            } else {
                              toast({
                                title: 'Case Number Updated',
                                description: 'The case number has been saved.',
                              });
                            }
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
                    {(invoiceData.clientName || invoiceData.customerName) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Required when plaintiff name is present
                      </p>
                    )}
                  </div>
                  <FieldsList
                    invoiceData={invoiceData}
                    hoveredField={hoveredField}
                    onFieldHover={handleFieldHover}
                  />
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

      <CommentDialog
        open={isCommentDialogOpen}
        onOpenChange={setIsCommentDialogOpen}
        title="Add Comment"
        description="Add a comment or note to this invoice. This will be visible to all users reviewing the invoice."
        placeholder="Enter your comment here..."
        isSubmitting={isAddingComment}
        onSubmit={handleAddComment}
      />

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
