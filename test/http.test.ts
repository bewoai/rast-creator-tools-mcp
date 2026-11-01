import { describe, it, expect } from "vitest";
import worker from "../src/index";

const MCP_HEADERS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" };
const rpc = (body: unknown, path = "/v1/mcp") => worker.fetch(new Request(`https://x.test${path}`, { method: "POST", headers: MCP_HEADERS, body: JSON.stringify(body) }), {});

describe("HTTP routes", () => {
  it("/health", async () => {
    const r = await worker.fetch(new Request("https://x.test/health"), {});
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).status).toBe("ok");
  });
  it("/ landing JSON", async () => {
    const r = await worker.fetch(new Request("https://x.test/"), {});
    const j = (await r.json()) as any;
    expect(j.mcp_endpoint).toBe("https://x.test/v1/mcp");
    expect(j.tools).toHaveLength(5);
  });
  it("GET /mcp is 405 (stateless)", async () => {
    const r = await worker.fetch(new Request("https://x.test/mcp"), {});
    expect(r.status).toBe(405);
  });
  it(".well-known token only when configured", async () => {
    const u = "https://x.test/.well-known/google-connected-apps";
    expect((await worker.fetch(new Request(u), {})).status).toBe(404);
    const r = await worker.fetch(new Request(u), { GOOGLE_CONNECTED_APPS_TOKEN: '{"token":"abc"}' });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('{"token":"abc"}');
  });
});

describe("MCP over Streamable HTTP", () => {
  it("initialize returns server info and instructions", async () => {
    const r = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
    expect(r.status).toBe(200);
    const j = (await r.json()) as any;
    expect(j.result.serverInfo.name).toBe("rast-creator-tools");
    expect(j.result.instructions).toMatch(/safe zones/);
    expect(r.headers.get("mcp-session-id")).toBeNull();
  });
  it("tools/list has 5 read-only tools", async () => {
    const r = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const j = (await r.json()) as any;
    const names = j.result.tools.map((t: any) => t.name).sort();
    expect(names).toEqual(["calculate_bitrate", "check_text_position", "export_settings", "get_safe_zone", "validate_srt"]);
    for (const t of j.result.tools) {
      expect(t.annotations.readOnlyHint).toBe(true);
      expect(t.annotations.destructiveHint).toBe(false);
      expect(t.inputSchema.type).toBe("object");
    }
  });
  it("tools/call get_safe_zone", async () => {
    const r = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_safe_zone", arguments: { platform: "tiktok" } } });
    const j = (await r.json()) as any;
    expect(j.result.structuredContent.unsafe_margins_px.bottom).toBe(480);
    expect(j.result.content[0].text).toContain("reels-safe-zone-checker");
  });
  it("/mcp alias answers too", async () => {
    const r = await rpc({ jsonrpc: "2.0", id: 9, method: "tools/list" }, "/mcp");
    expect(r.status).toBe(200);
  });
  it("invalid arguments return an error result, not a crash", async () => {
    const r = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_safe_zone", arguments: { platform: "snapchat" } } });
    const j = (await r.json()) as any;
    expect(j.result?.isError ?? !!j.error).toBe(true);
  });
});
