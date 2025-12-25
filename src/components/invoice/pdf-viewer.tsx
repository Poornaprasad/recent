
'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/utils';

interface PDFViewerProps {
  file: string;
}

export function PDFViewer({ file }: PDFViewerProps) {
  // Set up the worker
  // This is critical for react-pdf to work with Next.js/Turbopack
  // Use local worker file that matches react-pdf's internal pdfjs version (5.4.296)
  useEffect(() => {
    // Use the local worker file from public folder
    // This file is copied from node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs
    // to ensure it matches the exact version (5.4.296) that react-pdf uses internally
    // This avoids version mismatches and CDN loading issues
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }, []);
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3.0;
  const SCALE_STEP = 0.25;

  // Calculate container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (scrollContainerRef.current) {
        // Get the scroll container width minus padding
        const width = scrollContainerRef.current.clientWidth - 32; // Subtract padding (16px * 2)
        setContainerWidth(width > 0 ? width : null);
      }
    };

    // Use a small delay to ensure container is rendered
    const timeoutId = setTimeout(updateWidth, 100);
    updateWidth();
    
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
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
    <div 
      ref={containerRef} 
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ 
        maxWidth: '100%', 
        width: '100%',
        contain: 'layout style',
        isolation: 'isolate'
      }}
    >
      {/* Controls Bar - Always visible */}
      <div className="flex items-center justify-between p-2 bg-background border-b gap-2 flex-shrink-0 z-10">
        {/* Page Info */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {numPages ? `${numPages} ${numPages === 1 ? 'page' : 'pages'}` : 'PDF Viewer'}
          </span>
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

      {/* Scrollable PDF Container - Only the document area scrolls and zooms */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-muted/20"
        style={{ 
          minHeight: 0, 
          width: '100%', 
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          isolation: 'isolate', // Isolate stacking context to prevent zoom affecting parent
        }}
      >
        <div 
          className="flex flex-col items-center p-4 gap-4" 
          style={{ 
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Loading PDF...
              </div>
            }
            error={
              <div className="flex items-center justify-center py-8 text-destructive-foreground">
                Failed to load PDF file.
              </div>
            }
            className="flex flex-col items-center"
          >
            {numPages && Array.from(new Array(numPages), (el, index) => (
              <div 
                key={`page_wrapper_${index + 1}`} 
                className="flex justify-center"
                style={{ 
                  width: '100%',
                  minWidth: 0
                }}
              >
                <Page 
                  pageNumber={index + 1} 
                  renderTextLayer={false}
                  scale={scale}
                  width={containerWidth || undefined}
                  className="shadow-lg mb-4"
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
