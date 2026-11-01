/**
 * Cloudflare Worker entry: stateless MCP over Streamable HTTP at /v1/mcp (alias /mcp).
 * A fresh McpServer + transport is created per request (no sessions, nothing stored).
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server";
import { SOURCES } from "./tools/common";

export interface Env {
  /** Public challenge token for https://<domain>/.well-known/google-connected-apps (set in wrangler vars when Google issues it). */
  GOOGLE_CONNECTED_APPS_TOKEN?: string;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra } });

const withCors = (res: Response) => {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    // Stateless server: no standalone SSE stream and no sessions to delete.
    return json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Send JSON-RPC requests with POST." }, id: null }, 405, { Allow: "POST, OPTIONS" });
  }
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    // JSON responses are fully built before handleRequest resolves
    void server.close();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    switch (url.pathname) {
      case "/v1/mcp":
      case "/mcp":
      case "/mcp/":
        return handleMcp(request);
      case "/health":
        return json({ status: "ok", name: SERVER_NAME, version: SERVER_VERSION });
      case "/.well-known/google-connected-apps":
        if (!env.GOOGLE_CONNECTED_APPS_TOKEN) return json({ error: "not configured" }, 404);
        // Google expects the challenge JSON served as-is with 200 and no redirect.
        return new Response(env.GOOGLE_CONNECTED_APPS_TOKEN, { status: 200, headers: { "Content-Type": "application/json" } });
      case "/":
        return json({
          name: "Rast Creator Tools",
          description: "Free, stateless MCP server with short-form video tools by Rast Creative Studio: safe zones, text position check, bitrate/file size, SRT check, export settings.",
          mcp_endpoint: `${url.origin}/v1/mcp`,
          transport: "Streamable HTTP (stateless, JSON responses)",
          auth: "none",
          tools: ["get_safe_zone", "check_text_position", "calculate_bitrate", "validate_srt", "export_settings"],
          data_policy: "Inputs are processed only to build the response. Nothing is stored or logged by the app.",
          website: SOURCES.tools,
          version: SERVER_VERSION,
        });
      default:
        return json({ error: "Not found", see: "/" }, 404);
    }
  },
};
