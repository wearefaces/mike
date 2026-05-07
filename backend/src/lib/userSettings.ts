import { createServerSupabase } from "./supabase";
import {
    resolveModel,
    DEFAULT_TITLE_MODEL,
    DEFAULT_TABULAR_MODEL,
    type UserApiKeys,
} from "./llm";

export type UserModelSettings = {
    title_model: string;
    tabular_model: string;
    api_keys: UserApiKeys;
};

// Title generation is a lightweight task — always routed to the cheapest model
// of whichever provider the user has keys for: Gemini Flash Lite if Gemini is
// available, otherwise Claude Haiku. With no user keys set, defaults to Gemini
// (the dev-mode env fallback).
function resolveTitleModel(apiKeys: UserApiKeys): string {
    if (apiKeys.gemini?.trim()) return DEFAULT_TITLE_MODEL;
    if (apiKeys.claude?.trim()) return "claude-haiku-4-5";
    if (apiKeys.openrouter?.trim()) return "openrouter/openai/gpt-4o-mini";
    if (apiKeys.copilotEnabled) return "copilot/gpt-4o-mini";
    return DEFAULT_TITLE_MODEL;
}

async function selectProfileWithKeys(
    client: ReturnType<typeof createServerSupabase>,
    userId: string,
    extraColumns: string,
): Promise<Record<string, unknown> | null> {
    // Tries to include openrouter_api_key/copilot_enabled if those columns
    // exist; falls back to the legacy schema gracefully so old DBs keep
    // working.
    const full = await client
        .from("user_profiles")
        .select(
            `${extraColumns}, claude_api_key, gemini_api_key, openrouter_api_key, copilot_enabled`,
        )
        .eq("user_id", userId)
        .single();
    if (!full.error) {
        return full.data as Record<string, unknown>;
    }
    const noCopilot = await client
        .from("user_profiles")
        .select(`${extraColumns}, claude_api_key, gemini_api_key, openrouter_api_key`)
        .eq("user_id", userId)
        .single();
    if (!noCopilot.error) {
        return noCopilot.data as Record<string, unknown>;
    }
    const { data } = await client
        .from("user_profiles")
        .select(`${extraColumns}, claude_api_key, gemini_api_key`)
        .eq("user_id", userId)
        .single();
    return (data as Record<string, unknown>) ?? null;
}

export async function getUserModelSettings(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
): Promise<UserModelSettings> {
    const client = db ?? createServerSupabase();
    const data = await selectProfileWithKeys(client, userId, "tabular_model");

    const api_keys: UserApiKeys = {
        claude: (data?.claude_api_key as string | null) ?? null,
        gemini: (data?.gemini_api_key as string | null) ?? null,
        openrouter: (data?.openrouter_api_key as string | null) ?? null,
        copilotEnabled: Boolean(data?.copilot_enabled),
    };

    return {
        title_model: resolveTitleModel(api_keys),
        tabular_model: resolveModel(
            (data?.tabular_model as string | null) ?? null,
            DEFAULT_TABULAR_MODEL,
        ),
        api_keys,
    };
}

export async function getUserApiKeys(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
): Promise<UserApiKeys> {
    const client = db ?? createServerSupabase();
    const data = await selectProfileWithKeys(client, userId, "user_id");
    return {
        claude: (data?.claude_api_key as string | null) ?? null,
        gemini: (data?.gemini_api_key as string | null) ?? null,
        openrouter: (data?.openrouter_api_key as string | null) ?? null,
        copilotEnabled: Boolean(data?.copilot_enabled),
    };
}
