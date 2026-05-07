import { MODELS, type ModelOption } from "../components/assistant/ModelToggle";

export type ModelProvider = "claude" | "gemini" | "openrouter" | "copilot";

export type ApiKeysShape = {
    claudeApiKey: string | null;
    geminiApiKey: string | null;
    openrouterApiKey?: string | null;
    copilotEnabled?: boolean;
};

export function getModelProvider(modelId: string): ModelProvider | null {
    const model = MODELS.find((m) => m.id === modelId);
    if (!model) return null;
    if (model.group === "Anthropic") return "claude";
    if (model.group === "Google") return "gemini";
    if (model.group === "Copilot") return "copilot";
    return "openrouter";
}

function providerEnabled(
    provider: ModelProvider,
    apiKeys: ApiKeysShape,
): boolean {
    if (provider === "claude") return !!apiKeys.claudeApiKey?.trim();
    if (provider === "gemini") return !!apiKeys.geminiApiKey?.trim();
    if (provider === "openrouter") return !!apiKeys.openrouterApiKey?.trim();
    return !!apiKeys.copilotEnabled;
}

export function isModelAvailable(
    modelId: string,
    apiKeys: ApiKeysShape,
): boolean {
    const provider = getModelProvider(modelId);
    if (!provider) return false;
    return providerEnabled(provider, apiKeys);
}

export function isProviderAvailable(
    provider: ModelProvider,
    apiKeys: ApiKeysShape,
): boolean {
    return providerEnabled(provider, apiKeys);
}

export function providerLabel(provider: ModelProvider): string {
    if (provider === "claude") return "Anthropic (Claude)";
    if (provider === "gemini") return "Google (Gemini)";
    if (provider === "copilot") return "GitHub Copilot bridge";
    return "OpenRouter";
}

export function modelGroupToProvider(
    group: ModelOption["group"],
): ModelProvider {
    if (group === "Anthropic") return "claude";
    if (group === "Google") return "gemini";
    if (group === "Copilot") return "copilot";
    return "openrouter";
}
