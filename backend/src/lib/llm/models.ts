import type { Provider } from "./types";

// ---------------------------------------------------------------------------
// Canonical model IDs
// ---------------------------------------------------------------------------
// Main-chat tier (top-end) — user picks one of these per message.
export const CLAUDE_MAIN_MODELS = ["claude-opus-4-7", "claude-sonnet-4-6"] as const;
export const GEMINI_MAIN_MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
] as const;

// OpenRouter models — prefixed with "openrouter/" so providerForModel can
// route them. Anything after the prefix is the OpenRouter model slug
// (https://openrouter.ai/models). Add entries here to expose them in the UI.
export const OPENROUTER_MAIN_MODELS = [
    "openrouter/openai/gpt-5",
    "openrouter/openai/gpt-4o",
    "openrouter/x-ai/grok-2",
    "openrouter/meta-llama/llama-3.3-70b-instruct",
    "openrouter/deepseek/deepseek-chat",
    "openrouter/mistralai/mistral-large",
] as const;

// GitHub Copilot models — routed through a local OpenAI-compatible bridge
// (e.g. copilot-api on http://localhost:4141). For local testing only.
export const COPILOT_MAIN_MODELS = [
    "copilot/gpt-4.1",
    "copilot/gpt-4o",
    "copilot/gpt-4o-mini",
    "copilot/claude-sonnet-4.6",
    "copilot/claude-opus-4.7",
    "copilot/gemini-3.1-pro-preview",
] as const;

// Mid-tier (used for tabular review) — user picks one in account settings.
export const CLAUDE_MID_MODELS = ["claude-sonnet-4-6"] as const;
export const GEMINI_MID_MODELS = ["gemini-3-flash-preview"] as const;

// Low-tier (used for title generation, lightweight extractions) — user picks
// one in account settings.
export const CLAUDE_LOW_MODELS = ["claude-haiku-4-5"] as const;
export const GEMINI_LOW_MODELS = ["gemini-3.1-flash-lite-preview"] as const;

export const DEFAULT_MAIN_MODEL = "gemini-3-flash-preview";
export const DEFAULT_TITLE_MODEL = "gemini-3.1-flash-lite-preview";
export const DEFAULT_TABULAR_MODEL = "gemini-3-flash-preview";

const ALL_MODELS = new Set<string>([
    ...CLAUDE_MAIN_MODELS,
    ...GEMINI_MAIN_MODELS,
    ...OPENROUTER_MAIN_MODELS,
    ...COPILOT_MAIN_MODELS,
    ...CLAUDE_MID_MODELS,
    ...GEMINI_MID_MODELS,
    ...CLAUDE_LOW_MODELS,
    ...GEMINI_LOW_MODELS,
]);

// ---------------------------------------------------------------------------
// Provider inference
// ---------------------------------------------------------------------------

export function providerForModel(model: string): Provider {
    if (model.startsWith("copilot/")) return "copilot";
    if (model.startsWith("openrouter/")) return "openrouter";
    if (model.startsWith("claude")) return "claude";
    if (model.startsWith("gemini")) return "gemini";
    throw new Error(`Unknown model id: ${model}`);
}

export function resolveModel(id: string | null | undefined, fallback: string): string {
    if (id && ALL_MODELS.has(id)) return id;
    return fallback;
}
