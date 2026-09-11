/**
 * Precision 3D White Electric Sedan Car Icon
 * Matches the user's reference image:
 * - 3D isometric 3/4 front view
 * - Glossy aerodynamic white body
 * - Tinted dark charcoal/black glass
 * - Solid white aero-hubcaps with dark rubber tires
 * - Front signature continuous LED lightbar
 * - Realistic ambient ground contact drop-shadow
 */

/**
 * Precision 3D White Electric Sedan Car Icon
 * Matches the user's reference image:
 * - 3D isometric 3/4 front view
 * - Glossy aerodynamic white body
 * - Tinted dark charcoal/black glass
 * - Solid white aero-hubcaps with dark rubber tires
 * - Front signature continuous LED lightbar
 * - Realistic ambient ground contact drop-shadow
 * - Pure 3D White Car ONLY (no top small icon or floating badge)
 */

export interface CarIconOptions {
  isOnline?: boolean;
  statusColor?: string; // Kept for interface compatibility
  category?: string;    // 'Sedan' | 'SUV' | 'Hatchback' etc.
  showStatusBadge?: boolean; // Kept for compatibility, always renders pure car only
  size?: number;        // default 56
}

export function get3DWhiteCarSvg(_options: CarIconOptions = {}): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>

  <ellipse cx="50" cy="82" rx="22" ry="8" fill="#000" opacity="0.2"/>

  <g filter="url(#shadow)">
    <rect x="28" y="15" width="44" height="70" rx="18"
          fill="#ffffff" stroke="#d1d5db" stroke-width="2"/>

    <rect x="34" y="24" width="32" height="18" rx="6"
          fill="#111827"/>

    <rect x="34" y="48" width="32" height="22" rx="4"
          fill="#1f2937"/>

    <rect x="40" y="10" width="20" height="6" rx="3"
          fill="#f1b84c"/>

    <circle cx="34" cy="28" r="4" fill="#111827"/>
    <circle cx="66" cy="28" r="4" fill="#111827"/>
    <circle cx="34" cy="72" r="4" fill="#111827"/>
    <circle cx="66" cy="72" r="4" fill="#111827"/>
  </g>
</svg>
  `.trim();
}

/**
 * Returns a Data URL for Google Maps Marker or Image tag
 */
export function getCarIconDataUrl(options: CarIconOptions = {}): string {
  const svg = get3DWhiteCarSvg(options);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Direct path to static white car SVG asset
 */
export const WHITE_CAR_ICON_URL = '/icons/white-3d-car.svg';
