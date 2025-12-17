"use client";

import type { StoredInvoice, DocumentType } from '@/lib/domain/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useState } from "react";
import { InvoiceViewer } from './invoice-viewer';
import { ExtractedDataPanel } from './extracted-data-panel';
import type { BoundingBox } from '@/lib/utils/bbox-utils';

interface ReviewViewProps {
  data: StoredInvoice;
  invoicePreviewUrl: string;
  onSave: (data: any) => void;
  onReset: () => void;
}

export function ReviewView({
  data,
  invoicePreviewUrl,
  onSave,
  onReset,
}: ReviewViewProps) {
  const [invoiceData, setInvoiceData] = useState<StoredInvoice>(data);
  const [highlightBox, setHighlightBox] = useState<BoundingBox | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [hoveredConfidence, setHoveredConfidence] = useState<number | null>(null);

  const handleFieldHover = (field: string | null, bbox: BoundingBox | null, confidence: number | null) => {
    setHoveredField(field);
    setHighlightBox(bbox);
    setHoveredConfidence(confidence);
  };

  const handleInvoiceUpdate = (updatedInvoice: StoredInvoice) => {
    setInvoiceData(updatedInvoice);
  };

  const handleDocumentTypeChange = (newType: DocumentType) => {
    setInvoiceData(prev => ({ ...prev, documentType: newType }));
  };

  const handleSave = () => {
    onSave(invoiceData);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Document Viewer - Left Panel */}
        <InvoiceViewer
          invoiceDataUri={invoicePreviewUrl}
          invoiceId={invoiceData.id}
          highlightBox={highlightBox}
          hoveredField={hoveredField}
          hoveredConfidence={hoveredConfidence}
        />

        {/* Extracted Data Panel - Right Panel */}
        <div className="w-1/2 flex flex-col overflow-y-auto bg-background">
          <div className="flex-1 p-4">
            <Card className="flex-1">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-lg">Extracted Data</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ExtractedDataPanel
                  invoiceData={invoiceData}
                  hoveredField={hoveredField}
                  onFieldHover={handleFieldHover}
                  onInvoiceUpdate={handleInvoiceUpdate}
                  onDocumentTypeChange={handleDocumentTypeChange}
                />
              </CardContent>
              <CardFooter className="flex justify-end gap-2 py-3 px-4 border-t">
                <Button type="button" variant="outline" onClick={onReset}>
                  Process Another
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
