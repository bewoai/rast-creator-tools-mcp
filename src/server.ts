import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSafeZone, PLATFORM_IDS } from "./tools/safeZone";
import { checkTextPosition } from "./tools/textPosition";
import { calculateBitrate, BITRATE_PLATFORMS, RESOLUTIONS } from "./tools/bitrate";
import { validateSrt, MAX_SRT_CHARS } from "./tools/srt";
import { exportSettings, EXPORT_PLATFORMS } from "./tools/exportSettings";

export const SERVER_NAME = "rast-creator-tools";
export const SERVER_VERSION = "1.0.0";

export const INSTRUCTIONS = `Rast Creator Tools by Rast Creative Studio (rastcreative.com) answers practical questions about preparing short-form and online video for upload:
- safe zones on vertical 9:16 video for Instagram Reels, TikTok, YouTube Shorts and Instagram Stories (where the app UI covers the frame, and whether a given text box is covered);
- video bitrate and file size for a duration, resolution and frame rate, or the highest bitrate that fits a target file size;
- checking SRT/WebVTT subtitle text for timing overlaps, too-short gaps, reading speed, line length and broken (mojibake) characters;
- recommended export settings (codec, bitrate, frame rate, colour, audio) for YouTube, Vimeo, Instagram Reels, TikTok and a ProRes master.
All calculations are deterministic, run on the input given in the request and store nothing. Safe-zone values are approximate (rounded to 10 px on a 1080x1920 frame) and dated; platform figures come from the platforms' own help pages. Every result includes a "source" link to the matching free tool on rastcreative.com.`;

const ANN = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const platformDesc =
  "Vertical video platform: 'reels' (Instagram Reels), 'tiktok', 'shorts' (YouTube Shorts), 'story' (Instagram Stories) or 'all' (the strictest margins of all four combined).";

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}
function fail(e: unknown) {
  return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
}
const wrap =
  <A,>(fn: (a: A) => unknown) =>
  async (a: A) => {
    try {
      return ok(fn(a));
    } catch (e) {
      return fail(e);
    }
  };

export function createServer() {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION, title: "Rast Creator Tools" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "get_safe_zone",
    {
      title: "Get vertical video safe zone",
      description:
        "Returns the approximate areas of a vertical (9:16) video frame that the app interface covers on Instagram Reels, TikTok, YouTube Shorts or Instagram Stories: unsafe margins in pixels and percent, the safe rectangle for text, the position of the right-hand button column and short placement guidance. Values are measured on 1080x1920 and scaled to the given frame size.",
      inputSchema: {
        platform: z.enum(PLATFORM_IDS).describe(platformDesc),
        width: z.number().int().positive().max(20000).optional().describe("Frame width in pixels. Default 1080."),
        height: z.number().int().positive().max(20000).optional().describe("Frame height in pixels. Default 1920."),
      },
      annotations: { title: "Get vertical video safe zone", ...ANN },
    },
    wrap(getSafeZone),
  );

  server.registerTool(
    "check_text_position",
    {
      title: "Check text position against platform UI",
      description:
        "Checks whether a rectangular text box (caption, title or logo) on a vertical video frame stays inside the safe zone of Instagram Reels, TikTok, YouTube Shorts or Instagram Stories. Reports which interface element it overlaps (top bar, bottom caption area, right button column, edge margins, optionally the Reels comment-reply sticker) and suggests the nearest position that clears them. Coordinates are pixels from the top-left corner of the frame.",
      inputSchema: {
        platform: z.enum(PLATFORM_IDS).describe(platformDesc),
        x: z.number().describe("Left edge of the text box in pixels, measured from the left of the frame."),
        y: z.number().describe("Top edge of the text box in pixels, measured from the top of the frame."),
        width: z.number().positive().describe("Text box width in pixels."),
        height: z.number().positive().describe("Text box height in pixels."),
        canvas_width: z.number().int().positive().max(20000).optional().describe("Frame width in pixels. Default 1080."),
        canvas_height: z.number().int().positive().max(20000).optional().describe("Frame height in pixels. Default 1920."),
        include_comment_sticker: z.boolean().optional().describe("Reels only: also test against the comment-reply sticker band (approximately y 300-560 px on 1080x1920). Default false."),
      },
      annotations: { title: "Check text position against platform UI", ...ANN },
    },
    wrap(checkTextPosition),
  );

  server.registerTool(
    "calculate_bitrate",
    {
      title: "Calculate video bitrate and file size",
      description:
        "Calculates the file size of a video export from its duration and bitrate, or (when target_size_mb is given) the highest video bitrate that fits that size with a 2% safety margin. Without an explicit bitrate it uses the reference value for the platform, resolution and frame rate (YouTube and Vimeo recommendations, Apple ProRes target data rates, or Rast's delivery target for Instagram and TikTok, which publish none). Also returns size-limit warnings (Meta 4 GB, TikTok ads 500 MB / 516 kbps) and a two-pass ffmpeg command.",
      inputSchema: {
        duration_seconds: z.number().positive().max(864000).describe("Video length in seconds (e.g. 90 for 1:30)."),
        resolution: z.enum(Object.keys(RESOLUTIONS) as [keyof typeof RESOLUTIONS, ...(keyof typeof RESOLUTIONS)[]]).optional().describe("'720p', '1080p' (also 1080x1920 vertical), '1440p', '2160p' (4K UHD) or 'dci4k' (4096x2160). Default '1080p'."),
        fps: z.number().positive().max(240).optional().describe("Frame rate, e.g. 24, 25, 29.97, 30, 50, 60. Default 30. 48 fps and above use the high-frame-rate tables."),
        platform: z.enum(BITRATE_PLATFORMS).optional().describe("Delivery target used for the reference bitrate: 'youtube', 'youtube_hdr', 'vimeo', 'instagram', 'tiktok', or a ProRes flavour ('prores_proxy', 'prores_lt', 'prores_422', 'prores_hq', 'prores_4444', 'prores_xq'). Default 'youtube'."),
        video_bitrate_mbps: z.number().positive().max(10000).optional().describe("Video bitrate in Mbps to calculate the file size with. Omit to use the platform reference value."),
        audio_kbps: z.number().min(0).max(5000).optional().describe("Audio bitrate in kbps; 0 = no audio. Default 320."),
        target_size_mb: z.number().positive().max(10_000_000).optional().describe("If set, calculate the maximum video bitrate that fits this file size in megabytes (1 MB = 1,000,000 bytes) instead of the file size."),
      },
      annotations: { title: "Calculate video bitrate and file size", ...ANN },
    },
    wrap(calculateBitrate),
  );

  server.registerTool(
    "validate_srt",
    {
      title: "Validate SRT or WebVTT subtitles",
      description:
        "Checks pasted SRT or WebVTT subtitle text and lists problems per subtitle: overlapping or out-of-order timings, gaps shorter than the minimum frame gap, reading speed (characters per second), line length, line count, too short or too long durations, and broken characters from a wrong encoding (mojibake such as 'Ã©' or 'â€™', with the probable correct text). Optionally returns a corrected SRT. The text is only processed for this response.",
      inputSchema: {
        srt_text: z.string().min(1).max(MAX_SRT_CHARS).describe("Full text of the .srt or .vtt file."),
        preset: z.enum(["netflix", "vertical", "children"]).optional().describe("Rule set: 'netflix' (42 chars/line, 2 lines, 17-20 CPS, 0.83-7 s; default), 'vertical' (short-form vertical video: 32 chars/line, 2 lines, 17-20 CPS, 1-5 s) or 'children' (42 chars/line, 13-17 CPS)."),
        fps: z.number().positive().max(240).optional().describe("Video frame rate used for the minimum gap. Default 25."),
        min_gap_frames: z.number().int().min(0).max(12).optional().describe("Minimum gap between subtitles in frames. Default 2."),
        include_fixed_srt: z.boolean().optional().describe("Also return a corrected SRT (encoding fixed, overlaps trimmed, long single lines split, short subtitles extended). Default false."),
      },
      annotations: { title: "Validate SRT or WebVTT subtitles", ...ANN },
    },
    wrap(validateSrt),
  );

  server.registerTool(
    "export_settings",
    {
      title: "Recommended video export settings",
      description:
        "Returns recommended export settings for uploading a finished video to YouTube (SDR or HDR), Vimeo, Instagram Reels or TikTok, or for a ProRes archive master: container, codec, resolution, frame rate, bitrate, colour and audio, plus links to each platform's official spec page and a short step list that works in any editor.",
      inputSchema: {
        platform: z.enum(EXPORT_PLATFORMS).describe("'youtube', 'youtube_hdr', 'vimeo', 'instagram_reels', 'tiktok' or 'prores_master'."),
        resolution: z.enum(["1080p", "4k"]).optional().describe("'1080p' (default) or '4k'."),
        orientation: z.enum(["vertical", "horizontal"]).optional().describe("'vertical' 9:16 (default) or 'horizontal' 16:9; changes the frame size given."),
      },
      annotations: { title: "Recommended video export settings", ...ANN },
    },
    wrap(exportSettings),
  );

  return server;
}
