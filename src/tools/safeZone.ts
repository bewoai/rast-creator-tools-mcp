/**
 * Safe zones for vertical short-form video. Values come from src/data/safe-zones.json,
 * a copy of the file that drives https://rastcreative.com/en/tools/reels-safe-zone-checker/
 * (approximate UI zones on a 1080x1920 frame, rounded to 10 px).
 */
import DATA from "../data/safe-zones.json";
import { SOURCES, round } from "./common";

export const PLATFORM_IDS = ["reels", "tiktok", "shorts", "story", "all"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export type Rail = { x: number; y1: number; y2: number } | null;
export type Zone = {
  id: PlatformId;
  label: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  rail: Rail;
  covers: { top: string; bottom: string; right: string };
};

export const REF_W = DATA.width;
export const REF_H = DATA.height;
export const CHECKED = DATA.checked;

const JSON_ID: Record<Exclude<PlatformId, "all">, string> = {
  reels: "instagram-reels",
  tiktok: "tiktok",
  shorts: "youtube-shorts",
  story: "instagram-story",
};

/** English descriptions of what the app UI shows in each margin (the JSON notes are Turkish). */
const COVERS: Record<PlatformId, Zone["covers"]> = {
  reels: {
    top: "tabs and camera bar",
    bottom: "username, caption and audio line",
    right: "like, comment, share and save buttons",
  },
  tiktok: {
    top: "Following / For You tabs",
    bottom: "username, caption and sound line",
    right: "profile, like, comment, save, share buttons and sound disc",
  },
  shorts: {
    top: "search and menu",
    bottom: "channel name, subscribe button, title and sound",
    right: "like, dislike, comment, share and remix buttons",
  },
  story: {
    top: "progress bar and profile row",
    bottom: "send message field and reactions",
    right: "edge margin (no button column on Stories)",
  },
  all: {
    top: "top UI of the strictest platform",
    bottom: "bottom UI of the strictest platform",
    right: "button column of the strictest platform",
  },
};

function base(id: Exclude<PlatformId, "all">): Zone {
  const p = DATA.platforms.find((x) => x.id === JSON_ID[id])!;
  return { id, label: p.label, top: p.top, bottom: p.bottom, left: p.left, right: p.right, rail: p.rail as Rail, covers: COVERS[id] };
}

/** The combined zone = the strictest margin of every platform (same as the site's "All platforms"). */
function combined(): Zone {
  const ps = (["reels", "tiktok", "shorts", "story"] as const).map(base);
  const rails = ps.map((p) => p.rail).filter(Boolean) as { x: number; y1: number; y2: number }[];
  return {
    id: "all",
    label: "All platforms (shared safe zone)",
    top: Math.max(...ps.map((p) => p.top)),
    bottom: Math.max(...ps.map((p) => p.bottom)),
    left: Math.max(...ps.map((p) => p.left)),
    right: Math.max(...ps.map((p) => p.right)),
    rail: { x: Math.min(...rails.map((r) => r.x)), y1: Math.min(...rails.map((r) => r.y1)), y2: Math.max(...rails.map((r) => r.y2)) },
    covers: COVERS.all,
  };
}

export function zoneFor(id: PlatformId): Zone {
  return id === "all" ? combined() : base(id);
}

export const STICKER = DATA.sticker; // Reels comment-reply sticker, approximate (x1, x2, y1, y2)
export const META_ADS = DATA.metaAds; // Meta's official Reels/Story ad margins on 1080x1920

export type SafeZoneInput = { platform: PlatformId; width?: number; height?: number };

export function getSafeZone({ platform, width = REF_W, height = REF_H }: SafeZoneInput) {
  if (!(width > 0) || !(height > 0)) throw new Error("width and height must be positive numbers");
  const z = zoneFor(platform);
  const sx = width / REF_W;
  const sy = height / REF_H;
  const px = {
    top: Math.round(z.top * sy),
    bottom: Math.round(z.bottom * sy),
    left: Math.round(z.left * sx),
    right: Math.round(z.right * sx),
  };
  const notes: string[] = [];
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) > 0.01) {
    notes.push(
      `The zones are measured on full-screen 9:16 video. Your ${width}x${height} frame is not 9:16, so values were scaled linearly and are only approximate; export vertical video at 1080x1920 for reliable results.`,
    );
  }
  if (z.rail) {
    notes.push(
      `The right margin matters most where the button column sits: roughly y ${Math.round(z.rail.y1 * sy)}-${Math.round(z.rail.y2 * sy)} px. Above and below it, the right edge needs only a normal margin.`,
    );
  }
  if (platform === "reels" || platform === "all") {
    notes.push(
      `A Reels comment-reply sticker, if used, stays on screen the whole video and covers roughly y ${Math.round(STICKER.y1 * sy)}-${Math.round(STICKER.y2 * sy)} px (movable).`,
    );
  }
  if (platform === "reels" || platform === "story") {
    notes.push(
      `For paid Reels/Story ads Meta officially recommends wider margins: top ${round((META_ADS.top / REF_H) * 100)}%, bottom ${round((META_ADS.bottom / REF_H) * 100)}%, sides ${round((META_ADS.left / REF_W) * 100)}% each.`,
    );
  }
  return {
    platform: z.id,
    label: z.label,
    canvas: { width, height },
    unsafe_margins_px: px,
    unsafe_margins_percent: {
      top: round((z.top / REF_H) * 100),
      bottom: round((z.bottom / REF_H) * 100),
      left: round((z.left / REF_W) * 100),
      right: round((z.right / REF_W) * 100),
    },
    safe_area_px: { x: px.left, y: px.top, width: width - px.left - px.right, height: height - px.top - px.bottom },
    right_button_column_px: z.rail
      ? { x_from: Math.round(z.rail.x * sx), y_from: Math.round(z.rail.y1 * sy), y_to: Math.round(z.rail.y2 * sy) }
      : null,
    covered_by: z.covers,
    guidance: [
      "Keep titles, captions, logos and faces inside safe_area_px; backgrounds can run edge to edge.",
      ...notes,
    ],
    values_checked: CHECKED,
    approximate: true,
    source: SOURCES.safeZone,
  };
}
