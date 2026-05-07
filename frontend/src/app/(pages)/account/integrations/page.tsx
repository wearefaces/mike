"use client";

import { useMemo, useState } from "react";
import {
    Boxes,
    BrainCircuit,
    Bot,
    Check,
    ChevronDown,
    Code2,
    Copy,
    Database,
    ExternalLink,
    Plug,
    Sparkles,
    Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Tabs definition
// ---------------------------------------------------------------------------

type TabId = "framework" | "direct" | "orm" | "mcp";

interface TabDef {
    id: TabId;
    label: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
    {
        id: "framework",
        label: "Framework",
        sub: "Use a client library",
        icon: Code2,
    },
    {
        id: "direct",
        label: "Direct",
        sub: "REST endpoint",
        icon: Database,
    },
    {
        id: "orm",
        label: "Webhooks",
        sub: "Third-party automation",
        icon: Boxes,
    },
    {
        id: "mcp",
        label: "MCP",
        sub: "Connect your agent",
        icon: Sparkles,
    },
];

// ---------------------------------------------------------------------------
// Per-tab configuration
// ---------------------------------------------------------------------------

interface ClientOption {
    id: string;
    label: string;
}

interface Step {
    title: string;
    description: string;
    code: string;
}

interface TabConfig {
    clients: ClientOption[];
    promptHint: string;
    steps: Step[];
}

const FRAMEWORK_CONFIG: TabConfig = {
    clients: [
        { id: "ts", label: "TypeScript / JavaScript" },
        { id: "py", label: "Python" },
        { id: "go", label: "Go" },
    ],
    promptHint:
        "Install the Mike client SDK and run a workflow programmatically.",
    steps: [
        {
            title: "Install the SDK",
            description:
                "Add the Mike client to your project using your package manager.",
            code: "npm install @mike/client",
        },
        {
            title: "Authenticate",
            description: "Provide your Mike API key as an environment variable.",
            code: "export MIKE_API_KEY=mike_sk_…",
        },
        {
            title: "Run a workflow",
            description:
                "Call run() on a workflow id with the documents you want processed.",
            code: `import { Mike } from "@mike/client";\nconst mike = new Mike({ apiKey: process.env.MIKE_API_KEY });\nawait mike.workflows.run("<workflow-id>", { documentIds: ["<doc-id>"] });`,
        },
    ],
};

const DIRECT_CONFIG: TabConfig = {
    clients: [
        { id: "curl", label: "cURL" },
        { id: "fetch", label: "fetch" },
        { id: "httpie", label: "HTTPie" },
    ],
    promptHint:
        "Hit the Mike REST API directly from any HTTP-capable runtime.",
    steps: [
        {
            title: "Get your API key",
            description:
                "Generate a personal API key in your account settings.",
            code: "https://app.mike.ai/account/api-keys",
        },
        {
            title: "Call the run endpoint",
            description: "POST to /v1/workflows/:id/run with your document ids.",
            code: `curl -X POST https://api.mike.ai/v1/workflows/<id>/run \\\n  -H "Authorization: Bearer $MIKE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"document_ids": ["<doc-id>"]}'`,
        },
    ],
};

const ORM_CONFIG: TabConfig = {
    clients: [
        { id: "n8n", label: "n8n" },
        { id: "make", label: "Make" },
        { id: "zapier", label: "Zapier" },
    ],
    promptHint:
        "Trigger an external automation when workflows or rules change.",
    steps: [
        {
            title: "Add a webhook destination",
            description: "Register the URL where Mike should POST events.",
            code: "https://hooks.n8n.cloud/webhook/<your-id>",
        },
        {
            title: "Choose events",
            description:
                "Subscribe to workflow.updated, rule.flagged or review.completed.",
            code: `events: ["workflow.updated", "rule.flagged"]`,
        },
        {
            title: "Verify payload",
            description:
                "Mike signs every request — verify the X-Mike-Signature header.",
            code: `X-Mike-Signature: sha256=<hex-digest>`,
        },
    ],
};

const MCP_CONFIG: TabConfig = {
    clients: [
        { id: "claude", label: "Claude Code" },
        { id: "cursor", label: "Cursor" },
        { id: "vscode", label: "VS Code (GitHub Copilot)" },
        { id: "custom", label: "Other MCP client" },
    ],
    promptHint: "Give your agent everything it needs",
    steps: [
        {
            title: "Add MCP server",
            description:
                "Register the Mike MCP server in your project config from the command line.",
            code: 'claude mcp add --scope project --transport http mike "https://mcp.mike.ai/v1"',
        },
        {
            title: "Authenticate",
            description:
                "After configuring the MCP server, you need to authenticate. In a regular terminal (not the IDE extension) run:",
            code: "claude /mcp",
        },
        {
            title: "Install Agent Skills (Optional)",
            description:
                "Agent Skills give AI coding tools ready-made instructions, scripts and resources for working with Mike workflows more accurately.",
            code: "npx skills add mike/agent-skills",
        },
    ],
};

const TAB_CONFIG: Record<TabId, TabConfig> = {
    framework: FRAMEWORK_CONFIG,
    direct: DIRECT_CONFIG,
    orm: ORM_CONFIG,
    mcp: MCP_CONFIG,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
    const [activeTab, setActiveTab] = useState<TabId>("mcp");
    const cfg = TAB_CONFIG[activeTab];
    const [client, setClient] = useState<string>(cfg.clients[0].id);
    const [readOnly, setReadOnly] = useState(false);
    const [promptCopied, setPromptCopied] = useState(false);

    // Reset client whenever tab changes
    const clientLabel = useMemo(
        () => cfg.clients.find((c) => c.id === client)?.label ?? cfg.clients[0].label,
        [cfg, client],
    );

    function handleSelectTab(id: TabId) {
        setActiveTab(id);
        setClient(TAB_CONFIG[id].clients[0].id);
    }

    function copyPrompt() {
        const text = [
            `# Mike — ${clientLabel} setup`,
            "",
            ...cfg.steps.flatMap((s) => [
                `## ${s.title}`,
                s.description,
                "```",
                s.code,
                "```",
                "",
            ]),
        ].join("\n");
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setPromptCopied(true);
                setTimeout(() => setPromptCopied(false), 2000);
            })
            .catch(() => {});
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-medium font-serif">
                    Connect to your workflows
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Choose how you want to use Mike from outside the app.
                </p>
            </div>

            {/* Tab selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-gray-200 overflow-hidden bg-white">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleSelectTab(tab.id)}
                            className={`flex flex-col items-center justify-center gap-1 px-4 py-4 border-r last:border-r-0 border-gray-200 transition-colors ${
                                active
                                    ? "bg-gray-100 text-gray-900"
                                    : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                {tab.label}
                            </span>
                            <span className="text-[11px] text-gray-400">
                                {tab.sub}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Options block */}
            <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                <OptionRow label="Client">
                    <ClientDropdown
                        value={client}
                        options={cfg.clients}
                        onChange={setClient}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Choose the {activeTab === "mcp" ? "MCP" : ""} client you
                        are using.
                    </p>
                </OptionRow>

                {activeTab === "mcp" && (
                    <OptionRow label="Read-only">
                        <Toggle on={readOnly} onToggle={() => setReadOnly((v) => !v)} />
                        <p className="mt-1 text-xs text-gray-500">
                            Only allow read operations against your workflows.
                        </p>
                    </OptionRow>
                )}

                <OptionRow label="Feature groups">
                    <div className="relative">
                        <select
                            disabled
                            className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm text-gray-600 cursor-not-allowed"
                        >
                            <option>
                                All workflows enabled by default
                            </option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        Limit the tools exposed to the agent. Helps keep within
                        client tool limits.
                    </p>
                </OptionRow>
            </div>

            {/* Connect your app */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Connect your app
                </h3>

                <div className="rounded-lg border border-gray-200 bg-white">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Plug className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-700">
                                {cfg.promptHint}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={copyPrompt}
                            className="h-7 text-xs"
                        >
                            {promptCopied ? (
                                <>
                                    <Check className="h-3 w-3 text-green-600" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="h-3 w-3" />
                                    Copy prompt
                                </>
                            )}
                        </Button>
                    </div>

                    <ol className="divide-y divide-gray-100">
                        {cfg.steps.map((step, i) => (
                            <StepRow key={i} index={i + 1} step={step} />
                        ))}
                    </ol>
                </div>
            </div>

            {/* Pre-built integrations (Webhooks tab only) */}
            {activeTab === "orm" && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        Pre-built integrations
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Deploy your workflows to AI agent platforms and
                        automation tools.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {WEBHOOK_INTEGRATIONS.map((integration) => (
                            <IntegrationCard
                                key={integration.id}
                                integration={integration}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Pre-built integration cards
// ---------------------------------------------------------------------------

interface PrebuiltIntegration {
    id: string;
    name: string;
    badge: string;
    description: string;
    features: string[];
    docsUrl: string;
    icon: React.ComponentType<{ className?: string }>;
}

const WEBHOOK_INTEGRATIONS: PrebuiltIntegration[] = [
    {
        id: "azure-ai-foundry",
        name: "Azure AI Foundry",
        badge: "AI",
        description:
            "Deploy knowledge as retrieval tools to AI Foundry agents.",
        features: [
            "Auto-sync on approve",
            "Vector index per domain",
            "Agent tool manifest",
        ],
        docsUrl:
            "https://learn.microsoft.com/azure/ai-studio/concepts/connections",
        icon: BrainCircuit,
    },
    {
        id: "m365-agents",
        name: "M365 Agents",
        badge: "M3",
        description:
            "Expose knowledge as Copilot plugin or Teams extension.",
        features: [
            "Copilot plugin manifest",
            "Teams message extension",
            "SharePoint sync",
        ],
        docsUrl:
            "https://learn.microsoft.com/microsoft-365-copilot/extensibility/",
        icon: Bot,
    },
    {
        id: "mcp-server",
        name: "MCP Server",
        badge: "MC",
        description:
            "Model Context Protocol \u2014 any MCP-compatible agent.",
        features: [
            "search_rules, get_rule, flag_uncertainty",
            "SSE streaming",
            "OpenAPI export",
        ],
        docsUrl: "https://modelcontextprotocol.io",
        icon: Plug,
    },
    {
        id: "n8n-make",
        name: "n8n / Make",
        badge: "n8",
        description:
            "Webhook triggers when rules are added, updated or flagged.",
        features: [
            "Webhook on rule change",
            "Trigger on agent flag",
            "Full JSON payload",
        ],
        docsUrl: "https://n8n.io",
        icon: Webhook,
    },
];

function IntegrationCard({
    integration,
}: {
    integration: PrebuiltIntegration;
}) {
    const [connected, setConnected] = useState(false);
    const Icon = integration.icon;
    return (
        <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gray-100 text-gray-700 shrink-0">
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {integration.badge}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900">
                            {integration.name}
                        </h4>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                        {integration.description}
                    </p>
                </div>
            </div>

            <ul className="mt-3 space-y-1">
                {integration.features.map((feature) => (
                    <li
                        key={feature}
                        className="flex items-center gap-1.5 text-xs text-gray-600"
                    >
                        <Check className="h-3 w-3 text-green-600 shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>

            <div className="mt-4 flex items-center gap-2">
                <Button
                    onClick={() => setConnected((v) => !v)}
                    disabled={connected}
                    size="sm"
                    className="flex-1 h-8 text-xs bg-black hover:bg-gray-900 text-white"
                >
                    {connected ? (
                        <>
                            <Check className="h-3 w-3" />
                            Connected
                        </>
                    ) : (
                        "Connect"
                    )}
                </Button>
                <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors px-2"
                >
                    Docs
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function OptionRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2 sm:gap-6 px-4 py-4">
            <div className="text-sm text-gray-700 pt-2">{label}</div>
            <div>{children}</div>
        </div>
    );
}

function ClientDropdown({
    value,
    options,
    onChange,
}: {
    value: string;
    options: ClientOption[];
    onChange: (id: string) => void;
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-800 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
                {options.map((o) => (
                    <option key={o.id} value={o.id}>
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
    );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={on}
            className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                on ? "bg-gray-900" : "bg-gray-200"
            }`}
        >
            <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    on ? "translate-x-4" : "translate-x-0.5"
                }`}
            />
        </button>
    );
}

function StepRow({ index, step }: { index: number; step: Step }) {
    const [copied, setCopied] = useState(false);

    function copy() {
        navigator.clipboard
            .writeText(step.code)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {});
    }

    return (
        <li className="grid grid-cols-1 sm:grid-cols-[40px_1fr_1fr] gap-3 sm:gap-6 px-4 py-4">
            <div className="flex items-start">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {index}
                </span>
            </div>
            <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                    {step.title}
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    {step.description}
                </p>
            </div>
            <div className="relative">
                <Input
                    readOnly
                    value={step.code}
                    onFocus={(e) => e.currentTarget.select()}
                    className="pr-9 font-mono text-xs bg-gray-50 border-gray-200 text-gray-800"
                />
                <button
                    type="button"
                    onClick={copy}
                    title="Copy"
                    className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-700"
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </button>
            </div>
        </li>
    );
}
