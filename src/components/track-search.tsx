"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// What people looked for, and whether Matjar had it.
//
// `log_search` has existed since 0114 and `search_logs` has **zero rows**,
// because the RPC was wired into /explore only — and /explore is the browse
// surface. The page where somebody types what they actually want, /search,
// never logged a thing. Every day that ran, the one question this marketplace
// most needs answered — what did a customer ask for that no merchant here
// sells — was thrown away.
//
// A zero-result search is the most valuable row in the table: it is a merchant
// you have not recruited yet, named by a customer.
//
// Client-side and fire-and-forget on purpose. The search page is a server
// component; logging inside its render would put a write on the critical path
// of every result set, including prefetches. This mirrors TrackVisit, which
// already established the pattern.
export function TrackSearch({
  q,
  section,
  results,
  region = null,
}: {
  q: string;
  /** Which surface asked — the RPC accepts several, and telling them apart is
   *  what makes "0 results on /search" distinguishable from idle browsing. */
  section: string;
  results: number;
  region?: string | null;
}) {
  useEffect(() => {
    if (!q.trim()) return;
    // Bots would drown the demand signal this exists to collect.
    if (typeof navigator !== "undefined" && navigator.webdriver) return;

    // One row per query per session. Pagination, a language switch or a back
    // button should not read as fresh demand.
    const key = `matjar-logged-${section}-${q}-${region ?? ""}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — log once anyway rather than lose the signal */
    }

    void createClient()
      .rpc("log_search", {
        p_q: q,
        p_section: section,
        p_results: results,
        p_region: region,
      })
      // Instrumentation must never surface an error to someone searching.
      .then(
        () => {},
        () => {},
      );
  }, [q, section, results, region]);

  return null;
}
