#!/usr/bin/env node
// Smoke test over real HTTP: node scripts/smoke.mjs [base-url]  (default http://127.0.0.1:8787)
const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
let id = 0;
async function rpc(method, params) {
  const res = await fetch(`${base}/v1/mcp`, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`${method}: HTTP ${res.status} ${JSON.stringify(body.error ?? body)}`);
  return body.result;
}
const health = await (await fetch(`${base}/health`)).json();
console.log("health:", JSON.stringify(health));
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } });
console.log("initialize:", init.serverInfo.name, init.serverInfo.version, "protocol", init.protocolVersion);
const list = await rpc("tools/list", {});
console.log("tools/list:", list.tools.map((t) => t.name).join(", "));
const call = await rpc("tools/call", { name: "check_text_position", arguments: { platform: "reels", x: 100, y: 1600, width: 700, height: 120 } });
console.log("tools/call check_text_position:", call.structuredContent.summary, "|", call.structuredContent.source);
const br = await rpc("tools/call", { name: "calculate_bitrate", arguments: { duration_seconds: 45, target_size_mb: 50 } });
console.log("tools/call calculate_bitrate:", br.structuredContent.max_video_bitrate_mbps, "Mbps max |", br.structuredContent.source);
console.log("OK");
