import { describe, it, expect } from "vitest";
import { getSafeZone } from "../src/tools/safeZone";
import { checkTextPosition } from "../src/tools/textPosition";
import { calculateBitrate, referenceBitrate } from "../src/tools/bitrate";
import { validateSrt } from "../src/tools/srt";
import { exportSettings } from "../src/tools/exportSettings";

const SZ = "https://rastcreative.com/en/tools/reels-safe-zone-checker/";

describe("get_safe_zone", () => {
  it("returns the site's Reels values on 1080x1920", () => {
    const r = getSafeZone({ platform: "reels" });
    expect(r.unsafe_margins_px).toEqual({ top: 220, bottom: 420, left: 60, right: 150 });
    expect(r.safe_area_px).toEqual({ x: 60, y: 220, width: 870, height: 1280 });
    expect(r.right_button_column_px).toEqual({ x_from: 930, y_from: 900, y_to: 1500 });
    expect(r.unsafe_margins_percent.bottom).toBe(21.9);
    expect(r.source).toBe(SZ);
  });
  it("scales to 720x1280 and has no button column on Stories", () => {
    const r = getSafeZone({ platform: "story", width: 720, height: 1280 });
    expect(r.unsafe_margins_px).toEqual({ top: 167, bottom: 227, left: 40, right: 40 });
    expect(r.right_button_column_px).toBeNull();
    expect(r.guidance.join(" ")).toMatch(/Meta officially recommends/);
  });
  it("combines the strictest margins for 'all'", () => {
    const r = getSafeZone({ platform: "all" });
    expect(r.unsafe_margins_px).toEqual({ top: 290, bottom: 670, left: 60, right: 190 });
  });
  it("Shorts matches Google's vertical ad spec rounding", () => {
    expect(getSafeZone({ platform: "shorts" }).unsafe_margins_px).toEqual({ top: 290, bottom: 670, left: 50, right: 190 });
  });
  it("flags non-9:16 frames as approximate", () => {
    expect(getSafeZone({ platform: "tiktok", width: 1080, height: 1350 }).guidance.join(" ")).toMatch(/not 9:16/);
  });
  it("rejects invalid sizes", () => {
    expect(() => getSafeZone({ platform: "reels", width: 0 })).toThrow();
  });
});

describe("check_text_position", () => {
  it("accepts a box inside the Reels safe area", () => {
    const r = checkTextPosition({ platform: "reels", x: 100, y: 700, width: 700, height: 200 });
    expect(r.inside_safe_zone).toBe(true);
    expect(r.collisions).toEqual([]);
    expect(r.source).toBe(SZ);
  });
  it("detects the bottom caption area and suggests a move", () => {
    const r = checkTextPosition({ platform: "tiktok", x: 100, y: 1500, width: 600, height: 150 });
    expect(r.inside_safe_zone).toBe(false);
    expect(r.collisions.map((c) => c.zone)).toEqual(["bottom"]);
    expect(r.collisions[0].ui_element).toMatch(/caption/);
    expect(r.suggested_position).toEqual({ x: 100, y: 1290, move_right_px: 0, move_down_px: -210 });
  });
  it("detects the right button column", () => {
    const r = checkTextPosition({ platform: "reels", x: 600, y: 1000, width: 400, height: 100 });
    expect(r.collisions.map((c) => c.zone)).toEqual(["right_buttons"]);
    expect(r.collisions[0].ui_element).toMatch(/like/);
    expect(r.suggested_position?.x).toBe(530);
  });
  it("detects the top bar on Shorts and scales canvas coordinates", () => {
    const r = checkTextPosition({ platform: "shorts", x: 100, y: 50, width: 300, height: 100, canvas_width: 720, canvas_height: 1280 });
    expect(r.collisions[0].zone).toBe("top");
    expect(r.safe_area_px.y).toBe(193);
  });
  it("optionally checks the Reels comment sticker", () => {
    const base = { platform: "reels" as const, x: 200, y: 350, width: 500, height: 100 };
    expect(checkTextPosition(base).inside_safe_zone).toBe(true);
    const r = checkTextPosition({ ...base, include_comment_sticker: true });
    expect(r.collisions[0].zone).toBe("comment_sticker");
  });
  it("says when a box is larger than the safe area", () => {
    const r = checkTextPosition({ platform: "reels", x: 0, y: 0, width: 1080, height: 1920 });
    expect(r.suggested_position).toBeNull();
    expect(r.summary).toMatch(/larger than the safe area/);
  });
});

describe("calculate_bitrate", () => {
  it("uses the YouTube 1080p reference and the site's size formula", () => {
    const r = calculateBitrate({ duration_seconds: 60, resolution: "1080p", fps: 30, platform: "youtube" }) as any;
    expect(r.reference.video_bitrate_mbps).toBe(8);
    // (8000 + 320) kbps * 1000 * 60 / 8 = 62.4 MB
    expect(r.estimated_size_mb).toBe(62.4);
    expect(r.mb_per_minute).toBe(62.4);
    expect(r.source).toBe("https://rastcreative.com/en/tools/video-bitrate-calculator/");
  });
  it("max bitrate for a target size keeps a 2% margin", () => {
    const r = calculateBitrate({ duration_seconds: 120, target_size_mb: 100, audio_kbps: 128 }) as any;
    // 100e6*0.98*8/120/1000 = 6533.33 kbps total - 128 = 6405
    expect(r.max_video_bitrate_kbps).toBe(6405);
    expect(r.ffmpeg_two_pass).toContain("-b:v 6405k");
    expect(r.ffmpeg_two_pass).toContain("-g 15");
  });
  it("warns when the target is too small for the audio", () => {
    const r = calculateBitrate({ duration_seconds: 600, target_size_mb: 1, audio_kbps: 320 }) as any;
    expect(r.max_video_bitrate_kbps).toBe(0);
    expect(r.warnings[0]).toMatch(/doesn't even fit the audio/);
  });
  it("warns over Meta's 4 GB limit", () => {
    const r = calculateBitrate({ duration_seconds: 3600, platform: "prores_hq", resolution: "1080p", fps: 25 }) as any;
    expect(r.reference.video_bitrate_mbps).toBe(184);
    expect(r.warnings.join(" ")).toMatch(/4 GB/);
    expect(r.ffmpeg_two_pass).toBeNull();
  });
  it("covers high frame rate, HDR, Vimeo and Instagram references", () => {
    expect(referenceBitrate("youtube", "2160p", 60).mbps).toBe(68);
    expect(referenceBitrate("youtube_hdr", "1080p", 25).mbps).toBe(10);
    expect(referenceBitrate("vimeo", "1080p", 25).mbps).toBe(20);
    const ig = referenceBitrate("instagram", "1080p", 30);
    expect(ig.mbps).toBe(16);
    expect(ig.official).toBe(false);
    expect(referenceBitrate("prores_422", "1080p", 29.97).mbps).toBe(147);
  });
  it("rejects a zero duration", () => {
    expect(() => calculateBitrate({ duration_seconds: 0 })).toThrow();
  });
});

const SRT = `1
00:00:00,500 --> 00:00:01,000
Hi!

2
00:00:01,020 --> 00:00:04,000
Today we're telling you the story of a brand film we shot in a single day in Sakarya.

3
00:00:03,800 --> 00:00:06,000
The shoot started at six in the morning at the cafÃ© by the lake.

4
00:00:06,200 --> 00:00:07,000
Short.
`;

describe("validate_srt", () => {
  it("finds overlap, gap, line length and mojibake", () => {
    const r = validateSrt({ srt_text: SRT }) as any;
    expect(r.format).toBe("SRT");
    expect(r.summary.cues).toBe(4);
    const all = r.issues.flatMap((i: any) => i.problems.map((p: any) => p.text)).join("\n");
    expect(all).toMatch(/Gap to next 20 ms \(< 2 frames\)/);
    expect(all).toMatch(/Line is 8[0-9] characters \(max 42\)/);
    expect(all).toMatch(/Overlaps the next one by 0\.200 s/);
    expect(all).toMatch(/Broken characters.*café/);
    expect(all).toMatch(/Duration 0\.50 s \(min 0\.83\)/);
    expect(r.summary.verdict).toBe("Fix the errors before publishing");
    expect(r.source).toBe("https://rastcreative.com/en/tools/srt-subtitle-checker/");
  });
  it("returns a fixed SRT", () => {
    const r = validateSrt({ srt_text: SRT, include_fixed_srt: true }) as any;
    expect(r.fixed_srt).toContain("café");
    expect(r.fixed_srt).toContain("--> 00:00:03,720");
    expect(r.fix_changes.length).toBeGreaterThan(0);
    const again = validateSrt({ srt_text: r.fixed_srt }) as any;
    const txt = again.issues.flatMap((i: any) => i.problems.map((p: any) => p.text)).join("\n");
    expect(txt).not.toMatch(/Overlaps|Broken characters/);
  });
  it("parses WebVTT and applies the vertical preset", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nThis line has thirty-five chars ok\n";
    const r = validateSrt({ srt_text: vtt, preset: "vertical" }) as any;
    expect(r.format).toBe("WebVTT");
    expect(r.issues[0].problems[0].text).toMatch(/max 32/);
  });
  it("reports a clean file", () => {
    const r = validateSrt({ srt_text: "1\n00:00:01,000 --> 00:00:03,000\nAll good here.\n" }) as any;
    expect(r.summary.verdict).toBe("No problems found");
  });
  it("reports unreadable timing", () => {
    const r = validateSrt({ srt_text: "1\n00:00:xx --> 00:00:03,000\nHi\n" }) as any;
    expect(r.parse_errors[0]).toMatch(/Couldn't read the timing/);
  });
});

describe("export_settings", () => {
  it("YouTube 1080p uses the official table", () => {
    const r = exportSettings({ platform: "youtube", orientation: "horizontal" });
    expect(r.settings.bitrate).toContain("8 Mbps at 24/25/30 fps");
    expect(r.settings.resolution).toBe("1920x1080");
    expect(r.official_sources[0].url).toContain("support.google.com");
    expect(r.source).toBe("https://rastcreative.com/en/tools/video-bitrate-calculator/");
  });
  it("Instagram Reels gives the min fps and Rast's target", () => {
    const r = exportSettings({ platform: "instagram_reels" });
    expect(r.settings.frame_rate).toContain("at least 30 FPS");
    expect(r.settings.bitrate).toContain("16 Mbps");
  });
  it("ProRes 4K master quotes Apple's data rate", () => {
    const r = exportSettings({ platform: "prores_master", resolution: "4k" });
    expect(r.settings.bitrate).toContain("737 Mbps");
  });
  it("every platform returns all fields", () => {
    for (const p of ["youtube", "youtube_hdr", "vimeo", "instagram_reels", "tiktok", "prores_master"] as const) {
      const r = exportSettings({ platform: p, resolution: "4k" });
      for (const k of ["container", "video_codec", "resolution", "frame_rate", "bitrate", "color", "audio"]) expect(r.settings[k]).toBeTruthy();
    }
  });
});
