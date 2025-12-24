'use client';

import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { normalizeBoundingBox, type BoundingBox } from '@/lib/utils/bbox-utils';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PDFViewer = dynamic(() => import('@/components/invoice/pdf-viewer').then(mod => mod.PDFViewer), {
  ssr: false,
  loading: () => <p>Loading PDF...</p>
});

const toTitleCase = (str: string) => {
  if (!str) return '';
  str = str.replace(/([A-Z])/g, ' $1');
  str = str.replace(/(\d+)/g, ' $1');
  return str.replace(/^./, (s) => s.toUpperCase());
};

interface InvoiceViewerProps {
  invoiceDataUri: string;
  invoiceId: string;
  highlightBox: BoundingBox | null;
  hoveredField: string | null;
  hoveredConfidence: number | null;
  onImageLoad?: (dimensions: { width: number; height: number; left: number; top: number }) => void;
}

export function InvoiceViewer({
  invoiceDataUri,
  invoiceId,
  highlightBox,
  hoveredField,
  hoveredConfidence,
  onImageLoad,
}: InvoiceViewerProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number; left: number; top: number } | null>(null);
  const [scale, setScale] = useState(1.0);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3.0;
  const SCALE_STEP = 0.25;

  function zoomIn() {
    setScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }

  function zoomOut() {
    setScale(prev => Math.max(prev - SCALE_STEP, MIN_SCALE));
  }

  function resetZoom() {
    setScale(1.0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    }
  }

  // Update image dimensions when window resizes or highlight box changes
  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current && containerRef.current) {
        const img = imageRef.current;
        const container = containerRef.current;
        const rect = img.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const dimensions = {
          width: rect.width,
          height: rect.height,
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
        };
        setImageDimensions(dimensions);
        if (onImageLoad) {
          onImageLoad(dimensions);
        }
      } else if (containerRef.current) {
        // Try to find the image element
        const img = containerRef.current.querySelector('img');
        if (img) {
          imageRef.current = img;
          const rect = img.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          const dimensions = {
            width: rect.width,
            height: rect.height,
            left: rect.left - containerRect.left,
            top: rect.top - containerRect.top,
          };
          setImageDimensions(dimensions);
          if (onImageLoad) {
            onImageLoad(dimensions);
          }
        }
      }
    };

    // Update immediately
    const timeout = setTimeout(updateImageDimensions, 100);

    window.addEventListener('resize', updateImageDimensions);
    // Update periodically to catch image load and layout changes
    const interval = setInterval(updateImageDimensions, 300);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateImageDimensions);
      clearInterval(interval);
    };
  }, [invoiceDataUri, highlightBox, onImageLoad]);

  // Convert relative file paths to absolute URLs for PDF viewer
  const getAbsoluteUri = (uri: string): string => {
    if (uri.startsWith('/uploads/')) {
      // Convert relative path to absolute URL
      if (typeof window !== 'undefined') {
        return `${window.location.origin}${uri}`;
      }
      // Server-side: return as-is, will be handled by route handler
      return uri;
    }
    return uri;
  };

  const absoluteUri = invoiceDataUri ? getAbsoluteUri(invoiceDataUri) : '';
  const isPdf = absoluteUri && (absoluteUri.startsWith('data:application/pdf') || absoluteUri.endsWith('.pdf'));

  const renderHighlightBox = () => {
    if (!highlightBox || highlightBox.length < 4) return null;

    const normalized = normalizeBoundingBox(
      highlightBox,
      imageDimensions ? { width: imageDimensions.width, height: imageDimensions.height } : undefined
    );

    if (!normalized) {
      console.warn('Invalid bounding box points:', highlightBox);
      return null;
    }

    const { minX: normalizedMinX, maxX: normalizedMaxX, minY: normalizedMinY, maxY: normalizedMaxY } = normalized;

    // For PDFs, always use percentage-based positioning
    // For images, use pixel-based if dimensions are available
    if (!isPdf && imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0) {
      // Position relative to the image within the scaled container
      // imageDimensions.left/top gives us the image's position within the scaled container
      // We add the normalized coordinates multiplied by image size to get the bounding box position
      const boxLeft = imageDimensions.left + normalizedMinX * imageDimensions.width;
      const boxTop = imageDimensions.top + normalizedMinY * imageDimensions.height;
      const boxWidth = (normalizedMaxX - normalizedMinX) * imageDimensions.width;
      const boxHeight = (normalizedMaxY - normalizedMinY) * imageDimensions.height;

      return (
        <div
          className="absolute border-2 border-green-500 bg-green-500/20 pointer-events-none"
          style={{
            left: `${boxLeft}px`,
            top: `${boxTop}px`,
            width: `${boxWidth}px`,
            height: `${boxHeight}px`,
            zIndex: 50,
          }}
        >
          <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-2">
            <span>{hoveredField && toTitleCase(hoveredField)}</span>
            {hoveredConfidence !== null && (
              <span className="font-mono bg-green-600 px-1.5 py-0.5 rounded">
                {Math.round(hoveredConfidence * 100)}%
              </span>
            )}
          </div>
        </div>
      );
    } else {
      // Fallback to percentage-based positioning (works for both PDFs and images)
      // Coordinates are already normalized and clamped
      return (
        <div
          className="absolute border-2 border-green-500 bg-green-500/20 pointer-events-none"
          style={{
            left: `${normalizedMinX * 100}%`,
            top: `${normalizedMinY * 100}%`,
            width: `${(normalizedMaxX - normalizedMinX) * 100}%`,
            height: `${(normalizedMaxY - normalizedMinY) * 100}%`,
            zIndex: 50,
          }}
        >
          <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-2">
            <span>{hoveredField && toTitleCase(hoveredField)}</span>
            {hoveredConfidence !== null && (
              <span className="font-mono bg-green-600 px-1.5 py-0.5 rounded">
                {Math.round(hoveredConfidence * 100)}%
              </span>
            )}
          </div>
        </div>
      );
    }
  };

  // Show error message if no document URI is provided
  if (!invoiceDataUri) {
    return (
      <div className="w-1/2 border-r flex flex-col bg-muted/40 relative overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="text-muted-foreground">
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Document Not Available</h3>
              <p className="text-sm text-muted-foreground mt-2">
                The invoice document could not be loaded. The file may have been deleted or is missing.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-1/2 border-r flex flex-col bg-muted/40 relative overflow-hidden" 
      ref={containerRef}
      style={{ 
        maxWidth: '50%',
        minWidth: 0,
        width: '50%',
        flexShrink: 0,
        flexGrow: 0
      }}
    >
      {isPdf ? (
        <div 
          className="relative w-full h-full flex flex-col min-h-0"
          style={{ 
            maxWidth: '100%',
            width: '100%',
            overflow: 'hidden'
          }}
        >
          <PDFViewer file={absoluteUri} />
          {/* Bounding box overlay for PDFs - positioned relative to PDF container */}
          <div className="absolute inset-0 pointer-events-none z-40">
            {renderHighlightBox()}
          </div>
        </div>
      ) : (
        <>
          {/* Zoom Controls Bar for Images */}
          <div className="flex items-center justify-between p-2 bg-background border-b gap-2 flex-shrink-0 z-10">
            <span className="text-sm font-medium text-muted-foreground">Document Viewer</span>
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

          {/* Scrollable Image Container */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center p-4"
            style={{ minHeight: 0 }}
          >
            <div className="relative" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
              <Image
                src={absoluteUri}
                alt={`Invoice ${invoiceId}`}
                data-ai-hint="invoice document"
                width={0}
                height={0}
                sizes="100vw"
                className="w-auto h-auto max-w-none object-contain"
                style={{ 
                  width: scale === 1.0 ? '100%' : 'auto',
                  height: scale === 1.0 ? 'auto' : 'auto',
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  imageRef.current = img;
                  
                  // Use a small delay to ensure layout is complete
                  setTimeout(() => {
                    if (scrollContainerRef.current && img) {
                      // Get the scaled container (parent of image)
                      const scaledContainer = img.parentElement;
                      if (scaledContainer) {
                        const imgRect = img.getBoundingClientRect();
                        const containerRect = scaledContainer.getBoundingClientRect();
                        
                        // Calculate image position relative to the scaled container
                        // This accounts for centering/positioning within the container
                        const dimensions = {
                          width: imgRect.width,
                          height: imgRect.height,
                          left: imgRect.left - containerRect.left,
                          top: imgRect.top - containerRect.top,
                        };
                        setImageDimensions(dimensions);
                        if (onImageLoad && containerRef.current) {
                          const outerRect = containerRef.current.getBoundingClientRect();
                          onImageLoad({
                            width: imgRect.width,
                            height: imgRect.height,
                            left: imgRect.left - outerRect.left,
                            top: imgRect.top - outerRect.top,
                          });
                        }
                      }
                    }
                  }, 50);
                }}
                onError={(e) => {
                  console.error(`Failed to load invoice image for ${invoiceId}:`, absoluteUri);
                  // The error will be visible as a broken image, but we've already handled empty URIs above
                }}
              />
              {/* Bounding box overlay for images - positioned relative to scaled image container */}
              {renderHighlightBox()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
