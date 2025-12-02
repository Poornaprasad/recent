/**
 * Bounding box utility functions
 * Utilities for working with bounding boxes and coordinates
 */

export type BoundingBox = { x: number; y: number }[];

export interface NormalizedBBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Normalizes bounding box coordinates to 0-1 range
 * Handles both pixel coordinates and already-normalized coordinates
 */
export function normalizeBoundingBox(
  bbox: BoundingBox,
  imageDimensions?: ImageDimensions
): NormalizedBBox | null {
  if (!bbox || bbox.length < 4) {
    return null;
  }

  // Filter out invalid points
  const validPoints = bbox.filter(
    p => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
  );

  if (validPoints.length < 4) {
    return null;
  }

  const xs = validPoints.map(p => p.x);
  const ys = validPoints.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Normalize coordinates if they're not already in 0-1 range
  let normalizedMinX = minX;
  let normalizedMaxX = maxX;
  let normalizedMinY = minY;
  let normalizedMaxY = maxY;

  // If coordinates are > 1, they might be in pixel format
  // Only normalize if we have image dimensions and coordinates are clearly pixels
  if ((maxX > 1 || maxY > 1) && imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0) {
    // Coordinates appear to be in pixel format, normalize them
    normalizedMinX = minX / imageDimensions.width;
    normalizedMaxX = maxX / imageDimensions.width;
    normalizedMinY = minY / imageDimensions.height;
    normalizedMaxY = maxY / imageDimensions.height;
  }

  // Clamp to 0-1 range to ensure valid percentage values
  normalizedMinX = Math.max(0, Math.min(1, normalizedMinX));
  normalizedMaxX = Math.max(0, Math.min(1, normalizedMaxX));
  normalizedMinY = Math.max(0, Math.min(1, normalizedMinY));
  normalizedMaxY = Math.max(0, Math.min(1, normalizedMaxY));

  return {
    minX: normalizedMinX,
    maxX: normalizedMaxX,
    minY: normalizedMinY,
    maxY: normalizedMaxY,
  };
}

