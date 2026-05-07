import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { loadMcpRuntime, type McpServerConfig } from "../lib/mcp";

export const mcpRouter = Router();

mcpRouter.get("/", requireAuth, async (_req, res) => {
    const userId = res.locals.userId as string;
    const db = createServerSupabase();
    const { data, error } = await db
        .from("user_mcp_servers")
        .select("id, name, url, enabled, auth_token, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) {
        console.error("[GET /mcp-servers]", error);
        return void res.status(500).json({ detail: error.message });
    }
    // Mask the token so we never send it back to the browser.
    const safe = (data ?? []).map((r) => ({
        ...r,
        has_auth_token: !!r.auth_token,
        auth_token: undefined,
    }));
    res.json(safe);
});

mcpRouter.post("/", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const { name, url, auth_token, enabled } = req.body as {
        name?: string;
        url?: string;
        auth_token?: string | null;
        enabled?: boolean;
    };
    if (!name?.trim() || !url?.trim()) {
        return void res
            .status(400)
            .json({ detail: "name and url are required" });
    }
    try {
        new URL(url);
    } catch {
        return void res.status(400).json({ detail: "url is not a valid URL" });
    }
    const db = createServerSupabase();
    const { data, error } = await db
        .from("user_mcp_servers")
        .insert({
            user_id: userId,
            name: name.trim(),
            url: url.trim(),
            auth_token: auth_token?.trim() || null,
            enabled: enabled ?? true,
        })
        .select("id, name, url, enabled, created_at")
        .single();
    if (error) {
        console.error("[POST /mcp-servers]", error);
        return void res.status(500).json({ detail: error.message });
    }
    res.status(201).json({ ...data, has_auth_token: !!auth_token });
});

mcpRouter.patch("/:id", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const id = req.params.id;
    const patch = req.body as {
        name?: string;
        url?: string;
        auth_token?: string | null;
        enabled?: boolean;
    };
    const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };
    if (typeof patch.name === "string") update.name = patch.name.trim();
    if (typeof patch.url === "string") update.url = patch.url.trim();
    if (typeof patch.enabled === "boolean") update.enabled = patch.enabled;
    if (patch.auth_token !== undefined) {
        update.auth_token = patch.auth_token?.trim() || null;
    }
    const db = createServerSupabase();
    const { data, error } = await db
        .from("user_mcp_servers")
        .update(update)
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, name, url, enabled, created_at")
        .single();
    if (error) {
        console.error("[PATCH /mcp-servers]", error);
        return void res.status(500).json({ detail: error.message });
    }
    res.json(data);
});

mcpRouter.delete("/:id", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const id = req.params.id;
    const db = createServerSupabase();
    const { error } = await db
        .from("user_mcp_servers")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
    if (error) {
        console.error("[DELETE /mcp-servers]", error);
        return void res.status(500).json({ detail: error.message });
    }
    res.json({ ok: true });
});

// Test connection — initialize + list tools.
mcpRouter.post("/:id/test", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const id = req.params.id;
    const db = createServerSupabase();
    const { data, error } = await db
        .from("user_mcp_servers")
        .select("id, name, url, auth_token")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
    if (error || !data) {
        return void res.status(404).json({ detail: "not found" });
    }
    const cfg: McpServerConfig = {
        id: data.id,
        name: data.name,
        url: data.url,
        auth_token: data.auth_token,
    };
    const runtime = await loadMcpRuntime([cfg]);
    res.json({
        ok: runtime.serverCount > 0,
        tool_count: runtime.toolCount,
        tools: runtime.schemas.map((s) => ({
            name: s.function.name,
            description: s.function.description,
        })),
    });
});

// Helper used by chat route — lists enabled servers for a user.
export async function listEnabledMcpServers(
    userId: string,
): Promise<McpServerConfig[]> {
    const db = createServerSupabase();
    const { data, error } = await db
        .from("user_mcp_servers")
        .select("id, name, url, auth_token")
        .eq("user_id", userId)
        .eq("enabled", true);
    if (error) {
        console.error("[listEnabledMcpServers]", error);
        return [];
    }
    return (data ?? []) as McpServerConfig[];
}
