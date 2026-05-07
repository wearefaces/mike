// Minimal MCP (Model Context Protocol) client over Streamable HTTP.
// Speaks the MCP 2025-03-26 / 2025-06-18 transport: a single HTTP endpoint
// that accepts JSON-RPC 2.0 POST bodies and answers with either
// application/json or text/event-stream. We do not implement the long-lived
// SSE GET channel — every request is one short POST.
//
// Local testing only. No retries, no notification stream, no resumability.

import type { OpenAIToolSchema } from "./llm/types";

export interface McpServerConfig {
    id: string;
    name: string;
    url: string;
    auth_token?: string | null;
}

interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: number | string;
    method: string;
    params?: unknown;
}

interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: number | string;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

interface McpTool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "mike-backend", version: "0.1.0" };

function authHeaders(token?: string | null): Record<string, string> {
    return token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {};
}

async function parseRpcResponse(res: Response): Promise<JsonRpcResponse> {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
        return (await res.json()) as JsonRpcResponse;
    }
    if (ct.includes("text/event-stream")) {
        const text = await res.text();
        // Pick the last `data:` line that parses as JSON-RPC.
        const lines = text
            .split(/\r?\n/)
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim());
        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const obj = JSON.parse(lines[i]);
                if (obj && obj.jsonrpc === "2.0") return obj as JsonRpcResponse;
            } catch {
                /* continue */
            }
        }
        throw new Error(`MCP SSE response had no JSON-RPC payload`);
    }
    const body = await res.text();
    throw new Error(
        `MCP unexpected content-type "${ct}" (status ${res.status}): ${body.slice(0, 200)}`,
    );
}

class McpSession {
    private nextId = 1;
    private sessionId: string | null = null;
    constructor(private readonly cfg: McpServerConfig) {}

    private async post(
        body: JsonRpcRequest | JsonRpcRequest[],
    ): Promise<{ res: Response; payload: JsonRpcResponse | null }> {
        const headers: Record<string, string> = {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": PROTOCOL_VERSION,
            ...authHeaders(this.cfg.auth_token),
        };
        if (this.sessionId) headers["mcp-session-id"] = this.sessionId;

        const res = await fetch(this.cfg.url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        // Capture session id from initialize response.
        const sid = res.headers.get("mcp-session-id");
        if (sid && !this.sessionId) this.sessionId = sid;

        if (res.status === 202 || res.status === 204) {
            // Notification accepted.
            return { res, payload: null };
        }
        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(
                `MCP HTTP ${res.status} from ${this.cfg.url}: ${txt.slice(0, 300)}`,
            );
        }
        const payload = await parseRpcResponse(res);
        return { res, payload };
    }

    async initialize(): Promise<void> {
        const { payload } = await this.post({
            jsonrpc: "2.0",
            id: this.nextId++,
            method: "initialize",
            params: {
                protocolVersion: PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: CLIENT_INFO,
            },
        });
        if (!payload || payload.error) {
            throw new Error(
                `MCP initialize failed: ${payload?.error?.message ?? "no response"}`,
            );
        }
        // Notify initialized (best-effort, ignore errors).
        try {
            await this.post({
                jsonrpc: "2.0",
                id: this.nextId++,
                method: "notifications/initialized",
            });
        } catch {
            /* ignore */
        }
    }

    async listTools(): Promise<McpTool[]> {
        const { payload } = await this.post({
            jsonrpc: "2.0",
            id: this.nextId++,
            method: "tools/list",
        });
        if (!payload || payload.error) {
            throw new Error(
                `MCP tools/list failed: ${payload?.error?.message ?? "no response"}`,
            );
        }
        const result = payload.result as { tools?: McpTool[] } | undefined;
        return result?.tools ?? [];
    }

    async callTool(
        name: string,
        args: Record<string, unknown>,
    ): Promise<string> {
        const { payload } = await this.post({
            jsonrpc: "2.0",
            id: this.nextId++,
            method: "tools/call",
            params: { name, arguments: args },
        });
        if (!payload) {
            return JSON.stringify({ error: "MCP returned no payload" });
        }
        if (payload.error) {
            return JSON.stringify({ error: payload.error.message });
        }
        const result = payload.result as
            | {
                  content?: Array<{ type: string; text?: string }>;
                  isError?: boolean;
              }
            | undefined;
        if (!result) return JSON.stringify({ error: "MCP empty result" });
        const textParts =
            result.content
                ?.filter((c) => c.type === "text" && typeof c.text === "string")
                .map((c) => c.text as string) ?? [];
        const combined = textParts.join("\n").trim();
        if (result.isError) {
            return JSON.stringify({
                error: combined || "MCP tool error",
            });
        }
        return combined || JSON.stringify(result);
    }
}

// Sanitize tool name to match OpenAI / Anthropic constraints
// (^[a-zA-Z0-9_-]{1,64}$).
function safeToolName(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

export interface LoadedMcpServer {
    config: McpServerConfig;
    session: McpSession;
    /** Map of fully-prefixed tool name -> original tool name on the server. */
    tools: Map<string, string>;
}

export interface McpRuntime {
    schemas: OpenAIToolSchema[];
    /** Returns null if the tool does not belong to MCP. */
    callTool(
        toolName: string,
        args: Record<string, unknown>,
    ): Promise<string | null>;
    serverCount: number;
    toolCount: number;
}

const TOOL_PREFIX = "mcp__";

/**
 * Initialize all enabled MCP servers for the user, list their tools, and
 * return an OpenAI-compatible tool schema list plus a router that executes
 * tool calls against the right server. Failures on a single server are
 * logged but do not abort the others.
 */
export async function loadMcpRuntime(
    servers: McpServerConfig[],
): Promise<McpRuntime> {
    const loaded: LoadedMcpServer[] = [];
    const schemas: OpenAIToolSchema[] = [];

    await Promise.all(
        servers.map(async (cfg) => {
            try {
                const session = new McpSession(cfg);
                await session.initialize();
                const tools = await session.listTools();
                const toolMap = new Map<string, string>();
                const shortId = safeToolName(cfg.id.split("-")[0] ?? "srv");
                for (const t of tools) {
                    const prefixed = `${TOOL_PREFIX}${shortId}__${safeToolName(t.name)}`;
                    toolMap.set(prefixed, t.name);
                    schemas.push({
                        type: "function",
                        function: {
                            name: prefixed,
                            description: `[MCP:${cfg.name}] ${t.description ?? t.name}`.slice(
                                0,
                                1000,
                            ),
                            parameters:
                                (t.inputSchema as Record<string, unknown>) ?? {
                                    type: "object",
                                    properties: {},
                                },
                        },
                    });
                }
                loaded.push({ config: cfg, session, tools: toolMap });
                console.log(
                    `[mcp] loaded "${cfg.name}" (${tools.length} tools)`,
                );
            } catch (e) {
                console.error(
                    `[mcp] failed to load "${cfg.name}" (${cfg.url}):`,
                    (e as Error).message,
                );
            }
        }),
    );

    const totalTools = schemas.length;

    return {
        schemas,
        serverCount: loaded.length,
        toolCount: totalTools,
        async callTool(toolName, args) {
            if (!toolName.startsWith(TOOL_PREFIX)) return null;
            for (const srv of loaded) {
                const original = srv.tools.get(toolName);
                if (original) {
                    try {
                        return await srv.session.callTool(original, args);
                    } catch (e) {
                        return JSON.stringify({
                            error: `MCP call failed: ${(e as Error).message}`,
                        });
                    }
                }
            }
            return JSON.stringify({ error: `MCP tool not found: ${toolName}` });
        },
    };
}

export function isMcpToolName(name: string): boolean {
    return name.startsWith(TOOL_PREFIX);
}
