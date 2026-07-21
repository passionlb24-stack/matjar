import type { LucideIcon } from "lucide-react";
import { Calculator, TagsIcon, QrCode, Barcode, FileText } from "lucide-react";

// ===== Business Hub — tool registry =====
// One source of truth for the tools center. Adding a tool = one entry here +
// a dict.hub.tools.<slug> block + a page/component. The slug is the URL segment,
// the demand-sensing key (hub_tool_events.tool), and the dict key.
export type HubToolCategory = "calc" | "generate" | "docs";

export type HubTool = {
  slug: string;
  Icon: LucideIcon;
  category: HubToolCategory;
  /** Tint classes for the tool's icon badge. */
  tint: string;
};

export const HUB_TOOLS: HubTool[] = [
  { slug: "profit", Icon: Calculator, category: "calc", tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { slug: "pricing", Icon: TagsIcon, category: "calc", tint: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
  { slug: "qr", Icon: QrCode, category: "generate", tint: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
  { slug: "barcode", Icon: Barcode, category: "generate", tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  { slug: "invoice", Icon: FileText, category: "docs", tint: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
];

export const HUB_TOOL_CATEGORIES: HubToolCategory[] = ["calc", "generate", "docs"];

export function getHubTool(slug: string): HubTool | undefined {
  return HUB_TOOLS.find((t) => t.slug === slug);
}
