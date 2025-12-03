
'use client';

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updateInvoiceStatusAction } from '@/lib/actions/index';
import { Check, Eye, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { encodeId } from "@/lib/utils/id-utils";

export function ApprovalActions({ invoiceId }: { invoiceId: string }) {
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusUpdate = async (status: 'Pending' | 'Draft') => {
        setIsUpdating(true);
        try {
            await updateInvoiceStatusAction(invoiceId, status);
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
              router.refresh(); // Refresh the page to show the updated list
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

    return (
        <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm" className="mr-2">
                <Link href={`/invoices/${encodeId(invoiceId)}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Review
                </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate('Pending')} disabled={isUpdating}>
                <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate('Draft')} disabled={isUpdating}>
                <X className="h-4 w-4 text-red-600" />
            </Button>
        </div>
    );
}

    