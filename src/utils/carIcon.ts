/**
 * 3D Luxury White Cab PNG Map Marker Utility
 * Uses PNG format exclusively (no SVG) for map markers and UI display.
 */

export interface CarIconOptions {
  /** Marker width */
  width?: number;
  /** Marker height */
  height?: number;
  /** Rotation angle in degrees (0 = car front facing up / North) */
  rotation?: number;
}

export const WHITE_CAR_PNG_URL = '/icons/white-3d-car.png';
export const WHITE_CAR_ICON_URL = WHITE_CAR_PNG_URL;

// Global cache of rotated PNG data URLs by heading angle
const rotatedPngCache = new Map<string, string>();
let cachedImage: HTMLImageElement | null = null;

function getCarImage(): HTMLImageElement {
  if (!cachedImage) {
    cachedImage = new Image();
    cachedImage.crossOrigin = 'anonymous';
    cachedImage.src = WHITE_CAR_PNG_URL;
  }
  return cachedImage;
}

if (typeof window !== 'undefined') {
  getCarImage();
}

/**
 * Rotates the white car PNG so the front of the vehicle points in the direction of road travel.
 * Returns a PNG data URL.
 */
export function getLiveCarMarker(options: CarIconOptions = {}): string {
  const heading = options.rotation || 0;
  const width = options.width || 44;
  const height = options.height || 78;
  const normalizedHeading = Math.round((heading % 360 + 360) % 360);

  const cacheKey = `${normalizedHeading}_${width}_${height}`;
  if (rotatedPngCache.has(cacheKey)) {
    return rotatedPngCache.get(cacheKey)!;
  }

  const img = getCarImage();
  if (!img.complete || img.naturalWidth === 0) {
    // If image is not loaded yet, just return the plain URL (Google Maps will load it unrotated initially)
    return WHITE_CAR_PNG_URL;
  }

  const canvas = document.createElement('canvas');
  // Use larger dimension square canvas so rotated corners aren't clipped
  const size = Math.max(width, height) * 1.5;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return WHITE_CAR_PNG_URL;

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate((normalizedHeading * Math.PI) / 180);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  rotatedPngCache.set(cacheKey, dataUrl);
  return dataUrl;
}
