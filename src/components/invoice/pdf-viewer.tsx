
'use client';

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDFViewerProps {
  file: string;
}

export function PDFViewer({ file }: PDFViewerProps) {
  // Set up the worker
  // This is critical for react-pdf to work with Next.js/Turbopack
  // Use local worker file from public folder instead of CDN to avoid fetch errors
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }, []);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
            <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Loading PDF...
            </div>
        }
        error={
            <div className="text-destructive-foreground">
                Failed to load PDF file.
            </div>
        }
        className="flex justify-center"
      >
        <Page pageNumber={pageNumber} renderTextLayer={false} />
      </Document>
      {numPages && numPages > 1 && (
        <div className="flex items-center justify-center space-x-4 mt-4 p-2 bg-background rounded-full border shadow-md">
          <Button 
            variant="ghost" 
            size="icon" 
            disabled={pageNumber <= 1} 
            onClick={previousPage}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Page {pageNumber} of {numPages}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            disabled={pageNumber >= numPages} 
            onClick={nextPage}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
