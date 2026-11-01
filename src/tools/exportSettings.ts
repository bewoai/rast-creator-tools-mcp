/**
 * Recommended export settings per platform. Data = the Rast export guide
 * (rastcreative.com/rehber/video-export-ayarlari/, Turkish) and src/data/export-specs.ts.
 * The English page that uses the same data is the video bitrate calculator.
 */
import { YOUTUBE, VIMEO, PRORES, LIMITS, EXPORT_SOURCES, CHECKED } from "../data/export-specs";
import { SOURCES } from "./common";

export const EXPORT_PLATFORMS = ["youtube", "youtube_hdr", "vimeo", "instagram_reels", "tiktok", "prores_master"] as const;
export type ExportPlatform = (typeof EXPORT_PLATFORMS)[number];
export type ExportResolution = "1080p" | "4k";

const r = (x: readonly number[]) => (x[0] === x[1] ? `${x[0]}` : `${x[0]}-${x[1]}`);

const COMMON_STEPS = [
  "Match the timeline resolution and frame rate to the footage; convert variable-frame-rate phone clips to a constant frame rate before editing.",
  "Keep the frame rate as shot (don't convert 25 fps to 30) and use square pixels (1.0).",
  "Set bitrate mode to VBR, 2 pass; set the maximum bitrate to about 1.5x the target. If there is a size limit, work out the bitrate from duration and target size first.",
  "Turn on 'Fast Start' (moov atom at the front) if your editor offers it, then watch the file end to end on a phone and a computer, looking for banding, stutter and audio drift.",
];

export function exportSettings({ platform, resolution = "1080p", orientation = "vertical" }: { platform: ExportPlatform; resolution?: ExportResolution; orientation?: "vertical" | "horizontal" }) {
  const k4 = resolution === "4k";
  const size = k4 ? (orientation === "vertical" ? "2160x3840" : "3840x2160") : orientation === "vertical" ? "1080x1920" : "1920x1080";
  const rastTarget = k4 ? "25/30 fps: 45 Mbps target · 50/60 fps: 68 Mbps target" : "25/30 fps: 16 Mbps target · 50/60 fps: 24 Mbps target";
  const color = k4 ? "SDR: Rec.709, 4:2:0, 8-bit · HDR: Rec.2020 + PQ or HLG, 10-bit" : "Rec.709, 4:2:0, 8-bit";
  const audio = "AAC-LC, 48 kHz, stereo, 320 kbps";
  const key = k4 ? "2160" : "1080";
  let s: Record<string, string>;
  const notes: string[] = [];
  let official: { text: string; url: string }[];

  switch (platform) {
    case "youtube":
      s = {
        container: "MP4 (moov atom at the front / Fast Start)",
        video_codec: "H.264 High Profile, CABAC, 2 consecutive B-frames, closed GOP of half the frame rate",
        resolution: size,
        frame_rate: "As shot, constant",
        bitrate: `YouTube recommends ${r(YOUTUBE.sdr[key].std)} Mbps at 24/25/30 fps and ${r(YOUTUBE.sdr[key].high)} Mbps at 48/50/60 fps (VBR)`,
        color,
        audio: `AAC-LC, 48 kHz, stereo ${YOUTUBE.audioKbps.stereo} kbps (5.1: ${YOUTUBE.audioKbps.surround} kbps)`,
      };
      official = [EXPORT_SOURCES.youtube];
      break;
    case "youtube_hdr":
      s = {
        container: "MP4",
        video_codec: "H.264/H.265 10-bit",
        resolution: size,
        frame_rate: "As shot, constant",
        bitrate: `YouTube HDR: ${r(YOUTUBE.hdr[key].std)} Mbps at 24/25/30 fps, ${r(YOUTUBE.hdr[key].high)} Mbps at 48/50/60 fps`,
        color: "Rec.2020 + PQ or HLG, 10-bit",
        audio: `AAC-LC, 48 kHz, stereo ${YOUTUBE.audioKbps.stereo} kbps`,
      };
      notes.push("YouTube does not support HDR at 480p and below.");
      official = [EXPORT_SOURCES.youtube];
      break;
    case "vimeo":
      s = {
        container: "MP4 (or .mov for ProRes)",
        video_codec: "H.264 High Profile, ProRes 422 HQ or H.265",
        resolution: size,
        frame_rate: "As shot, constant",
        bitrate: `Vimeo recommends ${r(VIMEO[key])} Mbps (any frame rate)`,
        color,
        audio: `AAC-LC, 48 kHz, ${VIMEO.audioKbps} kb/s`,
      };
      official = [EXPORT_SOURCES.vimeo];
      break;
    case "instagram_reels":
      s = {
        container: "MP4 or MOV",
        video_codec: "H.264 High Profile",
        resolution: k4 ? `${size} (Instagram downsizes; Meta recommends 1440x2560 for ads)` : "1080x1920 (9:16)",
        frame_rate: `As shot, constant; at least ${LIMITS.instagramMinFps} FPS (shoot 30 or 60 fps for Instagram)`,
        bitrate: `No official value for organic Reels; Rast target ${rastTarget}`,
        color: "Rec.709, 4:2:0, 8-bit",
        audio: `${audio} (Meta: stereo AAC ${LIMITS.metaAudioMinKbps} kbps or more)`,
      };
      notes.push(`Ads: square pixels, progressive scan, max ${LIMITS.metaMaxGB} GB.`, "Turn on 'Upload at highest quality' in the Instagram app settings.", "Keep text inside the Reels safe zone (top ~220 px, bottom ~420 px, right ~150 px on 1080x1920).");
      official = [EXPORT_SOURCES.instagram, EXPORT_SOURCES.meta];
      break;
    case "tiktok":
      s = {
        container: "MP4 or MOV",
        video_codec: "H.264 High Profile",
        resolution: "1080x1920 (9:16; ads need at least 540x960)",
        frame_rate: "As shot, constant",
        bitrate: `No official value for organic posts; Rast target ${rastTarget}. Ads: at least ${LIMITS.tiktokAdMinKbps} kbps`,
        color: "Rec.709, 4:2:0, 8-bit",
        audio,
      };
      notes.push(`In-Feed ads (non-Spark): max ${LIMITS.tiktokAdMaxMB} MB per file.`);
      official = [EXPORT_SOURCES.tiktok];
      break;
    case "prores_master": {
      const res = k4 ? "3840x2160" : "1920x1080";
      const v25 = PRORES[res]["25"][3];
      s = {
        container: "QuickTime .mov",
        video_codec: "Apple ProRes 422 HQ",
        resolution: res,
        frame_rate: "As shot, constant",
        bitrate: `About ${v25} Mbps at 25 fps (Apple target data rate); about ${Math.round((v25 * 3600) / 8000)} GB per hour`,
        color: "Same as the timeline (Rec.709 for SDR, Rec.2020 for HDR); ProRes 422 HQ stores 10-bit 4:2:2",
        audio: "Uncompressed PCM, 48 kHz (common master practice)",
      };
      notes.push("Keep the ProRes master separate from the delivery MP4 and export every platform version from it.");
      official = [EXPORT_SOURCES.prores];
      break;
    }
  }
  return {
    platform,
    resolution,
    orientation,
    settings: s,
    notes,
    steps: COMMON_STEPS,
    official_sources: official,
    values_checked: CHECKED,
    source: SOURCES.bitrate,
  };
}
