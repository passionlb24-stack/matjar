"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
//
// The menu is rendered in a PORTAL with fixed positioning: list rows sit inside
// scroll-reveal (`data-animate`) containers whose transforms create stacking
// contexts, which would otherwise trap an absolutely-positioned menu behind the
// following row. A portal escapes every ancestor's stacking context and overflow.
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the fixed menu under the trigger, aligned to the trigger's near
  // edge (direction-aware), then clamp inside the viewport.
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = menuRef.current?.offsetWidth ?? 224;
    const rtl =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("dir") === "rtl";
    // "end" aligns the menu's end edge with the trigger's end edge.
    let left =
      align === "end"
        ? rtl
          ? r.left
          : r.right - width
        : rtl
          ? r.right - width
          : r.left;
    const max = window.innerWidth - width - 8;
    left = Math.min(Math.max(8, left), Math.max(8, max));
    setPos({ top: r.bottom + 4, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        btnRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-60 before:absolute before:-inset-1.5 before:content-['']"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              visibility: pos ? "visible" : "hidden",
            }}
            className="z-[100] min-w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
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
          </div>,
          document.body,
        )}
    </>
  );
}
