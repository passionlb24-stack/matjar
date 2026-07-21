import { createClient } from "@/lib/supabase/client";

// Fire-and-forget demand signal: records that a Hub tool was actually used
// (not just opened). Never blocks or surfaces errors to the user — a failed
// analytics ping must not affect the tool. Debounced per tool per session so a
// live-recalculating tool doesn't spam a row per keystroke.
const fired = new Set<string>();

export function trackToolUse(slug: string) {
  if (typeof window === "undefined") return;
  const key = `${slug}`;
  if (fired.has(key)) return;
  fired.add(key);
  try {
    void createClient().rpc("log_tool_use", { p_tool: slug });
  } catch {
    /* ignore — analytics must never break the tool */
  }
}
