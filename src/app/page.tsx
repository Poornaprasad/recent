
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StoredInvoice } from "@/lib/invoice-types";
import { processInvoiceAction, getPendingVendorByInvoiceIdAction, completeVendorSetupAction, getVendorTypesAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { UploadView } from "@/components/invoice/upload-view";
import { ReviewView } from "@/components/invoice/review-view";
import { LoadingView } from "@/components/invoice/loading-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { convertPdfToImageClient } from "@/lib/pdf-to-image-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export default function InvoiceProcessorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] =
    useState<StoredInvoice | null>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(
    null
  );
  const [pendingVendor, setPendingVendor] = useState<any>(null);
  const [isVendorSetupDialogOpen, setIsVendorSetupDialogOpen] = useState(false);
  const [vendorTypes, setVendorTypes] = useState<Array<{ name: string; description?: string }>>([]);
  const [vendorType, setVendorType] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [requires1099, setRequires1099] = useState(true);
  const [isProcessingVendor, setIsProcessingVendor] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setExtractedData(null);
    setInvoicePreviewUrl(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      let invoiceDataUri = reader.result as string;
      setInvoicePreviewUrl(invoiceDataUri);

      const mimeType = invoiceDataUri.split(';')[0].split(':')[1];
      const validMimeTypes = ['image/png', 'image/jpeg', 'image/heic', 'image/jpg', 'application/pdf'];

      if (!validMimeTypes.includes(mimeType.toLowerCase()) && !mimeType.startsWith('image/')) {
         setError("Invalid file type. Please upload an image or a PDF.");
         toast({
            variant: "destructive",
            title: "Invalid File Type",
            description: "Please upload a PNG, JPG, HEIC, or PDF file.",
         });
         setIsLoading(false);
         setInvoicePreviewUrl(null);
         return;
      }

      // Convert PDF to image on client side if it's a PDF
      if (mimeType === 'application/pdf') {
        try {
          invoiceDataUri = await convertPdfToImageClient(invoiceDataUri);
          setInvoicePreviewUrl(invoiceDataUri);
        } catch (conversionError) {
          const errorMessage = conversionError instanceof Error 
            ? conversionError.message 
            : 'Failed to convert PDF to image.';
          setError(errorMessage);
          toast({
            variant: "destructive",
            title: "PDF Conversion Failed",
            description: errorMessage,
          });
          setIsLoading(false);
          setInvoicePreviewUrl(null);
          return;
        }
      }

      try {
        const result = await processInvoiceAction({ invoiceDataUri });
        if (result.error) {
          throw new Error(result.error);
        }
        setExtractedData(result.data || null);
        
        // Check if there's a pending vendor for this invoice
        if (result.data?.id) {
          const pendingResult = await getPendingVendorByInvoiceIdAction(result.data.id);
          if (pendingResult.data) {
            setPendingVendor(pendingResult.data);
            setIsVendorSetupDialogOpen(true);
          }
        }
        
        // Load vendor types
        const typesResult = await getVendorTypesAction();
        if (typesResult.data) {
          setVendorTypes(typesResult.data.map(t => ({ name: t.name, description: t.description })));
        }
      } catch (e: any) {
        const errorMessage =
          e.message || "An unexpected error occurred. Please try again.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Processing Failed",
          description: errorMessage,
        });
        setExtractedData(null);
        setInvoicePreviewUrl(null);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = (error) => {
      console.error("FileReader error: ", error);
      setError("Failed to read the file.");
      toast({
        variant: "destructive",
        title: "File Read Error",
        description: "Could not read the selected file. Please try again.",
      });
      setIsLoading(false);
    };
  };

  const handleReset = () => {
    setIsLoading(false);
    setError(null);
    setExtractedData(null);
    setInvoicePreviewUrl(null);
  };

  const handleSaveChanges = (data: any) => {
    toast({
      title: "Invoice Saved",
      description: "The new invoice has been added to the list.",
    });
    router.push('/invoices');
  };

  const DuplicateAlert = ({reason}: {reason: string}) => (
    <div className="container py-4">
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Potential Duplicate Detected</AlertTitle>
            <AlertDescription>{reason}</AlertDescription>
        </Alert>
    </div>
  )

  const Vendor1099Alert = ({vendorName}: {vendorName?: string}) => (
    <div className="container py-4">
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>1099 Request Required</AlertTitle>
            <AlertDescription>
              {vendorName 
                ? `Vendor "${vendorName}" is not in your vendor list. Please complete vendor setup below to proceed.`
                : 'This vendor is not in your vendor list. Please complete vendor setup to proceed.'}
            </AlertDescription>
        </Alert>
    </div>
  )

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
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        requires1099,
      });

      if (result.success) {
        toast({
          title: 'Vendor Setup Completed',
          description: 'The vendor has been added to your vendor list. You can now proceed with the invoice.',
        });
        setIsVendorSetupDialogOpen(false);
        setPendingVendor(null);
        // Refresh invoice data to clear vendorRequires1099 flag
        if (extractedData?.id) {
          const refreshResult = await processInvoiceAction({ invoiceDataUri: invoicePreviewUrl || '' });
          if (refreshResult.data) {
            setExtractedData(refreshResult.data);
          }
        }
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

  if (isLoading) {
    return <LoadingView />;
  }

  if (extractedData && invoicePreviewUrl) {
    return (
      <>
        {extractedData.isDuplicate && extractedData.duplicateReason && (
            <DuplicateAlert reason={extractedData.duplicateReason} />
        )}
        {extractedData.vendorRequires1099 && (
            <Vendor1099Alert vendorName={extractedData.vendorName?.value} />
        )}
        <ReviewView
            data={extractedData}
            invoicePreviewUrl={invoicePreviewUrl}
            onReset={handleReset}
            onSave={handleSaveChanges}
        />

        {/* Vendor Setup Dialog */}
        <Dialog open={isVendorSetupDialogOpen} onOpenChange={setIsVendorSetupDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Complete Vendor Setup</DialogTitle>
              <DialogDescription>
                Vendor "{pendingVendor?.name}" needs to be added to your vendor list before this invoice can be processed.
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  placeholder="123 Main St, City, State ZIP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                Skip for Now
              </Button>
              <Button onClick={handleCompleteVendorSetup} disabled={!vendorType || isProcessingVendor}>
                {isProcessingVendor ? 'Processing...' : 'Complete Setup'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return <UploadView onFileSelect={handleFileSelect} error={error} />;
}
