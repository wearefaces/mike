import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
} from "./types";

// GitHub Copilot provider — talks to a local OpenAI-compatible bridge such as
// https://github.com/ericc-ch/copilot-api. The bridge handles GitHub OAuth
// and exposes /v1/chat/completions on COPILOT_BRIDGE_URL (default
// http://localhost:4141).
//
// FOR LOCAL TESTING ONLY with the developer's personal Copilot subscription.
// Do not deploy this to production.

const DEFAULT_COPILOT_URL = "http://localhost:4141/v1/chat/completions";
const COPILOT_URL =
    process.env.COPILOT_BRIDGE_URL?.trim() || DEFAULT_COPILOT_URL;
const MAX_TOKENS = 16384;

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

function stripPrefix(model: string): string {
    return model.startsWith("copilot/")
        ? model.slice("copilot/".length)
        : model;
}

function toOpenAIMessages(
    messages: StreamChatParams["messages"],
): OpenAIMessage[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function callBridge(body: Record<string, unknown>): Promise<{
    choices?: { message?: OpenAIMessage; finish_reason?: string }[];
}> {
    const resp = await fetch(COPILOT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // Some bridges accept any token; provide a placeholder so they
            // don't reject the request outright.
            Authorization: `Bearer ${process.env.COPILOT_BRIDGE_TOKEN ?? "local"}`,
        },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Copilot bridge ${resp.status}: ${text}`);
    }
    return resp.json() as Promise<{
        choices?: { message?: OpenAIMessage; finish_reason?: string }[];
    }>;
}

export async function streamCopilot(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const { model, systemPrompt, tools = [], callbacks = {}, runTools } = params;
    const maxIter = params.maxIterations ?? 10;

    const messages: OpenAIMessage[] = [
        { role: "system", content: systemPrompt },
        ...toOpenAIMessages(params.messages),
    ];
    let fullText = "";

    for (let iter = 0; iter < maxIter; iter++) {
        const json = await callBridge({
            model: stripPrefix(model),
            messages,
            max_tokens: MAX_TOKENS,
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? "auto" : undefined,
        });
        const msg = json.choices?.[0]?.message;
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
                    ? (JSON.parse(tc.function.arguments) as Record<
                          string,
                          unknown
                      >)
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

        if (!toolCalls.length || !runTools) break;

        const results = await runTools(toolCalls);
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

export async function completeCopilotText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
}): Promise<string> {
    const messages: OpenAIMessage[] = [];
    if (params.systemPrompt)
        messages.push({ role: "system", content: params.systemPrompt });
    messages.push({ role: "user", content: params.user });

    const json = await callBridge({
        model: stripPrefix(params.model),
        messages,
        max_tokens: params.maxTokens ?? 512,
    });
    return json.choices?.[0]?.message?.content ?? "";
}
