/**
 * Video bitrate and file-size calculator. Same formulas as
 * https://rastcreative.com/en/tools/video-bitrate-calculator/ :
 *   size (bytes)        = (video kbps + audio kbps) * 1000 * seconds / 8
 *   max video bitrate   = target bytes * 0.98 * 8 / seconds / 1000 - audio kbps   (2 % safety margin)
 * Reference bitrates come from src/data/export-specs.ts (official platform pages).
 */
import { YOUTUBE, VIMEO, PRORES, PRORES_CODECS, PRORES_LABEL, LIMITS, CHECKED, type ProresCodec } from "../data/export-specs";
import { SOURCES, round } from "./common";

export const RESOLUTIONS = {
  "720p": "1280x720",
  "1080p": "1920x1080",
  "1440p": "2560x1440",
  "2160p": "3840x2160",
  dci4k: "4096x2160",
} as const;
export type Resolution = keyof typeof RESOLUTIONS;

export const BITRATE_PLATFORMS = [
  "youtube",
  "youtube_hdr",
  "vimeo",
  "instagram",
  "tiktok",
  "prores_proxy",
  "prores_lt",
  "prores_422",
  "prores_hq",
  "prores_4444",
  "prores_xq",
] as const;
export type BitratePlatform = (typeof BITRATE_PLATFORMS)[number];

/** Rast's delivery targets for platforms that publish no bitrate (export guide "quick settings"). */
const RAST_TARGET: Record<string, { std: number; high: number }> = {
  "1080": { std: 16, high: 24 },
  "2160": { std: 45, high: 68 },
};

const heightKey = (res: Resolution) => (res === "2160p" || res === "dci4k" ? "2160" : RESOLUTIONS[res].split("x")[1]);
/** ProRes tables use 24/25/30/50/60; NTSC rates map to their nominal row. */
const proresFps = (fps: number) => {
  const map: [number, string][] = [[24, "24"], [25, "25"], [30, "30"], [50, "50"], [60, "60"]];
  const hit = map.find(([f]) => Math.abs(f - fps) < 0.1);
  return hit?.[1] ?? null;
};

export type Reference = { mbps: number | null; text: string; official: boolean };

export function referenceBitrate(platform: BitratePlatform, resolution: Resolution, fps: number): Reference {
  const high = fps >= 48;
  const key = heightKey(resolution);
  const band = high ? "high" : "std";
  const fpsLabel = high ? "48/50/60" : "24/25/30";
  const fmt = (r: readonly number[]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`);
  if (platform === "youtube" || platform === "youtube_hdr") {
    const t = platform === "youtube_hdr" ? YOUTUBE.hdr : YOUTUBE.sdr;
    const r = (t as Record<string, { std: readonly number[]; high: readonly number[] }>)[key]?.[band];
    if (r) return { mbps: r[1], text: `YouTube ${platform === "youtube_hdr" ? "HDR" : "SDR"} recommendation: ${fmt(r)} Mbps (${fpsLabel} fps).`, official: true };
  } else if (platform === "vimeo") {
    const r = (VIMEO as unknown as Record<string, readonly number[]>)[key];
    if (r) return { mbps: r[1], text: `Vimeo recommendation: ${r[0]}-${r[1]} Mbps (any frame rate); the upper value is used.`, official: true };
  } else if (platform.startsWith("prores_")) {
    const codec = platform.slice(7) as ProresCodec;
    const f = proresFps(fps);
    const row = f ? PRORES[RESOLUTIONS[resolution]]?.[f] : undefined;
    if (row) {
      const v = row[PRORES_CODECS.indexOf(codec)];
      return { mbps: v, text: `Apple's target data rate for ${PRORES_LABEL[codec]}: about ${v} Mbps. ProRes exports as .mov; size barely changes with content.`, official: true };
    }
    return { mbps: null, text: "Apple lists ProRes data rates only for 720p, 1080p, UHD and DCI 4K at 24/25/30/50/60 fps.", official: true };
  } else {
    const name = platform === "instagram" ? "Instagram" : "TikTok";
    const rast = RAST_TARGET[key];
    if (rast) return { mbps: rast[band], text: `${name} publishes no bitrate for organic posts; Rast's delivery target is ${rast[band]} Mbps (${fpsLabel} fps), leaving headroom for the platform's re-compression.`, official: false };
    const r = (YOUTUBE.sdr as Record<string, { std: readonly number[]; high: readonly number[] }>)[key]?.[band];
    if (r) return { mbps: r[1], text: `${name} publishes no bitrate for organic posts; the YouTube SDR value (${fmt(r)} Mbps) is used as a reference.`, official: false };
  }
  return { mbps: null, text: "The sources give no value for this combination.", official: false };
}

export type BitrateInput = {
  duration_seconds: number;
  resolution?: Resolution;
  fps?: number;
  platform?: BitratePlatform;
  video_bitrate_mbps?: number;
  audio_kbps?: number;
  target_size_mb?: number;
};

export function calculateBitrate(input: BitrateInput) {
  const { duration_seconds: secs, resolution = "1080p", fps = 30, platform = "youtube", audio_kbps: abrK = 320, target_size_mb } = input;
  if (!(secs > 0)) throw new Error("duration_seconds must be greater than 0");
  if (!(fps > 0)) throw new Error("fps must be greater than 0");
  if (abrK < 0) throw new Error("audio_kbps cannot be negative");
  const ref = referenceBitrate(platform, resolution, fps);
  const warnings: string[] = [];
  const notes: string[] = [];
  let videoKbps: number;
  let result: Record<string, unknown>;

  if (target_size_mb !== undefined) {
    if (!(target_size_mb > 0)) throw new Error("target_size_mb must be greater than 0");
    const totalK = (target_size_mb * 1e6 * 0.98 * 8) / secs / 1000;
    videoKbps = Math.floor(totalK - abrK);
    if (videoKbps <= 0) {
      warnings.push("For this duration the target size doesn't even fit the audio. Shorten the video, lower the audio bitrate or raise the target size.");
      result = { mode: "max_bitrate_for_target_size", max_video_bitrate_mbps: 0, max_video_bitrate_kbps: 0 };
    } else {
      result = {
        mode: "max_bitrate_for_target_size",
        target_size_mb,
        max_video_bitrate_mbps: round(videoKbps / 1000, 2),
        max_video_bitrate_kbps: videoKbps,
        total_bitrate_mbps: round(totalK / 1000, 2),
      };
      notes.push(`Total ${round(totalK / 1000, 2)} Mbps, minus ${abrK} kbps audio and a 2% safety margin.`);
      notes.push("In your editor choose 'VBR, 2 pass' and enter this as the target bitrate; keep the maximum bitrate at no more than 1.5x the target.");
      const yt = (YOUTUBE.sdr as Record<string, { std: readonly number[]; high: readonly number[] }>)[heightKey(resolution)]?.[fps >= 48 ? "high" : "std"];
      if (yt) {
        const ratio = videoKbps / 1000 / yt[0];
        notes.push(`YouTube recommends ${yt[0]} Mbps for this resolution and frame rate; this is about ${round(ratio, ratio < 1 ? 2 : 1)}x that.`);
        if (ratio > 3) notes.push("Plenty of room for this duration: a little above the recommended bitrate is enough.");
        if (ratio < 0.6) warnings.push("This bitrate is low for the selected resolution; expect blocking and banding. Consider a lower resolution (e.g. 1080p to 720p) or a shorter video.");
      }
      if (videoKbps < LIMITS.tiktokAdMinKbps) warnings.push(`TikTok ads need at least ${LIMITS.tiktokAdMinKbps} kbps; this is below that.`);
    }
  } else {
    const vMbps = input.video_bitrate_mbps ?? ref.mbps;
    if (vMbps == null || !(vMbps > 0)) throw new Error("No reference bitrate for this combination; pass video_bitrate_mbps.");
    videoKbps = vMbps * 1000;
    const bytes = ((videoKbps + abrK) * 1000 * secs) / 8;
    const mb = bytes / 1e6;
    result = {
      mode: "file_size",
      video_bitrate_mbps: vMbps,
      video_bitrate_from: input.video_bitrate_mbps != null ? "input" : "reference",
      estimated_size_mb: round(mb, 1),
      estimated_size_gb: round(mb / 1000, 2),
      size_in_windows_explorer: bytes / 1024 ** 3 >= 1 ? `${round(bytes / 1024 ** 3, 2)} GB` : `${round(bytes / 1024 ** 2, 1)} MB`,
      mb_per_minute: round(((videoKbps + abrK) * 60) / 8000, 1),
      total_bitrate_mbps: round((videoKbps + abrK) / 1000, 2),
    };
    if (bytes > LIMITS.metaMaxGB * 1e9) warnings.push(`This file is over Meta's ${LIMITS.metaMaxGB} GB ad video limit.`);
    else if (bytes > LIMITS.tiktokAdMaxMB * 1e6) notes.push(`Too big for TikTok ads (${LIMITS.tiktokAdMaxMB} MB limit); under Meta's ${LIMITS.metaMaxGB} GB limit.`);
  }

  if (platform === "instagram" && fps < LIMITS.instagramMinFps) warnings.push(`Instagram asks for at least ${LIMITS.instagramMinFps} FPS for Reels.`);
  if (abrK > 0 && abrK < LIMITS.metaAudioMinKbps && (platform === "instagram")) warnings.push(`Meta recommends stereo AAC at ${LIMITS.metaAudioMinKbps} kbps or more.`);

  let ffmpeg: string | null = null;
  if (videoKbps > 0 && !platform.startsWith("prores_")) {
    const g = Math.max(1, Math.round(fps / 2));
    const common = `-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v ${Math.round(videoKbps)}k -g ${g} -bf 2`;
    const audio = abrK ? `-c:a aac -b:a ${Math.min(abrK, 512)}k -ar 48000` : "-an";
    ffmpeg = `ffmpeg -y -i input.mov ${common} -pass 1 -an -f null /dev/null && ffmpeg -i input.mov ${common} -pass 2 ${audio} -movflags +faststart output.mp4`;
  }

  return {
    ...result,
    input: { duration_seconds: secs, resolution: `${resolution} (${RESOLUTIONS[resolution]})`, fps, platform, audio_kbps: abrK },
    reference: { video_bitrate_mbps: ref.mbps, note: ref.text, from_official_platform_docs: ref.official },
    notes,
    warnings,
    ffmpeg_two_pass: ffmpeg,
    units: "1 MB = 1,000,000 bytes; 1 Mbps = 1,000,000 bit/s",
    values_checked: CHECKED,
    source: SOURCES.bitrate,
  };
}
