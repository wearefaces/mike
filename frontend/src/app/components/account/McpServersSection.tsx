"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    listMcpServers,
    createMcpServer,
    updateMcpServer,
    deleteMcpServer,
    testMcpServer,
    type McpServer,
} from "@/app/lib/mikeApi";

export function McpServersSection() {
    const [servers, setServers] = useState<McpServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [authToken, setAuthToken] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [testResults, setTestResults] = useState<
        Record<string, { ok: boolean; tool_count: number; tools: string[] } | { error: string }>
    >({});
    const [testing, setTesting] = useState<Record<string, boolean>>({});
    const [error, setError] = useState("");

    async function refresh() {
        setLoading(true);
        try {
            const list = await listMcpServers();
            setServers(list);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, []);

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !url.trim()) return;
        setSubmitting(true);
        setError("");
        try {
            const created = await createMcpServer({
                name: name.trim(),
                url: url.trim(),
                auth_token: authToken.trim() || undefined,
            });
            setServers((s) => [created, ...s]);
            setName("");
            setUrl("");
            setAuthToken("");
            setAdding(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleToggle(srv: McpServer) {
        try {
            const updated = await updateMcpServer(srv.id, {
                enabled: !srv.enabled,
            });
            setServers((list) =>
                list.map((s) => (s.id === srv.id ? { ...s, ...updated } : s)),
            );
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function handleDelete(srv: McpServer) {
        if (!confirm(`Remove MCP server "${srv.name}"?`)) return;
        try {
            await deleteMcpServer(srv.id);
            setServers((list) => list.filter((s) => s.id !== srv.id));
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function handleTest(srv: McpServer) {
        setTesting((t) => ({ ...t, [srv.id]: true }));
        try {
            const res = await testMcpServer(srv.id);
            setTestResults((r) => ({
                ...r,
                [srv.id]: {
                    ok: res.ok,
                    tool_count: res.tool_count,
                    tools: res.tools.map((t) => t.name),
                },
            }));
        } catch (e) {
            setTestResults((r) => ({
                ...r,
                [srv.id]: { error: (e as Error).message },
            }));
        } finally {
            setTesting((t) => ({ ...t, [srv.id]: false }));
        }
    }

    return (
        <div className="py-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-medium font-serif">
                    MCP servers
                </h2>
                <Button
                    type="button"
                    onClick={() => setAdding((v) => !v)}
                    className="bg-black hover:bg-gray-900 text-white"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add server
                </Button>
            </div>
            <p className="text-sm text-gray-500 mb-4 max-w-2xl">
                Connect remote{" "}
                <a
                    href="https://modelcontextprotocol.io"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                >
                    Model Context Protocol
                </a>{" "}
                servers over HTTP/SSE. Their tools are exposed to the assistant
                as <code>mcp__&lt;id&gt;__&lt;tool&gt;</code>. Disabled servers
                are skipped.
            </p>

            {error && (
                <div className="mb-3 text-sm text-red-600">{error}</div>
            )}

            {adding && (
                <form
                    onSubmit={handleAdd}
                    className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3 max-w-2xl"
                >
                    <div>
                        <label className="text-xs text-gray-600 block mb-1">
                            Name
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Filesystem"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600 block mb-1">
                            URL (Streamable HTTP / SSE endpoint)
                        </label>
                        <Input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/mcp"
                            type="url"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600 block mb-1">
                            Bearer token (optional)
                        </label>
                        <Input
                            value={authToken}
                            onChange={(e) => setAuthToken(e.target.value)}
                            placeholder="leave empty if none"
                            type="password"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="bg-black hover:bg-gray-900 text-white"
                        >
                            {submitting ? "Saving…" : "Save"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setAdding(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-sm text-gray-500">Loading…</div>
            ) : servers.length === 0 ? (
                <div className="text-sm text-gray-500">
                    No MCP servers configured.
                </div>
            ) : (
                <div className="space-y-3 max-w-2xl">
                    {servers.map((srv) => {
                        const result = testResults[srv.id];
                        return (
                            <div
                                key={srv.id}
                                className="p-4 border border-gray-200 rounded-lg"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate">
                                            {srv.name}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {srv.url}
                                        </div>
                                        {srv.has_auth_token && (
                                            <div className="text-xs text-gray-400 mt-1">
                                                Bearer token configured
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleToggle(srv)}
                                            className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                                srv.enabled
                                                    ? "bg-black"
                                                    : "bg-gray-200"
                                            }`}
                                            role="switch"
                                            aria-checked={srv.enabled}
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                                    srv.enabled
                                                        ? "translate-x-5"
                                                        : "translate-x-0"
                                                }`}
                                            />
                                        </button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleTest(srv)}
                                            disabled={testing[srv.id]}
                                        >
                                            {testing[srv.id] ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3 w-3" />
                                            )}
                                            <span className="ml-1">Test</span>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(srv)}
                                        >
                                            <Trash2 className="h-3 w-3 text-red-600" />
                                        </Button>
                                    </div>
                                </div>
                                {result && (
                                    <div className="mt-3 text-xs">
                                        {"error" in result ? (
                                            <span className="text-red-600">
                                                {result.error}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600">
                                                {result.ok
                                                    ? `OK · ${result.tool_count} tools`
                                                    : "Failed"}
                                                {result.tools.length > 0 && (
                                                    <span className="text-gray-400">
                                                        {" "}
                                                        ·{" "}
                                                        {result.tools
                                                            .slice(0, 6)
                                                            .join(", ")}
                                                        {result.tools.length > 6
                                                            ? ", …"
                                                            : ""}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
