
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StoredInvoice } from '@/lib/domain/types';
import { processInvoiceAction, getPendingVendorByInvoiceIdAction, completeVendorSetupAction, getVendorTypesAction, lookupContactsAction } from '@/lib/actions/index';
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/hooks/use-auth-store";
import { UploadView } from "@/components/invoice/upload-view";
import { ReviewView } from "@/components/invoice/review-view";
import { LoadingView } from "@/components/invoice/loading-view";
import { BulkProcessingView } from "@/components/invoice/bulk-processing-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Search, Loader2 } from "lucide-react";
import type { ContactLookupResult } from '@/lib/crm/smartadvocate/types';
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

interface FileProgress {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  invoiceId?: string;
}

export default function InvoiceProcessorPage() {
  const { user } = useAuthStore();
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
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<ContactLookupResult[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [contactSearchError, setContactSearchError] = useState<string>('');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkProgress, setBulkProgress] = useState<FileProgress[]>([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const processSingleFile = async (file: File): Promise<{ success: boolean; error?: string; invoiceId?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          let invoiceDataUri = reader.result as string;

          const mimeType = invoiceDataUri.split(';')[0].split(':')[1];
          const validMimeTypes = ['image/png', 'image/jpeg', 'image/heic', 'image/jpg', 'application/pdf'];

          if (!validMimeTypes.includes(mimeType.toLowerCase()) && !mimeType.startsWith('image/')) {
            resolve({ success: false, error: "Invalid file type. Please upload an image or a PDF." });
            return;
          }

          // Convert PDF to image on client side if it's a PDF
          if (mimeType === 'application/pdf') {
            try {
              invoiceDataUri = await convertPdfToImageClient(invoiceDataUri);
            } catch (conversionError) {
              const errorMessage = conversionError instanceof Error 
                ? conversionError.message 
                : 'Failed to convert PDF to image.';
              resolve({ success: false, error: errorMessage });
              return;
            }
          }

          const result = await processInvoiceAction({ invoiceDataUri });
          if (result.error) {
            resolve({ success: false, error: result.error });
            return;
          }

          resolve({ success: true, invoiceId: result.data?.id });
        } catch (e: any) {
          const errorMessage = e.message || "An unexpected error occurred. Please try again.";
          resolve({ success: false, error: errorMessage });
        }
      };
      reader.onerror = () => {
        resolve({ success: false, error: "Failed to read the file." });
      };
    });
  };

  const handleFileSelect = async (files: File[]) => {
    if (!files || files.length === 0) return;

    // Single file handling (existing behavior)
    if (files.length === 1) {
      const file = files[0];
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
        setError("Failed to read the file.");
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: "Could not read the selected file. Please try again.",
        });
        setIsLoading(false);
      };
      return;
    }

    // Bulk file handling
    setIsBulkProcessing(true);
    setBulkFiles(files);
    setError(null);
    
    // Initialize progress
    const initialProgress: FileProgress[] = files.map(file => ({
      file,
      status: 'pending'
    }));
    setBulkProgress(initialProgress);
    setCurrentProcessingIndex(0);

    // Process files sequentially
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      setCurrentProcessingIndex(i);
      
      // Update status to processing
      setBulkProgress(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'processing' };
        return updated;
      });

      const result = await processSingleFile(files[i]);

      // Update status based on result
      setBulkProgress(prev => {
        const updated = [...prev];
        updated[i] = {
          ...updated[i],
          status: result.success ? 'completed' : 'error',
          error: result.error,
          invoiceId: result.invoiceId
        };
        return updated;
      });

      if (result.success) {
        successCount++;
        toast({
          title: "Invoice Processed",
          description: `${files[i].name} has been processed successfully.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Processing Failed",
          description: `${files[i].name}: ${result.error}`,
        });
      }
    }

    // All files processed
    toast({
      title: "Bulk Upload Complete",
      description: `Successfully processed ${successCount} of ${files.length} invoices.`,
    });

    // Redirect to invoices page after a short delay
    setTimeout(() => {
      setIsBulkProcessing(false);
      router.push('/invoices');
    }, 2000);
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

  const DuplicateAlert = ({reason}: {reason: string}) => {
    // Parse the reason to extract status information
    const isOriginalApproved = reason.includes('Original invoice has been approved and pushed to CRM');
    const isOriginalNotApproved = reason.includes('Original invoice is not yet approved/pushed to CRM');
    
    // Extract the main duplicate message (before the status info)
    const mainMessage = reason.split('. Original invoice')[0];
    
    return (
      <div className="container py-4">
          <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Potential Duplicate Detected</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>{mainMessage}</p>
                  {isOriginalApproved && (
                    <div className="mt-2 p-2 rounded-md bg-yellow-500/20 border border-yellow-500/50">
                      <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                        ⚠️ Original invoice has been approved and pushed to CRM
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        This is a duplicate of an invoice that has already been processed and sent to the CRM system.
                      </p>
                    </div>
                  )}
                  {isOriginalNotApproved && (
                    <div className="mt-2 p-2 rounded-md bg-blue-500/20 border border-blue-500/50">
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        ℹ️ Original invoice is not yet approved/pushed to CRM
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        The original invoice exists but has not been fully processed yet.
                      </p>
                    </div>
                  )}
                </div>
              </AlertDescription>
          </Alert>
      </div>
    )
  }

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

  // Search for vendor contact using CRM lookup API
  const searchContacts = async (searchQuery: string) => {
    if (!searchQuery || !searchQuery.trim()) {
      setContactSearchResults([]);
      return;
    }

    setIsSearchingContacts(true);
    setContactSearchError('');
    
    try {
      const trimmedName = searchQuery.trim();
      let params: { name?: string; firstName?: string; lastName?: string } = {};

      // Check if it looks like a company name (contains LLC, Inc, Corp, etc. or has a comma)
      const isCompanyName = /(LLC|Inc|Corp|Ltd|Company|Co\.|,)/i.test(trimmedName);
      
      if (isCompanyName) {
        params.name = trimmedName;
      } else {
        const nameParts = trimmedName.split(/\s+/);
        if (nameParts.length === 1) {
          params.name = nameParts[0];
        } else if (nameParts.length >= 2) {
          params.firstName = nameParts[0];
          params.lastName = nameParts.slice(1).join(' ');
        }
      }

      // First, try the full search
      let result = await lookupContactsAction({
        ...params,
        rowLimit: 50,
      });

      let results: ContactLookupResult[] = [];
      let searchError = '';

      if (result.error) {
        searchError = result.error;
      } else if (result.data) {
        results = result.data;
      }

      // If no results and it's a company name, try without company suffix for partial matching
      if (results.length === 0 && isCompanyName) {
        // Remove common company suffixes and try again
        const nameWithoutSuffix = trimmedName
          .replace(/,\s*(Inc|LLC|Corp|Ltd|Company|Co\.?|Incorporated|Corporation)\s*\.?$/i, '')
          .replace(/\s+(Inc|LLC|Corp|Ltd|Company|Co\.?|Incorporated|Corporation)\s*\.?$/i, '')
          .trim();

        if (nameWithoutSuffix && nameWithoutSuffix !== trimmedName) {
          console.log('Trying fallback search with:', nameWithoutSuffix);
          // Try searching with the name without suffix
          const fallbackResult = await lookupContactsAction({
            name: nameWithoutSuffix,
            rowLimit: 50,
          });

          if (fallbackResult.error) {
            // If fallback also has error, use original error or generic message
            if (!searchError) {
              searchError = fallbackResult.error;
            }
          } else if (fallbackResult.data && fallbackResult.data.length > 0) {
            results = fallbackResult.data;
            searchError = ''; // Clear error if we found results
            console.log('Fallback search found', results.length, 'results');
          } else if (!searchError) {
            searchError = 'No contacts found matching this name.';
          }
        } else if (!searchError) {
          searchError = 'No contacts found matching this name.';
        }
      } else if (results.length === 0 && !searchError) {
        searchError = 'No contacts found matching this name.';
      }

      setContactSearchResults(results);
      setContactSearchError(searchError);
    } catch (error) {
      console.error('Error searching contacts:', error);
      setContactSearchError('Failed to search contacts. Please try again.');
      setContactSearchResults([]);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleSelectContact = (contact: ContactLookupResult) => {
    if (contact.email) {
      setEmail(contact.email);
    }
    if (contact.phone) {
      setPhone(contact.phone);
    }
    if (contact.address) {
      setAddress(contact.address);
    }
    setIsLookupOpen(false);
    toast({
      title: 'Contact Selected',
      description: 'Vendor information has been auto-filled from CRM.',
    });
  };

  const handleCompleteVendorSetup = async () => {
    if (!pendingVendor || !vendorType) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a contact type.',
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
      }, user?.id);

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

  if (isBulkProcessing) {
    return (
      <BulkProcessingView
        files={bulkFiles}
        progress={bulkProgress}
        currentIndex={currentProcessingIndex}
      />
    );
  }

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
            
            {/* Lookup Vendor Button */}
            <div className="flex justify-center items-center py-3 px-4 bg-muted/50 rounded-md border border-dashed">
              <Button
                variant="default"
                size="default"
                onClick={() => {
                  setIsLookupOpen(true);
                  if (pendingVendor?.name) {
                    setContactSearchQuery(pendingVendor.name);
                    searchContacts(pendingVendor.name);
                  }
                }}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                Lookup Vendor in CRM
              </Button>
            </div>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Contact Type *</Label>
                <Select value={vendorType} onValueChange={setVendorType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact type" />
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

        {/* Vendor Lookup Dialog */}
        <Dialog open={isLookupOpen} onOpenChange={setIsLookupOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Lookup Vendor in CRM</DialogTitle>
              <DialogDescription>
                Search for vendor contacts in SmartAdvocate CRM to auto-fill vendor information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Search Input */}
              <div className="flex gap-2">
                <Input
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchContacts(contactSearchQuery);
                    }
                  }}
                  placeholder="Search by name, first name, or last name..."
                  className="flex-1"
                />
                <Button
                  onClick={() => searchContacts(contactSearchQuery)}
                  disabled={isSearchingContacts || !contactSearchQuery.trim()}
                >
                  {isSearchingContacts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Error Message */}
              {contactSearchError && (
                <div className="flex items-start gap-2 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{contactSearchError}</p>
                </div>
              )}

              {/* Search Results */}
              {contactSearchResults.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  <Label className="text-sm font-medium">Select a contact:</Label>
                  <div className="space-y-1">
                    {contactSearchResults.map((contact, index) => {
                      const contactName = contact.name || (contact.firstName && contact.lastName 
                        ? `${contact.firstName} ${contact.lastName}`.trim() 
                        : contact.firstName || contact.lastName || 'Unknown');
                      
                      const uniqueKey = `contact-${contact.contactId || 'unknown'}-${index}-${contactName}`;
                      
                      return (
                        <div
                          key={uniqueKey}
                          className="p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleSelectContact(contact)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{contactName}</div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {contact.contactType && (
                                  <div>Type: {contact.contactType}</div>
                                )}
                                {contact.email && (
                                  <div>Email: {contact.email}</div>
                                )}
                                {contact.phone && (
                                  <div>Phone: {contact.phone}</div>
                                )}
                                {contact.address && (
                                  <div>Address: {contact.address}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLookupOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return <UploadView onFileSelect={handleFileSelect} error={error} />;
}
