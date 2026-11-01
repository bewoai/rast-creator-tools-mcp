# Google Connected Apps registration notes

Prerequisites (owner's Google login): apply for the preview via the interest form; an account admin accepts the Connected Apps ToS; testers must be **@gmail.com** accounts.

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
9. **Testers**: add the tester @gmail.com accounts; wait ≤10 min; test every example prompt with `@` and naturally.
10. **Send for review** → after approval **Publish**. Any later tool change = new version (Google recommends a new endpoint per version → `/v2/mcp`).

Policy notes this build already follows: descriptions are specific (no "best"/overly broad claims), no references to other tools/apps, server instructions only at initialize time (never inside tool results), no ads (only the own-brand `source` link), data minimisation (only the inputs each calculation needs), stateless HTTPS.
