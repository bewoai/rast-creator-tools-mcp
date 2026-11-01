# Rast Creator Tools — remote MCP server

Free, no-auth remote **MCP server** with deterministic tools for short-form video creators: Reels / TikTok / Shorts safe zones, caption placement checks, video bitrate & file-size math, SRT subtitle validation and platform export settings. It exposes the free creator tools of [rastcreative.com/en/tools/](https://rastcreative.com/en/tools/) to AI assistants (Claude, ChatGPT, Gemini, Cursor, VS Code, …).

**Endpoint (Streamable HTTP):**

```
https://rast-creator-tools-mcp.studio-c25.workers.dev/v1/mcp
```

Health: <https://rast-creator-tools-mcp.studio-c25.workers.dev/health> · Privacy: <https://rastcreative.com/en/tools/creator-tools-mcp-privacy/> · Terms: <https://rastcreative.com/en/tools/creator-tools-mcp-terms/>

- No API key, no sign-up, no user data stored, no logging, no outbound requests.
- Stateless and deterministic; all tools are read-only (`readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`).
- Every result includes a `source` link to the matching rastcreative.com tool page.

## Tools

| Tool | What it does |
|---|---|
| `get_safe_zone` | Unsafe margins (px + %), safe rectangle and right-side button column for `reels`, `tiktok`, `shorts`, `story` or `all`, scaled to any frame size |
| `check_text_position` | Is a text box inside the safe zone? Which UI element covers it (top bar, caption area, buttons, edges, Reels comment sticker)? Nearest safe position |
| `calculate_bitrate` | File size from duration + bitrate, or the max bitrate that fits a size limit; reference bitrates per platform/resolution/fps; 2-pass ffmpeg command |
| `validate_srt` | SRT/WebVTT check: overlaps, gaps, ordering, reading speed (CPS), line length/count, durations, mojibake — optionally returns a fixed SRT |
| `export_settings` | Codec, container, resolution, fps, bitrate, colour and audio settings with official spec links for YouTube (SDR/HDR), Vimeo, Instagram Reels, TikTok and a ProRes master |

## Connect

**Claude (claude.ai / Desktop)** → Settings → Connectors → *Add custom connector* → paste the endpoint URL.

**ChatGPT** (developer mode) → Settings → Connectors → *Create* → endpoint URL, authentication *None*.

**Gemini Apps Developer Mode** → <https://gemini.google.com/devmode> → *Create new* → endpoint URL, authentication *none*.

**Cursor / VS Code / any client with remote MCP support:**

```json
{
  "mcpServers": {
    "rast-creator-tools": { "url": "https://rast-creator-tools-mcp.studio-c25.workers.dev/v1/mcp" }
  }
}
```

**stdio-only clients** (via [mcp-remote](https://www.npmjs.com/package/mcp-remote)):

```json
{
  "mcpServers": {
    "rast-creator-tools": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://rast-creator-tools-mcp.studio-c25.workers.dev/v1/mcp"]
    }
  }
}
```

## Example prompts

- What is the safe zone for a 1080x1920 TikTok video?
- Is a caption box at y = 1550 px on a 1080x1920 frame covered by the Reels interface?
- How big will a 3-minute 4K 30 fps YouTube export at 45 Mbps be?
- What bitrate do I need to keep a 90-second 1080p video under 100 MB?
- Check this SRT for overlaps, reading speed and broken characters: *(paste subtitles)*
- What export settings should I use for an HDR YouTube upload?

## Raw request

```bash
curl -s -X POST https://rast-creator-tools-mcp.studio-c25.workers.dev/v1/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_safe_zone","arguments":{"platform":"reels"}}}'
```

## Endpoints

| Path | Purpose |
|---|---|
| `POST /v1/mcp` (alias `/mcp`) | MCP JSON-RPC over Streamable HTTP, stateless (no `Mcp-Session-Id`), JSON responses. `GET` → 405 |
| `GET /health` | `{"status":"ok",...}` |
| `GET /` | Short landing JSON (endpoint, tools, data policy) |
| `GET /.well-known/google-connected-apps` | Domain-verification JSON for Google Connected Apps (404 until configured) |

## Develop & self-host

TypeScript, [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), Cloudflare Workers (free plan is enough).

```bash
npm install
npm test              # vitest (tools + HTTP/MCP round trips)
npm run typecheck
npm run dev           # wrangler dev → http://127.0.0.1:8787
npm run smoke         # health + initialize + tools/list + tools/call over real HTTP
npx wrangler deploy   # → https://rast-creator-tools-mcp.<your-subdomain>.workers.dev
```

```
src/index.ts      Worker router (/v1/mcp, /health, /, /.well-known)
src/server.ts     McpServer, instructions, tool schemas + annotations
src/tools/*.ts    pure, deterministic tool logic
src/data/         safe-zone and export-spec data (from rastcreative.com)
test/             vitest
docs/             Google Connected Apps registration notes
```

## More free tools

Browser versions of these tools and more: **[rastcreative.com/en/tools/](https://rastcreative.com/en/tools/)** — by [Rast Creative Studio](https://rastcreative.com).

## License

[MIT](LICENSE) © Rast Creative Studio
