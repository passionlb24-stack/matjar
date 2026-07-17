"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * App-wide confirm dialog — an accessible (role="alertdialog", focus-trapped,
 * Escape-to-cancel) replacement for window.confirm. Mount <ConfirmProvider> once
 * per layout; call `const confirm = useConfirm()` then `if (!(await confirm({…})))
 * return;` exactly where window.confirm used to sit.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    resolverRef.current?.(v);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    confirmBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") settle(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [opts, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={opts.title ?? opts.message}
        >
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => settle(false)}
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[1px] motion-safe:animate-in motion-safe:fade-in"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
            {opts.title && (
              <h2 className="text-lg font-extrabold tracking-tight">
                {opts.title}
              </h2>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{opts.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {opts.cancelLabel}
              </button>
              <button
                ref={confirmBtnRef}
                onClick={() => settle(true)}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors ${
                  opts.danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-primary hover:bg-primary-hover"
                }`}
              >
                {opts.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/** Returns the confirm() function. Falls back to window.confirm if no provider
 *  is mounted (so callers work even outside a ConfirmProvider subtree). */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return (
    ctx ??
    (async (o: ConfirmOptions) =>
      typeof window !== "undefined" && window.confirm(o.message))
  );
}
