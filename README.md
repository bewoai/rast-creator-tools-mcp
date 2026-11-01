# Rast Creator Tools (remote MCP server)

Stateless remote **MCP server** (Streamable HTTP, TypeScript, Cloudflare Workers) that exposes the free English creator tools of [rastcreative.com/en/tools/](https://rastcreative.com/en/tools/) to AI assistants — built for Google's **Connected Apps Platform** (Gemini app, AI Mode) and testable in **Gemini Apps Developer Mode**.

**Live:** `https://rast-creator-tools-mcp.studio-c25.workers.dev/v1/mcp` (health: `https://rast-creator-tools-mcp.studio-c25.workers.dev/health`)
· Privacy policy: https://rastcreative.com/en/tools/creator-tools-mcp-privacy/
· Terms of service: https://rastcreative.com/en/tools/creator-tools-mcp-terms/

- Deterministic, no auth, no user data stored, no logging, no outbound requests.
- Every result carries a `source` link to the matching rastcreative.com tool page.
- All tools are annotated `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`.

## Tools

| Tool | What it does | Data / logic source (site repo) | `source` link |
|---|---|---|---|
| `get_safe_zone` | Unsafe margins (px + %), safe rectangle, right button column, guidance for `reels` / `tiktok` / `shorts` / `story` / `all`, scaled to any frame size | `src/data/safe-zones.json` (copied verbatim) | `/en/tools/reels-safe-zone-checker/` |
| `check_text_position` | Is a text box inside the safe zone? Which UI element does it hit (top bar, caption area, button column, edges, optional Reels comment sticker)? Nearest safe position | same zones, `GuvenliAlan.astro` logic (combined zone, rail clipping) | `/en/tools/reels-safe-zone-checker/` |
| `calculate_bitrate` | File size from duration + bitrate, or max video bitrate for a target size (2 % margin); reference bitrate per platform/resolution/fps; Meta/TikTok limit warnings; 2-pass ffmpeg command | `src/data/export-specs.ts` + `BitrateHesaplayici.astro` formulas | `/en/tools/video-bitrate-calculator/` |
| `validate_srt` | SRT/WebVTT check: overlaps, min frame gap, out-of-order, CPS, line length/count, durations, mojibake (with probable fix), optional fixed SRT | `AltyaziKontrolu.astro` parse/check/fix (English mode, presets netflix/vertical/children) | `/en/tools/srt-subtitle-checker/` |
| `export_settings` | Codec, container, resolution, fps, bitrate, colour, audio + official spec links for YouTube (SDR/HDR), Vimeo, Instagram Reels, TikTok, ProRes master | `/rehber/video-export-ayarlari/` quick table + `export-specs.ts` | `/en/tools/video-bitrate-calculator/` (no EN export guide yet) |

Data copied from `rastcreativesite` commit `f099a18` (values checked 2026-10-30). When the site's JSON/TS data changes, copy the files into `src/data/` again and run the tests.

## Endpoints

| Path | Purpose |
|---|---|
| `POST /v1/mcp` (alias `/mcp`) | MCP JSON-RPC, Streamable HTTP, stateless (no `Mcp-Session-Id`), JSON responses. `GET` → 405 |
| `GET /health` | `{"status":"ok",...}` |
| `GET /` | Short landing JSON (endpoint, tools, data policy) |
| `GET /.well-known/google-connected-apps` | Domain-verification JSON from Connected Console, served from the `GOOGLE_CONNECTED_APPS_TOKEN` var (404 until set) |

## Develop

```bash
npm install
npm test              # vitest: 36 tests (tools + HTTP/MCP round trips)
npm run typecheck
npm run dev           # wrangler dev → http://127.0.0.1:8787
npm run smoke         # health + initialize + tools/list + 2 tools/call over real HTTP
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/v1/mcp --transport http --method tools/list
```

Raw curl:

```bash
curl -s -X POST http://127.0.0.1:8787/v1/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_safe_zone","arguments":{"platform":"reels"}}}'
```

## Deploy (Cloudflare Workers, free plan)

Needs a Cloudflare login on this machine — either `npx wrangler login` (browser OAuth, run by Bewo) or `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") + `CLOUDFLARE_ACCOUNT_ID` in `~/.hermes/.env`. Then:

```bash
npx wrangler deploy                      # → https://rast-creator-tools-mcp.<account-subdomain>.workers.dev
node scripts/smoke.mjs https://rast-creator-tools-mcp.<account-subdomain>.workers.dev
```

Bundle: ~1.47 MB raw / ~258 KB gzip (free-plan limit 3 MB). Stateless, CPU per call is a few ms → well inside the 100k requests/day free tier.

Custom domain (recommended for Google, e.g. `mcp.rastcreative.com`): Workers custom domains need the zone on Cloudflare; rastcreative.com DNS is at Hostinger, so either move DNS to Cloudflare (bigger change, Bewo's decision) or register with the `workers.dev` hostname (domain verification then runs on that hostname via the `.well-known` route above).

## Test in Gemini Apps Developer Mode

1. Deploy (HTTPS is required).
2. Open https://gemini.google.com/devmode (Settings → Gemini Apps Developer Mode) → **+ Create new** → paste `https://<host>/v1/mcp`, authentication **none**.
3. Tool Schemas tab: 5 tools, all "Read-only". Try the example prompts below; check Event Log for status 200 and latency.

## Google Connected Console registration checklist

Prerequisites (Bewo, own Google login): apply for the preview via the interest form; an account admin accepts the Connected Apps ToS; testers must be **@gmail.com** accounts.

1. **Create app** → name **Rast Creator Tools** (users will type `@Rast Creator Tools`).
2. **Category** (cannot be changed later): pick the closest general/utility or *Content creation (design, presentation, video, website)* category. Caution: categories bring baseline "predefined capabilities" (Content creation lists create designs/videos, edit, templates…) that this app does not do — if the console makes those mandatory, choose a more generic category or ask Google; see open questions.
3. **Connection type**: MCP server.
4. **App details**
   - Icon: `assets/icon-512.png` (512×512 PNG, 11 KB, Rast "r." mark).
   - Description (<30 words): *Check Reels, TikTok and Shorts safe zones, caption placement, video bitrate and file size, subtitle errors and export settings before you upload.*
   - Capabilities (≥3, no leading numbers, one per entry):
     - Find the safe zone for Reels, TikTok, YouTube Shorts and Stories
     - Check whether a caption or title is hidden by the app interface
     - Calculate video file size or the bitrate that fits a size limit
     - Check SRT subtitles for overlaps, reading speed and broken characters
     - Get export settings for YouTube, Vimeo, Instagram Reels and TikTok
   - Example prompts (≥3; ≥2 start with the app name, ≥1 mentions it mid-sentence; no quotes/numbering):
     - @Rast Creator Tools what is the safe zone for a 1080x1920 TikTok video?
     - @Rast Creator Tools how big will a 3 minute 4K 30 fps YouTube export be?
     - Is a caption box at y 1550 px covered on Reels? Check it with Rast Creator Tools
     - @Rast Creator Tools check this SRT for timing and encoding errors
   - Terms of Service URL: `https://rastcreative.com/en/tools/creator-tools-mcp-terms/` (live)
   - Privacy Policy URL: `https://rastcreative.com/en/tools/creator-tools-mcp-privacy/` (live)
   - Website: `https://rastcreative.com/en/tools/`
5. **MCP endpoint**: `https://rast-creator-tools-mcp.studio-c25.workers.dev/v1/mcp` → **Download token** → put the file's JSON in `wrangler.jsonc` `vars.GOOGLE_CONNECTED_APPS_TOKEN` → `wrangler deploy` → `curl -i https://<host>/.well-known/google-connected-apps` (200, no redirect) → **Verify domain**.
6. **Access credentials**: "Does your server require authorization?" → **No**.
7. **Sync tools** → expect 5. Availability: languages English; countries as wanted; products Gemini app (+ AI Mode if offered).
8. Per tool: enable all; Additional context **none** (no locale/location needed); User confirmation **off** (all read-only).
9. **Testers**: add Bewo's @gmail.com; wait ≤10 min; test every example prompt with `@` and naturally.
10. **Send for review** → after approval **Publish**. Any later tool change = new version (Google recommends a new endpoint per version → `/v2/mcp`).

Policy notes this build already follows: descriptions are specific (no "best"/overly broad claims), no references to other tools/apps, server instructions only at initialize time (never inside tool results), no ads (only the own-brand `source` link), data minimisation (only the inputs each calculation needs), stateless HTTPS.

## Layout

```
src/index.ts            Worker router (/v1/mcp, /health, /, /.well-known)
src/server.ts           McpServer, instructions, tool schemas + annotations
src/tools/*.ts          pure, deterministic tool logic
src/data/               safe-zones.json, export-specs.ts (copied from the site repo)
test/                   vitest (tools.test.ts, http.test.ts)
scripts/smoke.mjs       live HTTP smoke test
assets/icon-512.png     Connected Console icon
PRIVACY.md, TERMS.md    source text of the live rastcreative.com policy pages
```
