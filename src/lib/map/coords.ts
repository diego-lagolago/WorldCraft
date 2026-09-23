/** Leaflet CRS.Simple [y,x] vs stored image fractions {x,y} in 0–1 (CR-012). */

export const POSITION_DECIMALS = 7;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function roundPosition(value: number): number {
  return Number(clamp01(value).toFixed(POSITION_DECIMALS));
}

export function positionSql(value: number): string {
  return roundPosition(value).toFixed(POSITION_DECIMALS);
}

/**
 * Overlay-Bounds [[0,0],[height,width]]: lat=0 unten, lng=0 links.
 * Gespeichertes y=0 ist der Bildoberrand (fachliches Bildkoordinatensystem).
 */
export function relativeToLatLng(
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
): { lat: number; lng: number } {
  return {
    lat: (1 - clamp01(y)) * imageHeight,
    lng: clamp01(x) * imageWidth,
  };
}

export function latLngToRelative(
  lat: number,
  lng: number,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  const x = imageWidth === 0 ? 0 : lng / imageWidth;
  const y = imageHeight === 0 ? 0 : 1 - lat / imageHeight;
  return { x: roundPosition(x), y: roundPosition(y) };
}

export function imageOverlayBounds(
  width: number,
  height: number,
): [[number, number], [number, number]] {
  return [
    [0, 0],
    [height, width],
  ];
}
