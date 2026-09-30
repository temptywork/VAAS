/** Shared source/CV/display geometry. CV frames contain only image pixels, never letterbox bars. */
export function processingSize(width: number, height: number, longEdge = 960): [number, number] {
  if (!(width > 0 && height > 0)) return [640, 360];
  const scale = Math.min(1, Math.max(320, Math.min(1280, longEdge)) / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

export function containRect(sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const scale = Math.min(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
  const w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function displayToNormalized(x: number, y: number, rect: ReturnType<typeof containRect>): [number, number] | null {
  const u = (x - rect.x) / rect.width, v = (y - rect.y) / rect.height;
  return Number.isFinite(u + v) && u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
}

export function normalizedToDisplay(x: number, y: number, rect: ReturnType<typeof containRect>): [number, number] {
  return [rect.x + x * rect.width, rect.y + y * rect.height];
}
