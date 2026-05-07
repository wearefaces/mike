import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
} from "./types";

// OpenRouter speaks the OpenAI Chat Completions API. We use raw fetch (no SDK)
// to avoid pulling in the openai package and to match the existing
// claude/gemini provider style.
//
// `OPENROUTER_BASE_URL` lets us point this provider at any OpenAI-compatible
// /chat/completions endpoint (e.g. the local copilot-bridge for dev/testing).

const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_URL = process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_URL;
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS) || 2048;

type OpenAIToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
};

type OpenAIMessage = {
    role: "system" | "user" | "assistant" | "tool";
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    name?: string;
};

function getApiKey(override?: string | null): string {
    return (override?.trim() || process.env.OPENROUTER_API_KEY || "").trim();
}

// When pointing at a custom OpenAI-compatible endpoint (e.g. the local
// copilot-bridge), an API key may not be required.
function isCustomEndpoint(): boolean {
    return !!process.env.OPENROUTER_BASE_URL?.trim();
}

function stripPrefix(model: string): string {
    let out = model.startsWith("openrouter/") ? model.slice("openrouter/".length) : model;
    // For non-OpenRouter OpenAI-compatible endpoints (e.g. the local
    // copilot-bridge), drop the leading "<vendor>/" segment so the slug
    // matches what those backends expect (e.g. "openai/gpt-4o" -> "gpt-4o").
    if (isCustomEndpoint() && out.includes("/")) {
        out = out.slice(out.indexOf("/") + 1);
    }
    return out;
}

function toOpenAIMessages(
    messages: StreamChatParams["messages"],
): OpenAIMessage[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function streamOpenRouter(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const {
        model,
        systemPrompt,
        tools = [],
        callbacks = {},
        runTools,
        apiKeys,
    } = params;
    const maxIter = params.maxIterations ?? 10;
    const apiKey = getApiKey(apiKeys?.openrouter);
    if (!apiKey && !isCustomEndpoint()) {
        throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const messages: OpenAIMessage[] = [
        { role: "system", content: systemPrompt },
        ...toOpenAIMessages(params.messages),
    ];
    let fullText = "";

    for (let iter = 0; iter < maxIter; iter++) {
        const body = {
            model: stripPrefix(model),
            messages,
            max_tokens: MAX_TOKENS,
            tools: tools.length ? tools : undefined,
        };

        const resp = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                // Optional but recommended by OpenRouter for analytics.
                "HTTP-Referer": process.env.FRONTEND_URL ?? "http://localhost:3000",
                "X-Title": "Mike",
            },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`OpenRouter ${resp.status}: ${text}`);
        }

        const json = (await resp.json()) as {
            choices?: { message?: OpenAIMessage; finish_reason?: string }[];
        };
        const choice = json.choices?.[0];
        const msg = choice?.message;
        if (!msg) break;

        if (msg.content) {
            fullText += msg.content;
            callbacks.onContentDelta?.(msg.content);
        }

        const toolCalls: NormalizedToolCall[] = [];
        for (const tc of msg.tool_calls ?? []) {
            let input: Record<string, unknown> = {};
            try {
                input = tc.function.arguments
                    ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
                    : {};
            } catch {
                input = { _raw: tc.function.arguments };
            }
            const call: NormalizedToolCall = {
                id: tc.id,
                name: tc.function.name,
                input,
            };
            callbacks.onToolCallStart?.(call);
            toolCalls.push(call);
        }

        if (!toolCalls.length || !runTools) {
            break;
        }

        const results = await runTools(toolCalls);

        // Replay assistant turn (with tool_calls) and tool turns.
        messages.push({
            role: "assistant",
            content: msg.content ?? "",
            tool_calls: msg.tool_calls,
        });
        for (const r of results) {
            messages.push({
                role: "tool",
                tool_call_id: r.tool_use_id,
                content: r.content,
            });
        }
    }

    return { fullText };
}

export async function completeOpenRouterText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: { openrouter?: string | null };
}): Promise<string> {
    const apiKey = getApiKey(params.apiKeys?.openrouter);
    if (!apiKey && !isCustomEndpoint()) {
        throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const messages: OpenAIMessage[] = [];
    if (params.systemPrompt)
        messages.push({ role: "system", content: params.systemPrompt });
    messages.push({ role: "user", content: params.user });

    const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL ?? "http://localhost:3000",
            "X-Title": "Mike",
        },
        body: JSON.stringify({
            model: stripPrefix(params.model),
            messages,
            max_tokens: params.maxTokens ?? 512,
        }),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenRouter ${resp.status}: ${text}`);
    }
    const json = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? "";
}
