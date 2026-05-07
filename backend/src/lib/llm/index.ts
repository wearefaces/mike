import { streamClaude, completeClaudeText } from "./claude";
import { streamGemini, completeGeminiText } from "./gemini";
import { streamOpenRouter, completeOpenRouterText } from "./openrouter";
import { streamCopilot, completeCopilotText } from "./copilot";
import { providerForModel } from "./models";
import type { StreamChatParams, StreamChatResult, UserApiKeys } from "./types";

export * from "./types";
export * from "./models";

export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const provider = providerForModel(params.model);
    if (provider === "claude") return streamClaude(params);
    if (provider === "openrouter") return streamOpenRouter(params);
    if (provider === "copilot") {
        if (!params.apiKeys?.copilotEnabled) {
            throw new Error("GitHub Copilot bridge is not enabled in settings");
        }
        return streamCopilot(params);
    }
    return streamGemini(params);
}

export async function completeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: UserApiKeys;
}): Promise<string> {
    const provider = providerForModel(params.model);
    if (provider === "claude") return completeClaudeText(params);
    if (provider === "openrouter") return completeOpenRouterText(params);
    if (provider === "copilot") {
        if (!params.apiKeys?.copilotEnabled) {
            throw new Error("GitHub Copilot bridge is not enabled in settings");
        }
        return completeCopilotText(params);
    }
    return completeGeminiText(params);
}
