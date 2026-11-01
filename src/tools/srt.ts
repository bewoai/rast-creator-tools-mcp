/**
 * SRT / WebVTT checker. Parsing, rules and fixes mirror
 * https://rastcreative.com/en/tools/srt-subtitle-checker/ (English mode).
 */
import { SOURCES, round } from "./common";

export type Cue = { idx: number; start: number; end: number; lines: string[]; raw: string };
export type Level = "error" | "warning" | "info";
export type Rules = { cpl: number; lines: number; cps: number; cpsMax: number; minDur: number; maxDur: number; gapFrames: number; fps: number };

export const PRESETS = {
  netflix: { cpl: 42, lines: 2, cps: 17, cpsMax: 20, minDur: 0.83, maxDur: 7 },
  vertical: { cpl: 32, lines: 2, cps: 17, cpsMax: 20, minDur: 1, maxDur: 5 },
  children: { cpl: 42, lines: 2, cps: 13, cpsMax: 17, minDur: 0.83, maxDur: 7 },
} as const;
export type Preset = keyof typeof PRESETS;
export const PRESET_LABEL: Record<Preset, string> = {
  netflix: "Netflix-style (adult): 42 chars/line, 2 lines, max 20 CPS",
  vertical: "Vertical short-form video (Rast): 32 chars/line, 2 lines, 17 CPS",
  children: "Netflix-style (children): 42 chars/line, 2 lines, max 17 CPS",
};

// mojibake (UTF-8 read as cp1252/1254) -> correct letters
const MOJI: [string, string][] = [
  ["Ã‡", "Ç"], ["Ã§", "ç"], ["Ä\u009e", "Ğ"], ["Äž", "Ğ"], ["ÄŸ", "ğ"], ["Ä°", "İ"], ["Ä±", "ı"],
  ["Ã–", "Ö"], ["Ã¶", "ö"], ["Å\u009e", "Ş"], ["Åž", "Ş"], ["ÅŸ", "ş"], ["Ãœ", "Ü"], ["Ã¼", "ü"],
  ["Ã¢", "â"], ["Ã®", "î"], ["Ã»", "û"], ["Ã©", "é"], ["â€™", "’"], ["â€˜", "‘"], ["â€œ", "“"], ["â€\u009d", "”"],
  ["â€", "”"], ["â€¦", "…"], ["â€“", "–"], ["â€”", "—"], ["Â ", " "], ["Â", ""],
];
MOJI.sort((a, b) => b[0].length - a[0].length);
const mojiRe = /Ã.|Ä.|Å.|â€|Â(?=[\s\u00a0-\u00bf]|$)/;
export const fixMoji = (s: string) => {
  let o = s;
  for (const [a, b] of MOJI) o = o.split(a).join(b);
  return o;
};

export function toSec(t: string) {
  const m = t.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (!m) return NaN;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}
export function fmtSrt(s: number) {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`;
}
const short = (s: number) => fmtSrt(s).slice(3);
const nf = (x: number, d = 1) => x.toFixed(d);

export function parse(text: string) {
  const errs: string[] = [];
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const isVtt = /^WEBVTT/.test(t.trim());
  const blocks = t.split(/\n{2,}/);
  const cues: Cue[] = [];
  let n = 0;
  for (const b of blocks) {
    const lines = b.split("\n").filter((l, i, a) => !(i === a.length - 1 && l === ""));
    if (!lines.length || !lines.join("").trim()) continue;
    if (/^WEBVTT/.test(lines[0]) || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) {
      errs.push(`Skipped a block with no timing line: "${lines[0].slice(0, 40)}"`);
      continue;
    }
    const [a, rest] = lines[ti].split("-->");
    const bTime = rest.trim().split(/\s+/)[0];
    const start = toSec(a), end = toSec(bTime);
    n++;
    if (isNaN(start) || isNaN(end)) {
      errs.push(`Couldn't read the timing in subtitle ${n}: "${lines[ti].trim()}"`);
      continue;
    }
    cues.push({ idx: n, start, end, lines: lines.slice(ti + 1), raw: b });
  }
  return { cues, errs, isVtt };
}

const clean = (l: string) => l.replace(/<[^>]+>/g, "").replace(/\{\\[^}]*\}/g, "");
const tidy = (l: string) => l.replace(/[ \t\u00a0]+/g, " ").trim();
const charCount = (lines: string[]) => lines.map((l) => clean(l).trim()).join(" ").length;

export function check(cues: Cue[], R: Rules) {
  const frame = 1 / R.fps;
  const minGap = R.gapFrames * frame - 0.0005;
  return cues.map((c, i) => {
    const iss: { level: Level; text: string }[] = [];
    const ls = c.lines.map((l) => clean(l));
    const dur = c.end - c.start;
    const chars = charCount(c.lines);
    const cps = dur > 0 ? chars / dur : Infinity;
    const maxLine = Math.max(0, ...ls.map((l) => tidy(l).length));
    if (dur <= 0) iss.push({ level: "error", text: "Ends before it starts" });
    if (!ls.join("").trim()) iss.push({ level: "error", text: "Empty subtitle" });
    if (maxLine > R.cpl) iss.push({ level: "error", text: `Line is ${maxLine} characters (max ${R.cpl})` });
    if (ls.length > R.lines) iss.push({ level: "error", text: `${ls.length} lines (max ${R.lines})` });
    if (dur > 0 && cps > R.cpsMax) iss.push({ level: "error", text: `Reading speed ${nf(cps)} CPS (max ${nf(R.cpsMax)})` });
    else if (dur > 0 && cps > R.cps) iss.push({ level: "warning", text: `Reading speed ${nf(cps)} CPS (target ${nf(R.cps)})` });
    if (dur > 0 && dur < R.minDur - 0.0005) iss.push({ level: "warning", text: `Duration ${nf(dur, 2)} s (min ${nf(R.minDur, 2)})` });
    if (dur > R.maxDur + 0.0005) iss.push({ level: "warning", text: `Duration ${nf(dur, 2)} s (max ${nf(R.maxDur, 1)})` });
    const next = cues[i + 1];
    if (next) {
      const gap = next.start - c.end;
      if (gap < -0.0005) iss.push({ level: "error", text: `Overlaps the next one by ${nf(-gap, 3)} s` });
      else if (gap < minGap) iss.push({ level: "error", text: `Gap to next ${(gap * 1000).toFixed(0)} ms (< ${R.gapFrames} frames)` });
      else if (gap < 0.5 && gap > 2 * frame + 0.0005) iss.push({ level: "info", text: `Gap of ${Math.round(gap / frame)} frames: can be closed to 2` });
    }
    if (i > 0 && c.start < cues[i - 1].start) iss.push({ level: "error", text: "Out of order (starts before the previous subtitle)" });
    const raw = c.lines.join("\n");
    if (mojiRe.test(raw)) iss.push({ level: "error", text: `Broken characters (encoding). Probably meant: "${fixMoji(raw).replace(/\n/g, " / ")}"` });
    if (/\uFFFD/.test(raw)) iss.push({ level: "error", text: "Unreadable character (\uFFFD): wrong file encoding" });
    if (c.lines.some((l) => /^\s|\s$| {2,}/.test(l))) iss.push({ level: "info", text: "Extra spaces" });
    if (/-->.*\b(position|line|align|size):/.test(c.raw)) iss.push({ level: "info", text: "VTT position setting (removed in SRT)" });
    return { cue: c, iss, chars, cps, dur, maxLine };
  });
}

function balance(l: string, max: number) {
  const s = tidy(l);
  if (s.length <= max) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  if (best < 0) return [s];
  const a = s.slice(0, best), b = s.slice(best + 1);
  return a.length <= max && b.length <= max ? [a, b] : [s];
}

/** Same fixer as the site with every option on (mojibake, overlaps, line balance, short cues; gap chaining off). */
export function fix(cues: Cue[], R: Rules) {
  const minGap = R.gapFrames / R.fps;
  const out = cues
    .map((c) => ({ ...c, lines: c.lines.map(fixMoji).map(tidy).filter((l) => l !== "") }))
    .filter((c) => c.lines.length && c.end > c.start)
    .sort((a, b) => a.start - b.start);
  const changes: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    const n = out[i + 1];
    if (c.lines.length === 1 && c.lines[0].length > R.cpl && R.lines >= 2) {
      const b = balance(c.lines[0], R.cpl);
      if (b.length === 2) {
        c.lines = b;
        changes.push(`#${i + 1}: split over two lines`);
      }
    }
    if (n) {
      const gap = n.start - c.end;
      if (gap < minGap - 0.0005) {
        const newEnd = n.start - minGap;
        if (newEnd > c.start + 0.2) {
          c.end = newEnd;
          changes.push(`#${i + 1}: end ${short(newEnd)} (overlap/gap)`);
        }
      }
    }
    if (c.end - c.start < R.minDur) {
      const limit = n ? n.start - minGap : Infinity;
      const newEnd = Math.min(c.start + R.minDur, limit);
      if (newEnd > c.end + 0.0005) {
        c.end = newEnd;
        changes.push(`#${i + 1}: extended to ${nf(newEnd - c.start, 2)} s`);
      }
    }
  }
  const srt = out.map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.lines.join("\n")}\n`).join("\n");
  return { srt, changes };
}

export const MAX_SRT_CHARS = 200_000;

export type SrtInput = { srt_text: string; preset?: Preset; fps?: number; min_gap_frames?: number; include_fixed_srt?: boolean };

export function validateSrt({ srt_text, preset = "netflix", fps = 25, min_gap_frames = 2, include_fixed_srt = false }: SrtInput) {
  if (typeof srt_text !== "string" || !srt_text.trim()) throw new Error("srt_text is empty");
  if (srt_text.length > MAX_SRT_CHARS) throw new Error(`srt_text is longer than ${MAX_SRT_CHARS} characters; check a shorter file or split it`);
  if (!(fps > 0)) throw new Error("fps must be greater than 0");
  const R: Rules = { ...PRESETS[preset], fps, gapFrames: min_gap_frames };
  const { cues, errs, isVtt } = parse(srt_text);
  const report = check(cues, R);
  const count = (lv: Level) => report.reduce((a, r) => a + r.iss.filter((x) => x.level === lv).length, 0);
  const errors = count("error") + errs.length;
  const issues = report
    .filter((r) => r.iss.length)
    .map((r) => ({
      cue: r.cue.idx,
      time: `${short(r.cue.start)} --> ${short(r.cue.end)}`,
      text: r.cue.lines.join(" / ").slice(0, 120),
      reading_speed_cps: Number.isFinite(r.cps) ? round(r.cps, 1) : null,
      problems: r.iss,
    }));
  const MAX_LISTED = 100;
  const out: Record<string, unknown> = {
    format: isVtt ? "WebVTT" : "SRT",
    rules: { preset, description: PRESET_LABEL[preset], fps, min_gap_frames, ...PRESETS[preset] },
    summary: {
      cues: cues.length,
      cues_with_problems: issues.length,
      errors,
      warnings: count("warning"),
      info: count("info"),
      verdict: !cues.length ? "No subtitles found" : errors ? "Fix the errors before publishing" : count("warning") ? "Usable, with warnings" : "No problems found",
    },
    parse_errors: errs,
    issues: issues.slice(0, MAX_LISTED),
    issues_truncated: issues.length > MAX_LISTED,
    source: SOURCES.srt,
  };
  if (include_fixed_srt) {
    const f = fix(cues, R);
    out.fixed_srt = f.srt;
    out.fix_changes = f.changes;
  }
  return out;
}
