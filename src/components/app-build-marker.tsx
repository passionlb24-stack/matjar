"use client";

import { useEffect, useState } from "react";
import { APP_MODE_ATTR, APP_MODE_VALUE, APP_UA_TOKEN } from "@/lib/app-mode";

/**
 * What build is actually running, and did app mode switch on.
 *
 * This exists because of a question that could not be answered from here. The
 * app is a WebView pointed at the live site, so a new APK changes almost
 * nothing about what it displays — which means "I installed it and it looks the
 * same" has at least four possible causes (the install silently declined, the
 * user agent token never arrived, the bridge loaded too late, or nothing is
 * wrong and the change was subtler than expected) and no way to tell them apart
 * without holding the phone.
 *
 * Every one of those is distinguishable from three facts: whether the page
 * thinks it is in the app, whether the WebView's user agent carries the token,
 * and which build the shell is. So the app says so, in Account, where nobody
 * trips over it.
 *
 * It renders only inside the shell — the surrounding block is `data-app-only`,
 * which is `display:none` on the web. And it is a client component on purpose:
 * every value here is a property of the runtime, not of the render, so there is
 * nothing the server could truthfully say.
 */
export function AppBuildMarker({
  labels,
}: {
  labels: { mode: string; on: string; off: string; agent: string; version: string };
}) {
  // Read after mount, never during render: `native-bridge.tsx` can set the
  // attribute late on an older binary whose UA carries no token, and a value
  // captured during render would show the state before that happened —
  // reporting "off" for an app that is, a moment later, on.
  const [state, setState] = useState<{
    mode: boolean;
    ua: boolean;
    version: string | null;
  } | null>(null);

  useEffect(() => {
    const read = () =>
      setState({
        mode:
          document.documentElement.getAttribute(APP_MODE_ATTR) ===
          APP_MODE_VALUE,
        ua: (navigator.userAgent || "").includes(APP_UA_TOKEN),
        // The shell appends "MatjarApp/<n>" — the number after the slash is the
        // build. Absent on a binary older than that token.
        version:
          (navigator.userAgent || "").match(
            new RegExp(`${APP_UA_TOKEN}/([\\w.-]+)`),
          )?.[1] ?? null,
      });
    read();
    // The attribute can arrive after hydration on an older install, so watch
    // for it rather than reporting a stale "off" forever.
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [APP_MODE_ATTR],
    });
    return () => obs.disconnect();
  }, []);

  if (!state) return null;

  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border border-border bg-surface p-4 text-sm">
      <dt className="text-muted-foreground">{labels.mode}</dt>
      <dd className="font-semibold" dir="auto">
        {state.mode ? labels.on : labels.off}
      </dd>
      <dt className="text-muted-foreground">{labels.agent}</dt>
      <dd className="font-semibold" dir="ltr">
        {state.ua ? APP_UA_TOKEN : "—"}
      </dd>
      <dt className="text-muted-foreground">{labels.version}</dt>
      <dd className="font-semibold tabular-nums" dir="ltr">
        {state.version ?? "—"}
      </dd>
    </dl>
  );
}
