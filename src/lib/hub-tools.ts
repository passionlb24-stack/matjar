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
  /** Tint classes for the tool's icon badge — one slot of the shared
   *  categorical ramp in globals.css, so the badge follows the dark theme and
   *  the ink clears 4.5:1 on its own fill in both. Was a hand-picked palette
   *  pair per tool with a hand-written `dark:` override beside it. */
  tint: string;
};

export const HUB_TOOLS: HubTool[] = [
  { slug: "profit", Icon: Calculator, category: "calc", tint: "bg-tint-4-soft text-tint-4" },
  { slug: "pricing", Icon: TagsIcon, category: "calc", tint: "bg-tint-5-soft text-tint-5" },
  { slug: "qr", Icon: QrCode, category: "generate", tint: "bg-tint-7-soft text-tint-7" },
  { slug: "barcode", Icon: Barcode, category: "generate", tint: "bg-tint-2-soft text-tint-2" },
  { slug: "invoice", Icon: FileText, category: "docs", tint: "bg-tint-1-soft text-tint-1" },
];

export const HUB_TOOL_CATEGORIES: HubToolCategory[] = ["calc", "generate", "docs"];

export function getHubTool(slug: string): HubTool | undefined {
  return HUB_TOOLS.find((t) => t.slug === slug);
}
