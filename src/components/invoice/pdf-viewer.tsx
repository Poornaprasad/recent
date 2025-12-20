
'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/utils';

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
  const [scale, setScale] = useState(1.0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3.0;
  const SCALE_STEP = 0.25;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.max(1, Math.min(newPage, numPages || 1));
    });
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  function zoomIn() {
    setScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }

  function zoomOut() {
    setScale(prev => Math.max(prev - SCALE_STEP, MIN_SCALE));
  }

  function resetZoom() {
    setScale(1.0);
    // Scroll to top when resetting zoom
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls Bar - Always visible */}
      <div className="flex items-center justify-between p-2 bg-background border-b gap-2 flex-shrink-0 z-10">
        {/* Page Navigation */}
        <div className="flex items-center gap-2">
          {numPages && numPages > 1 ? (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                disabled={pageNumber <= 1} 
                onClick={previousPage}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground min-w-[80px] text-center">
                Page {pageNumber} of {numPages}
              </span>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                disabled={pageNumber >= numPages} 
                onClick={nextPage}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              PDF Viewer
            </span>
          )}
        </div>
        
        {/* Zoom Controls - Always visible */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1.5 flex items-center justify-center"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            title="Zoom out (Ctrl/Cmd + -)"
          >
            <ZoomOut className="h-4 w-4 flex-shrink-0 stroke-current" />
            <span className="text-sm font-semibold">-</span>
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[55px] text-center px-1">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1.5 flex items-center justify-center"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            title="Zoom in (Ctrl/Cmd + +)"
          >
            <ZoomIn className="h-4 w-4 flex-shrink-0 stroke-current" />
            <span className="text-sm font-semibold">+</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 flex items-center justify-center"
            onClick={resetZoom}
            disabled={scale === 1.0}
            title="Reset zoom (Ctrl/Cmd + 0)"
          >
            <RotateCcw className="h-4 w-4 stroke-current" />
          </Button>
        </div>
      </div>

      {/* Scrollable PDF Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center p-4"
        style={{ minHeight: 0 }}
      >
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
          <Page 
            pageNumber={pageNumber} 
            renderTextLayer={false}
            scale={scale}
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  );
}
