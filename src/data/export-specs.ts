/**
 * Export / bitrate reference data. Copied from rastcreativesite src/data/export-specs.ts
 * (commit f099a18), which feeds /en/tools/video-bitrate-calculator/ and the export guide. Every number here comes from an official
 * source listed in EXPORT_SOURCES (checked 30.10.2026). Values are Mbps
 * (1 Mbps = 1,000,000 bit/s). If a platform updates its page, edit here only.
 */

export const CHECKED = "2026-10-30";

export type FpsBand = "std" | "high"; // std = 24/25/30, high = 48/50/60

/** YouTube recommended upload bitrates (SDR / HDR), Mbps, [min, max]. */
export const YOUTUBE = {
  sdr: {
    "2160": { std: [35, 45], high: [53, 68] },
    "1440": { std: [16, 16], high: [24, 24] },
    "1080": { std: [8, 8], high: [12, 12] },
    "720": { std: [5, 5], high: [7.5, 7.5] },
  },
  hdr: {
    "2160": { std: [44, 56], high: [66, 85] },
    "1440": { std: [20, 20], high: [30, 30] },
    "1080": { std: [10, 10], high: [15, 15] },
    "720": { std: [6.5, 6.5], high: [9.5, 9.5] },
  },
  audioKbps: { mono: 128, stereo: 384, surround: 512 },
} as const;

/** Vimeo compression guidelines, Mbps ranges (no fps split). */
export const VIMEO = {
  "2160": [30, 60],
  "1440": [20, 30],
  "1080": [10, 20],
  "720": [5, 10],
  audioKbps: 320,
} as const;

/**
 * Apple ProRes target data rates (Mbps) from the Apple ProRes White Paper
 * (April 2022), appendix "Target Data Rates". Keys: frame size → fps → codec.
 */
export const PRORES_CODECS = ["proxy", "lt", "422", "hq", "4444", "xq"] as const;
export type ProresCodec = (typeof PRORES_CODECS)[number];
export const PRORES_LABEL: Record<ProresCodec, string> = {
  proxy: "ProRes 422 Proxy",
  lt: "ProRes 422 LT",
  "422": "ProRes 422",
  hq: "ProRes 422 HQ",
  "4444": "ProRes 4444",
  xq: "ProRes 4444 XQ",
};
export const PRORES: Record<string, Record<string, number[]>> = {
  // order: proxy, lt, 422, hq, 4444, xq
  "1280x720": {
    "24": [18, 41, 59, 88, 132, 198],
    "25": [19, 42, 61, 92, 138, 206],
    "30": [23, 51, 73, 110, 165, 247],
    "50": [38, 84, 122, 184, 275, 413],
    "60": [45, 101, 147, 220, 330, 495],
  },
  "1920x1080": {
    "24": [36, 82, 117, 176, 264, 396],
    "25": [38, 85, 122, 184, 275, 413],
    "30": [45, 102, 147, 220, 330, 495],
    "50": [76, 170, 245, 367, 551, 826],
    "60": [91, 204, 293, 440, 660, 990],
  },
  "3840x2160": {
    "24": [145, 328, 471, 707, 1061, 1591],
    "25": [151, 342, 492, 737, 1106, 1659],
    "30": [182, 410, 589, 884, 1326, 1989],
    "50": [303, 684, 983, 1475, 2212, 3318],
    "60": [363, 821, 1178, 1768, 2652, 3977],
  },
  "4096x2160": {
    "24": [155, 350, 503, 754, 1131, 1697],
    "25": [162, 365, 524, 786, 1180, 1769],
    "30": [194, 437, 629, 943, 1414, 2121],
    "50": [323, 730, 1049, 1573, 2359, 3539],
    "60": [388, 875, 1257, 1886, 2828, 4242],
  },
};

/** Platform upload limits that matter for "fit under X". */
export const LIMITS = {
  metaMaxGB: 4, // Meta Ads Guide, Instagram Reels / Feed video: max 4 GB
  tiktokAdMaxMB: 500, // TikTok Ads Manager, non-Spark In-Feed: ≤ 500 MB
  tiktokAdMinKbps: 516, // TikTok Ads Manager: bitrate ≥ 516 kbps
  metaAudioMinKbps: 128, // Meta: stereo AAC 128 kbps+
  instagramMinFps: 30, // Instagram Help: Reels min 30 FPS, min 720 px
};

export const EXPORT_SOURCES = {
  youtube: {
    text: "YouTube Help, 'YouTube recommended upload encoding settings': MP4 with the moov atom at the front (Fast Start), AAC-LC 48 kHz, H.264 High Profile, 2 consecutive B-frames, closed GOP (half the frame rate), CABAC, variable bitrate, 4:2:0, BT.709; SDR/HDR bitrate tables.",
    url: "https://support.google.com/youtube/answer/1722171",
  },
  vimeo: {
    text: "Vimeo Help Center, 'Video and audio compression guidelines' (updated 12 Dec 2025): H.264 High Profile, ProRes 422 HQ or H.265; constant frame rate; 1080p 10-20 Mbps, 4K 30-60 Mbps; AAC-LC 320 kb/s, 48 kHz.",
    url: "https://help.vimeo.com/hc/en-us/articles/12426043233169-Video-and-audio-compression-guidelines",
  },
  meta: {
    text: "Meta Ads Guide, Instagram Reels video ads: MP4/MOV, H.264, square pixels, constant frame rate, progressive scan, stereo AAC 128 kbps+, max 4 GB, 1440x2560 recommended.",
    url: "https://www.facebook.com/business/ads-guide/update/video/instagram-reels",
  },
  instagram: {
    text: "Instagram Help Center, 'Reel size & aspect ratios': ratio between 1.91:1 and 9:16, at least 30 FPS and 720 pixels; 'Upload at highest quality' setting.",
    url: "https://help.instagram.com/1038071743007909",
  },
  tiktok: {
    text: "TikTok Ads Manager, 'TikTok Auction In-Feed Ads' (non-Spark ads): vertical 9:16 at least 540x960, .mp4/.mov, max 500 MB, bitrate at least 516 kbps.",
    url: "https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads",
  },
  prores: {
    text: "Apple ProRes White Paper (April 2022), 'Target Data Rates' appendix.",
    url: "https://www.apple.com/final-cut-pro/docs/Apple_ProRes_White_Paper.pdf",
  },
} as const;
