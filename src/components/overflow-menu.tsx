"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export type OverflowAction = {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
};

// A "⋯" trigger that reveals a small action menu. Keeps secondary/attribute
// actions out of a crowded row so a single primary button stays prominent.
export function OverflowMenu({
  actions,
  label,
  align = "end",
  disabled,
}: {
  actions: OverflowAction[];
  label: string;
  align?: "start" | "end";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (actions.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-60"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-50 mt-1 min-w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg ${
            align === "end" ? "end-0" : "start-0"
          }`}
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm font-semibold transition-colors hover:bg-surface-muted disabled:opacity-60 ${
                a.destructive
                  ? "text-danger hover:bg-danger-soft"
                  : a.active
                    ? "text-primary"
                    : "text-foreground"
              }`}
            >
              <a.Icon className="h-4 w-4 shrink-0" />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
