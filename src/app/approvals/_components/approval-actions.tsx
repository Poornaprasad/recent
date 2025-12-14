'use client';

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updateInvoiceStatusAction } from '@/lib/actions/index';
import { Check, Eye, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { encodeId } from "@/lib/utils/id-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function ApprovalActions({ 
  invoiceId, 
  onApprovalChange,
  isSameCaseDuplicate = false,
  caseNumber
}: { 
  invoiceId: string; 
  onApprovalChange?: () => void;
  isSameCaseDuplicate?: boolean;
  caseNumber?: string;
}) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
    const [approvalReason, setApprovalReason] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusUpdate = async (status: 'Pending' | 'Draft', reason?: string) => {
        setIsUpdating(true);
        try {
            await updateInvoiceStatusAction(invoiceId, status);
            toast({
                title: `Invoice ${status === 'Pending' ? 'Approved' : 'Rejected'}`,
                description: status === 'Pending' 
                  ? 'The invoice has been approved and moved to the invoices list.'
                  : 'The invoice has been rejected and marked as draft.',
            });
            // Trigger callback to reload data, or refresh the page
            if (onApprovalChange) {
                onApprovalChange();
            } else {
                window.location.reload();
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: 'Could not update the invoice status.',
            });
        } finally {
            setIsUpdating(false);
            setIsDialogOpen(false);
            setApprovalReason('');
            setPendingAction(null);
        }
    }

    const handleApproveClick = () => {
        if (isSameCaseDuplicate) {
            // Require approval reason for same-case duplicates
            setPendingAction('approve');
            setIsDialogOpen(true);
        } else {
            // Direct approval for non-duplicates
            handleStatusUpdate('Pending');
        }
    };

    const handleRejectClick = () => {
        setPendingAction('reject');
        setIsDialogOpen(true);
    };

    const handleDialogSubmit = () => {
        if (pendingAction === 'approve' && isSameCaseDuplicate && !approvalReason.trim()) {
            toast({
                variant: 'destructive',
                title: 'Approval Reason Required',
                description: 'Please provide a reason for approving duplicate invoices with the same case number.',
            });
            return;
        }

        const reason = pendingAction === 'approve' && isSameCaseDuplicate 
            ? approvalReason 
            : pendingAction === 'reject'
            ? approvalReason || 'Rejected by reviewer'
            : undefined;

        handleStatusUpdate(pendingAction === 'approve' ? 'Pending' : 'Draft', reason);
    };

    return (
        <>
            <div className="flex items-center justify-end gap-2">
                <Button asChild variant="outline" size="sm" className="mr-2">
                    <Link href={`/invoices/${encodeId(invoiceId)}?source=approvals&autoAdvance=true`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Review
                    </Link>
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleApproveClick} 
                    disabled={isUpdating}
                    title="Approve"
                >
                    <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleRejectClick} 
                    disabled={isUpdating}
                    title="Reject"
                >
                    <X className="h-4 w-4 text-red-600" />
                </Button>
            </div>

            {/* Approval/Rejection Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {pendingAction === 'approve' ? 'Approve Invoice' : 'Reject Invoice'}
                        </DialogTitle>
                        <DialogDescription>
                            {pendingAction === 'approve' && isSameCaseDuplicate
                                ? `This invoice is a duplicate with the same case number (${caseNumber}). Please provide a reason for approval.`
                                : pendingAction === 'approve'
                                ? 'Are you sure you want to approve this invoice?'
                                : 'Please provide a reason for rejecting this invoice.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reason">
                            {pendingAction === 'approve' && isSameCaseDuplicate ? 'Approval Reason' : 'Reason'} 
                            {(pendingAction === 'approve' && isSameCaseDuplicate) || pendingAction === 'reject' ? (
                                <span className="text-destructive"> *</span>
                            ) : null}
                        </Label>
                        <Textarea
                            id="reason"
                            placeholder={
                                pendingAction === 'approve' && isSameCaseDuplicate
                                    ? "Explain why you're approving this duplicate invoice..."
                                    : pendingAction === 'reject'
                                    ? "Explain why you're rejecting this invoice..."
                                    : "Optional reason..."
                            }
                            value={approvalReason}
                            onChange={(e) => setApprovalReason(e.target.value)}
                            rows={4}
                        />
                        {pendingAction === 'approve' && isSameCaseDuplicate && (
                            <p className="text-sm text-muted-foreground">
                                A reason is required when approving duplicate invoices with the same case number.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsDialogOpen(false);
                            setApprovalReason('');
                            setPendingAction(null);
                        }} disabled={isUpdating}>
                            Cancel
                        </Button>
                        <Button onClick={handleDialogSubmit} disabled={isUpdating}>
                            {isUpdating ? 'Processing...' : (pendingAction === 'approve' ? 'Approve' : 'Reject')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
