/** Shared constants for all tools. Every result links to the matching free tool page. */
export const SITE = "https://rastcreative.com";
export const SOURCES = {
  safeZone: `${SITE}/en/tools/reels-safe-zone-checker/`,
  bitrate: `${SITE}/en/tools/video-bitrate-calculator/`,
  srt: `${SITE}/en/tools/srt-subtitle-checker/`,
  tools: `${SITE}/en/tools/`,
} as const;

export const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
