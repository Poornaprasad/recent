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
  const scaledContainerRef = useRef<HTMLDivElement | null>(null);
  // Store base (unscaled) image dimensions for consistent calculations
  const [baseImageDimensions, setBaseImageDimensions] = useState<{ width: number; height: number; naturalWidth: number; naturalHeight: number } | null>(null);
  // Store the position of the scaled container relative to the scroll container
  const [scaledContainerPosition, setScaledContainerPosition] = useState<{ left: number; top: number } | null>(null);
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

  // Update base image dimensions and container position
  useEffect(() => {
    const updateDimensions = () => {
      if (imageRef.current && scrollContainerRef.current && scaledContainerRef.current) {
        const img = imageRef.current;
        const scrollContainer = scrollContainerRef.current;
        const scaledContainer = scaledContainerRef.current;
        
        // Get the natural (intrinsic) dimensions of the image
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;
        
        if (naturalWidth > 0 && naturalHeight > 0) {
          // Calculate the base rendered size (at scale 1.0)
          // The image should fit within the container width while maintaining aspect ratio
          const scrollContainerWidth = scrollContainer.clientWidth - 32; // Subtract padding (16px * 2)
          const aspectRatio = naturalWidth / naturalHeight;
          const baseWidth = Math.min(scrollContainerWidth, naturalWidth);
          const baseHeight = baseWidth / aspectRatio;
          
          setBaseImageDimensions({
            width: baseWidth,
            height: baseHeight,
            naturalWidth,
            naturalHeight,
          });
        }
        
        // Get the position of the scaled container relative to the scroll container
        const scaledContainerRect = scaledContainer.getBoundingClientRect();
        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        
        setScaledContainerPosition({
          left: scaledContainerRect.left - scrollContainerRect.left,
          top: scaledContainerRect.top - scrollContainerRect.top,
        });
        
        // Also update the callback with current rendered dimensions
        if (onImageLoad && containerRef.current && imageRef.current) {
          const imgRect = imageRef.current.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          onImageLoad({
            width: imgRect.width,
            height: imgRect.height,
            left: imgRect.left - containerRect.left,
            top: imgRect.top - containerRect.top,
          });
        }
      }
    };

    // Update when scale changes or image loads
    const timeout = setTimeout(updateDimensions, 50);
    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [scale, invoiceDataUri, onImageLoad]);

  // Convert relative file paths to absolute URLs for PDF viewer
  const getAbsoluteUri = (uri: string): string => {
    if (uri.startsWith('/uploads/')) {
      // Convert /uploads/... to /api/uploads/... to use the API route handler
      const apiPath = uri.replace('/uploads/', '/api/uploads/');
      if (typeof window !== 'undefined') {
        return `${window.location.origin}${apiPath}`;
      }
      // Server-side: return as-is, will be handled by route handler
      return apiPath;
    }
    return uri;
  };

  const absoluteUri = invoiceDataUri ? getAbsoluteUri(invoiceDataUri) : '';
  const isPdf = absoluteUri && (absoluteUri.startsWith('data:application/pdf') || absoluteUri.endsWith('.pdf'));

  const renderHighlightBox = () => {
    if (!highlightBox || highlightBox.length < 4) return null;

    // Use natural dimensions for normalization - bounding boxes are typically relative to original image size
    const dimensionsForNormalization = baseImageDimensions 
      ? { width: baseImageDimensions.naturalWidth, height: baseImageDimensions.naturalHeight }
      : undefined;

    const normalized = normalizeBoundingBox(
      highlightBox,
      dimensionsForNormalization
    );

    if (!normalized) {
      console.warn('Invalid bounding box points:', highlightBox);
      return null;
    }

    const { minX: normalizedMinX, maxX: normalizedMaxX, minY: normalizedMinY, maxY: normalizedMaxY } = normalized;

    // For PDFs, always use percentage-based positioning
    if (isPdf) {
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

    // For images, calculate position using base rendered dimensions (at scale 1.0)
    // The normalized coordinates (0-1) from normalizeBoundingBox represent percentage of image
    // We multiply by base rendered dimensions to get position on the rendered image
    // The scale transform will automatically apply to the bounding box since it's inside the scaled container
    if (baseImageDimensions && scaledContainerPosition && baseImageDimensions.width > 0 && baseImageDimensions.height > 0) {
      // Normalized coordinates are 0-1, multiply by base rendered size
      const baseBoxLeft = normalizedMinX * baseImageDimensions.width;
      const baseBoxTop = normalizedMinY * baseImageDimensions.height;
      const baseBoxWidth = (normalizedMaxX - normalizedMinX) * baseImageDimensions.width;
      const baseBoxHeight = (normalizedMaxY - normalizedMinY) * baseImageDimensions.height;

      return (
        <div
          className="absolute border-2 border-green-500 bg-green-500/20 pointer-events-none"
          style={{
            left: `${baseBoxLeft}px`,
            top: `${baseBoxTop}px`,
            width: `${baseBoxWidth}px`,
            height: `${baseBoxHeight}px`,
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

    // Fallback to percentage-based positioning if dimensions not available
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

          {/* Scrollable Image Container - Zoom is isolated to this container only */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center p-4"
            style={{ 
              minHeight: 0,
              isolation: 'isolate', // Isolate stacking context to prevent zoom affecting parent
            }}
          >
            {/* Scaled container - zoom is applied here, not to the whole page */}
            <div 
              ref={scaledContainerRef}
              className="relative inline-block"
              style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'top center',
                willChange: 'transform', // Optimize transform performance
                maxWidth: '100%',
              }}
            >
              <Image
                src={absoluteUri}
                alt={`Invoice ${invoiceId}`}
                data-ai-hint="invoice document"
                width={baseImageDimensions?.naturalWidth || 1200}
                height={baseImageDimensions?.naturalHeight || 1600}
                sizes="(max-width: 100%) 100vw"
                className="object-contain"
                style={{ 
                  display: 'block',
                  width: baseImageDimensions ? `${baseImageDimensions.width}px` : 'auto',
                  height: 'auto',
                  maxWidth: '100%',
                }}
                onLoad={(e) => {
                  // Next.js Image component - get the actual img element
                  const imgElement = e.currentTarget;
                  // Find the actual img tag (Next.js wraps it)
                  const actualImg = imgElement.querySelector('img') as HTMLImageElement || imgElement as HTMLImageElement;
                  imageRef.current = actualImg;
                  
                  // Use a small delay to ensure layout is complete
                  setTimeout(() => {
                    if (scrollContainerRef.current && scaledContainerRef.current && actualImg) {
                      // Get natural dimensions from the actual img element
                      const naturalWidth = actualImg.naturalWidth || actualImg.width;
                      const naturalHeight = actualImg.naturalHeight || actualImg.height;
                      
                      // Get the base rendered size (before scale transform)
                      // At scale 1.0, the image will fit within the container width
                      const scrollContainerWidth = scrollContainerRef.current.clientWidth - 32; // Subtract padding
                      const aspectRatio = naturalWidth / naturalHeight;
                      const baseWidth = Math.min(scrollContainerWidth, naturalWidth);
                      const baseHeight = baseWidth / aspectRatio;
                      
                      setBaseImageDimensions({
                        width: baseWidth,
                        height: baseHeight,
                        naturalWidth,
                        naturalHeight,
                      });
                      
                      // Get position of scaled container
                      const scaledContainerRect = scaledContainerRef.current.getBoundingClientRect();
                      const scrollContainerRect = scrollContainerRef.current.getBoundingClientRect();
                      
                      setScaledContainerPosition({
                        left: scaledContainerRect.left - scrollContainerRect.left,
                        top: scaledContainerRect.top - scrollContainerRect.top,
                      });
                      
                      // Update callback with current rendered dimensions
                      if (onImageLoad && containerRef.current) {
                        const imgRect = actualImg.getBoundingClientRect();
                        const containerRect = containerRef.current.getBoundingClientRect();
                        onImageLoad({
                          width: imgRect.width,
                          height: imgRect.height,
                          left: imgRect.left - containerRect.left,
                          top: imgRect.top - containerRect.top,
                        });
                      }
                    }
                  }, 100);
                }}
                onError={(e) => {
                  console.error(`Failed to load invoice image for ${invoiceId}:`, absoluteUri);
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
