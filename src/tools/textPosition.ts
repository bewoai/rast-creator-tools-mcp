/**
 * Checks whether a text box on a vertical video frame stays clear of the app UI.
 * Uses the same zones as getSafeZone (safe-zones.json); the box is scaled to the
 * 1080x1920 reference frame before testing.
 */
import { zoneFor, STICKER, REF_W, REF_H, CHECKED, type PlatformId } from "./safeZone";
import { SOURCES } from "./common";

export type TextBoxInput = {
  platform: PlatformId;
  x: number;
  y: number;
  width: number;
  height: number;
  canvas_width?: number;
  canvas_height?: number;
  include_comment_sticker?: boolean;
};

type Rect = { x1: number; y1: number; x2: number; y2: number };
const overlap = (a: Rect, b: Rect) => {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? { w, h } : null;
};

export function checkTextPosition(input: TextBoxInput) {
  const { platform, x, y, width, height, canvas_width = REF_W, canvas_height = REF_H, include_comment_sticker = false } = input;
  if (!(canvas_width > 0) || !(canvas_height > 0)) throw new Error("canvas_width and canvas_height must be positive");
  if (!(width > 0) || !(height > 0)) throw new Error("width and height of the text box must be positive");
  const sx = REF_W / canvas_width;
  const sy = REF_H / canvas_height;
  // text box in reference (1080x1920) coordinates
  const box: Rect = { x1: x * sx, y1: y * sy, x2: (x + width) * sx, y2: (y + height) * sy };
  const z = zoneFor(platform);
  const toCanvasX = (v: number) => Math.round(v / sx);
  const toCanvasY = (v: number) => Math.round(v / sy);

  const zones: { id: string; element: string; rect: Rect }[] = [
    { id: "top", element: z.covers.top, rect: { x1: 0, y1: 0, x2: REF_W, y2: z.top } },
    { id: "bottom", element: z.covers.bottom, rect: { x1: 0, y1: REF_H - z.bottom, x2: REF_W, y2: REF_H } },
    { id: "left", element: "left edge margin", rect: { x1: 0, y1: 0, x2: z.left, y2: REF_H } },
  ];
  if (z.rail) {
    const ry1 = Math.max(z.rail.y1, z.top);
    const ry2 = Math.min(z.rail.y2, REF_H - z.bottom);
    zones.push({ id: "right_buttons", element: z.covers.right, rect: { x1: z.rail.x, y1: ry1, x2: REF_W, y2: ry2 } });
    zones.push({ id: "right", element: "right edge margin", rect: { x1: REF_W - z.right, y1: 0, x2: REF_W, y2: REF_H } });
  } else {
    zones.push({ id: "right", element: z.covers.right, rect: { x1: REF_W - z.right, y1: 0, x2: REF_W, y2: REF_H } });
  }
  if (include_comment_sticker && (platform === "reels" || platform === "all")) {
    zones.push({ id: "comment_sticker", element: "Reels comment-reply sticker (approximate, movable)", rect: { x1: STICKER.x1, y1: STICKER.y1, x2: STICKER.x2, y2: STICKER.y2 } });
  }

  const collisions: { zone: string; ui_element: string; overlap_px: { width: number; height: number } }[] = [];
  const seen = new Set<string>();
  for (const zn of zones) {
    // "right" edge margin is only reported when the button column was not already hit at the same spot
    if (zn.id === "right" && seen.has("right_buttons")) continue;
    const o = overlap(box, zn.rect);
    if (o) {
      seen.add(zn.id);
      collisions.push({ zone: zn.id, ui_element: zn.element, overlap_px: { width: toCanvasX(o.w), height: toCanvasY(o.h) } });
    }
  }

  const outside = box.x1 < 0 || box.y1 < 0 || box.x2 > REF_W || box.y2 > REF_H;
  const safe: Rect = { x1: z.left, y1: z.top, x2: REF_W - z.right, y2: REF_H - z.bottom };
  const fits = box.x2 - box.x1 <= safe.x2 - safe.x1 && box.y2 - box.y1 <= safe.y2 - safe.y1;
  let suggestion: { x: number; y: number; move_right_px: number; move_down_px: number } | null = null;
  if (collisions.length && fits) {
    const nx = Math.min(Math.max(box.x1, safe.x1), safe.x2 - (box.x2 - box.x1));
    const ny = Math.min(Math.max(box.y1, safe.y1), safe.y2 - (box.y2 - box.y1));
    suggestion = { x: toCanvasX(nx), y: toCanvasY(ny), move_right_px: toCanvasX(nx) - x, move_down_px: toCanvasY(ny) - y };
  }
  const inside = collisions.length === 0 && !outside;

  let summary: string;
  if (inside) summary = `The text box is inside the ${z.label} safe zone.`;
  else if (outside && !collisions.length) summary = "The text box extends beyond the canvas.";
  else {
    summary = `The text box overlaps: ${collisions.map((c) => c.ui_element).join("; ")}.`;
    if (suggestion) summary += ` Move it to x=${suggestion.x}, y=${suggestion.y} to clear the UI.`;
    else if (!fits) summary += " It is larger than the safe area: make it smaller or split the text.";
  }

  return {
    platform: z.id,
    label: z.label,
    inside_safe_zone: inside,
    extends_beyond_canvas: outside,
    collisions,
    safe_area_px: {
      x: toCanvasX(safe.x1),
      y: toCanvasY(safe.y1),
      width: toCanvasX(safe.x2) - toCanvasX(safe.x1),
      height: toCanvasY(safe.y2) - toCanvasY(safe.y1),
    },
    suggested_position: suggestion,
    summary,
    values_checked: CHECKED,
    approximate: true,
    source: SOURCES.safeZone,
  };
}
