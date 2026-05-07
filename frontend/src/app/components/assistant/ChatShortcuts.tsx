"use client";

import { useEffect, useRef, useState } from "react";
import {
    ChevronUp,
    Database as DatabaseIcon,
    Globe,
    Pencil,
    Scale,
    Search,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listProjects } from "@/app/lib/mikeApi";
import type { MikeProject } from "../shared/types";

type ShortcutIcon = "globe" | "database" | "scale" | "pencil";

interface ShortcutPayload {
    id: string;
    label: string;
    icon: ShortcutIcon;
    chipClass?: string;
}

function dispatchAdd(payload: ShortcutPayload) {
    window.dispatchEvent(
        new CustomEvent("chat:shortcut:add", { detail: payload }),
    );
}

function dispatchRemove(id: string) {
    window.dispatchEvent(
        new CustomEvent("chat:shortcut:remove", { detail: { id } }),
    );
}

/** Subscribe to the set of currently active shortcut ids. */
function useActiveShortcutIds(): Set<string> {
    const [ids, setIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        function handler(e: Event) {
            const detail = (e as CustomEvent<{ activeIds: string[] }>).detail;
            setIds(new Set(detail?.activeIds ?? []));
        }
        window.addEventListener(
            "chat:shortcut:state",
            handler as EventListener,
        );
        return () =>
            window.removeEventListener(
                "chat:shortcut:state",
                handler as EventListener,
            );
    }, []);
    return ids;
}

export function ChatShortcuts() {
    return (
        <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Genvägar</span>
            <SimpleShortcutToggle
                id="juridisk"
                label="Juridisk forskning"
                icon="scale"
                color="text-orange-500"
                chipClass="bg-orange-50 text-orange-700 border-orange-200"
            />
            <DatabasePickerButton />
            <WebSearchToggle />
            <SimpleShortcutToggle
                id="editor"
                label="Editor"
                icon="pencil"
                color="text-gray-700"
                chipClass="bg-gray-100 text-gray-700 border-gray-200"
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Generic toggle button (Juridisk forskning, Editor)
// ---------------------------------------------------------------------------

function SimpleShortcutToggle({
    id,
    label,
    icon,
    color,
    chipClass,
}: {
    id: string;
    label: string;
    icon: ShortcutIcon;
    color: string;
    chipClass: string;
}) {
    const activeIds = useActiveShortcutIds();
    const active = activeIds.has(id);
    const Icon = ICONS[icon];

    function handleClick() {
        if (active) dispatchRemove(id);
        else dispatchAdd({ id, label, icon, chipClass });
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full border text-xs transition-colors ${
                active
                    ? chipClass
                    : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            }`}
        >
            <Icon className={`h-3.5 w-3.5 ${active ? "" : color}`} />
            {label}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Web search toggle (with activation popup)
// ---------------------------------------------------------------------------

function WebSearchToggle() {
    const activeIds = useActiveShortcutIds();
    const active = activeIds.has("websearch");
    const [showPopup, setShowPopup] = useState(false);
    const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (popupTimer.current) clearTimeout(popupTimer.current);
        };
    }, []);

    function handleToggle() {
        if (active) {
            dispatchRemove("websearch");
            setShowPopup(false);
        } else {
            dispatchAdd({
                id: "websearch",
                label: "Web search",
                icon: "globe",
                chipClass: "bg-blue-50 text-blue-700 border-blue-200",
            });
            setShowPopup(true);
            if (popupTimer.current) clearTimeout(popupTimer.current);
            popupTimer.current = setTimeout(() => setShowPopup(false), 5000);
        }
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={handleToggle}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full border text-xs transition-colors ${
                    active
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                }`}
            >
                <span
                    className={`flex items-center justify-center h-4 w-4 rounded-full transition-colors ${
                        active ? "bg-blue-500 text-white" : "bg-transparent"
                    }`}
                >
                    <Globe
                        className={`h-3 w-3 ${active ? "text-white" : "text-blue-500"}`}
                    />
                </span>
                {active ? "Web search" : "Webbsökning"}
            </button>

            {showPopup && (
                <div
                    role="status"
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 z-50"
                >
                    <div className="rounded-2xl bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl p-4 text-left relative">
                        <div className="flex items-start gap-2 mb-1.5">
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white shrink-0">
                                <Globe className="h-3 w-3" />
                            </span>
                            <h4 className="text-sm font-semibold text-gray-900">
                                Webbsökning aktiverad
                            </h4>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                            Detta gör det möjligt för assistenten att söka på
                            webben efter relevant information. Konfidentiell
                            information och personuppgifter som ingår i
                            uppmaningen kan exponeras på den öppna webben.
                        </p>
                        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 bg-white/95 border-r border-b border-gray-200" />
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Database picker (project + database list)
// ---------------------------------------------------------------------------

interface DatabaseEntry {
    id: string;
    name: string;
    description: string;
}

const DATABASES: DatabaseEntry[] = [
    {
        id: "lagrum",
        name: "Lagrum",
        description: "Svensk lagstiftning",
    },
    {
        id: "praxis",
        name: "Rättspraxis",
        description: "HD- och HovR-avgöranden",
    },
    {
        id: "forarbeten",
        name: "Förarbeten",
        description: "Propositioner och utredningar",
    },
];

function DatabasePickerButton() {
    const activeIds = useActiveShortcutIds();
    const active = activeIds.has("database");
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [projects, setProjects] = useState<MikeProject[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [activeLabel, setActiveLabel] = useState<string | null>(null);

    useEffect(() => {
        if (!open || loaded) return;
        let cancelled = false;
        (async () => {
            try {
                const list = await listProjects();
                if (!cancelled) {
                    setProjects(list);
                    setLoaded(true);
                }
            } catch {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, loaded]);

    // If the user removes the chip from ChatInput, clear our selection.
    useEffect(() => {
        if (!active) setActiveLabel(null);
    }, [active]);

    const q = query.trim().toLowerCase();
    const filteredProjects = q
        ? projects.filter((p) => p.name.toLowerCase().includes(q))
        : projects;
    const filteredDatabases = q
        ? DATABASES.filter(
              (d) =>
                  d.name.toLowerCase().includes(q) ||
                  d.description.toLowerCase().includes(q),
          )
        : DATABASES;

    function pick(name: string) {
        setActiveLabel(name);
        dispatchAdd({
            id: "database",
            label: name,
            icon: "database",
            chipClass: "bg-gray-100 text-gray-700 border-gray-200",
        });
        setOpen(false);
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full border text-xs transition-colors ${
                        active
                            ? "bg-gray-100 text-gray-700 border-gray-200"
                            : "border-gray-200 bg-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                >
                    <DatabaseIcon className="h-3.5 w-3.5 text-gray-700" />
                    <span className="truncate max-w-[160px]">
                        {active && activeLabel ? activeLabel : "Databassökning"}
                    </span>
                    <ChevronUp
                        className={`h-3 w-3 text-gray-400 transition-transform ${open ? "" : "rotate-180"}`}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side="top"
                align="center"
                sideOffset={8}
                className="w-80 p-2 rounded-xl shadow-lg border border-gray-200 bg-white"
            >
                <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Sök i databaser eller mappar..."
                        className="w-full h-8 pl-7 pr-2 text-xs rounded-md bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 placeholder:text-gray-400"
                    />
                </div>

                <div className="px-1 pt-1 pb-1 text-[11px] font-medium text-gray-500">
                    Projekt
                </div>
                {filteredProjects.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-gray-400">
                        {loaded ? "Inga projekt" : "Laddar..."}
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {filteredProjects.map((p) => (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    onClick={() => pick(p.name)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                                >
                                    <span className="flex items-center justify-center h-7 w-7 rounded bg-gray-100 shrink-0">
                                        <DatabaseIcon className="h-3.5 w-3.5 text-orange-500" />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-xs text-gray-900 truncate">
                                            {p.name}
                                        </span>
                                        <span className="block text-[11px] text-gray-500 truncate">
                                            {p.document_count ?? 0} dokument
                                            {p.cm_number
                                                ? ` · ${p.cm_number}`
                                                : " · Pågående projekt"}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="h-px bg-gray-100 my-2" />

                <div className="px-1 pb-1 text-[11px] font-medium text-gray-500">
                    Databaser
                </div>
                <ul className="space-y-0.5">
                    {filteredDatabases.map((d) => (
                        <li key={d.id}>
                            <button
                                type="button"
                                onClick={() => pick(d.name)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                            >
                                <span className="flex items-center justify-center h-7 w-7 rounded bg-gray-100 shrink-0">
                                    <DatabaseIcon className="h-3.5 w-3.5 text-gray-700" />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-xs text-gray-900 truncate">
                                        {d.name}
                                    </span>
                                    <span className="block text-[11px] text-gray-500 truncate">
                                        {d.description}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const ICONS: Record<ShortcutIcon, React.ComponentType<{ className?: string }>> = {
    globe: Globe,
    database: DatabaseIcon,
    scale: Scale,
    pencil: Pencil,
};
