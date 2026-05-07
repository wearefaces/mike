"use client";

import { useMemo, useState } from "react";
import {
    Check,
    Copy,
    Download,
    FileCode2,
    Pencil,
    Plus,
    Search,
    Target,
    Zap,
} from "lucide-react";

interface Props {
    text: string;
    fileName?: string;
    onDownload?: () => void;
}

const KEYWORDS = ["Feature", "Scenario", "Given", "When", "Then", "And", "But"];

function tokenize(line: string) {
    // Match leading keyword (case-insensitive) plus a colon for Feature/Scenario.
    const m = line.match(
        /^(\s*)(Feature|Scenario|Given|When|Then|And|But)(\s*:?\s*)(.*)$/i,
    );
    if (!m) {
        return { indent: "", keyword: null as string | null, rest: line };
    }
    const [, indent, kw, sep, rest] = m;
    return { indent, keyword: kw.toUpperCase(), sep, rest };
}

function colorForKeyword(kw: string | null): string {
    switch (kw) {
        case "FEATURE":
            return "text-sky-300";
        case "SCENARIO":
            return "text-indigo-300";
        case "GIVEN":
            return "text-emerald-300";
        case "WHEN":
            return "text-amber-300";
        case "THEN":
            return "text-fuchsia-300";
        case "AND":
        case "BUT":
            return "text-cyan-300";
        default:
            return "text-slate-300";
    }
}

function highlightRest(rest: string) {
    // Highlight quoted strings as orange and known modifiers/keywords softly.
    const parts: Array<{ text: string; cls: string }> = [];
    const regex = /("[^"]*"|\b(?:else|skip|pass|with|priority|contains|does\s+not\s+contain|has|of|as)\b)/gi;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rest)) !== null) {
        if (match.index > last) {
            parts.push({
                text: rest.slice(last, match.index),
                cls: "text-slate-200",
            });
        }
        const tok = match[0];
        if (tok.startsWith('"')) {
            parts.push({ text: tok, cls: "text-orange-300" });
        } else {
            parts.push({ text: tok, cls: "text-amber-200/80" });
        }
        last = regex.lastIndex;
    }
    if (last < rest.length) {
        parts.push({ text: rest.slice(last), cls: "text-slate-200" });
    }
    if (parts.length === 0) parts.push({ text: rest, cls: "text-slate-200" });
    return parts;
}

export function GherkinScenarioViewer({
    text,
    fileName = "scenario.feature",
    onDownload,
}: Props) {
    const [copied, setCopied] = useState(false);

    const lines = useMemo(() => text.split(/\r?\n/), [text]);
    const stats = useMemo(() => {
        let scenarios = 0;
        let given = 0;
        let when = 0;
        let then = 0;
        let and = 0;
        for (const raw of lines) {
            const { keyword } = tokenize(raw);
            if (!keyword) continue;
            if (keyword === "SCENARIO") scenarios += 1;
            else if (keyword === "GIVEN") given += 1;
            else if (keyword === "WHEN") when += 1;
            else if (keyword === "THEN") then += 1;
            else if (keyword === "AND" || keyword === "BUT") and += 1;
        }
        return { scenarios, given, when, then, and };
    }, [lines]);

    function copy() {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {});
    }

    function defaultDownload() {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-slate-50 to-white border-b border-gray-200">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                        <FileCode2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                            Gherkin Scenario
                        </div>
                        <div className="text-[11px] text-gray-500">
                            {lines.length} lines · {stats.scenarios} scenario
                            {stats.scenarios === 1 ? "" : "s"}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-medium">
                        Feature File
                    </span>
                    <button
                        type="button"
                        className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
                        title="Edit"
                    >
                        <Pencil className="h-3 w-3" />
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={copy}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
                        title="Copy"
                    >
                        {copied ? (
                            <>
                                <Check className="h-3 w-3 text-green-600" />
                                Copied
                            </>
                        ) : (
                            <>
                                <Copy className="h-3 w-3" />
                                Copy
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onDownload ?? defaultDownload}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
                        title="Download"
                    >
                        <Download className="h-3 w-3" />
                        Download
                    </button>
                </div>
            </div>

            {/* Code block */}
            <div className="bg-slate-900">
                {/* macOS-style title bar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        <span className="ml-3 text-[11px] font-mono text-slate-400">
                            {fileName}
                        </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded border border-slate-700">
                        Gherkin
                    </span>
                </div>

                {/* Lines */}
                <div className="overflow-auto max-h-96 font-mono text-[12.5px] leading-6">
                    <table className="w-full border-collapse">
                        <tbody>
                            {lines.map((raw, i) => {
                                const { indent, keyword, sep, rest } = tokenize(raw);
                                const restParts = highlightRest(rest ?? "");
                                return (
                                    <tr key={i}>
                                        <td className="select-none text-right pr-3 pl-4 py-0 text-[11px] text-slate-500/70 bg-slate-900 border-r border-slate-800 align-top w-10">
                                            {i + 1}
                                        </td>
                                        <td className="pl-4 pr-4 py-0 whitespace-pre text-slate-200 align-top">
                                            <span>{indent}</span>
                                            {keyword ? (
                                                <>
                                                    <span
                                                        className={`font-semibold ${colorForKeyword(keyword)}`}
                                                    >
                                                        {keyword}
                                                    </span>
                                                    <span className="text-slate-400">
                                                        {sep}
                                                    </span>
                                                </>
                                            ) : null}
                                            {restParts.map((p, idx) => (
                                                <span
                                                    key={idx}
                                                    className={p.cls}
                                                >
                                                    {p.text}
                                                </span>
                                            ))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gray-200 bg-gray-50 text-xs">
                <StatCell
                    icon={<Check className="h-3.5 w-3.5 text-emerald-600" />}
                    label="GIVEN"
                    value={stats.given}
                />
                <StatCell
                    icon={<Zap className="h-3.5 w-3.5 text-amber-600" />}
                    label="WHEN"
                    value={stats.when}
                />
                <StatCell
                    icon={<Target className="h-3.5 w-3.5 text-fuchsia-600" />}
                    label="THEN"
                    value={stats.then}
                />
                <StatCell
                    icon={<Plus className="h-3.5 w-3.5 text-cyan-600" />}
                    label="AND"
                    value={stats.and}
                />
            </div>
        </div>
    );
}

function StatCell({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
}) {
    return (
        <div className="flex items-center gap-2 px-4 py-2.5 border-r last:border-r-0 border-gray-200">
            {icon}
            <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-gray-900">
                    {value}
                </span>
                <span className="text-[10px] font-medium tracking-wider text-gray-500">
                    {label}
                </span>
            </div>
        </div>
    );
}

// Suppress unused-import warning for Search if treeshaking complains.
export const _GherkinIcons = { Search };
