"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Light/dark toggle. Sets data-theme on <html> (which flips the token palette in
// globals.css) and persists the choice; a no-flash inline script in the root
// layout applies the stored choice before paint. With no stored choice the site
// follows the OS preference (prefers-color-scheme), so this button reflects the
// *effective* theme on mount and then takes explicit control on click.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("matjar-theme");
    if (stored === "dark" || stored === "light") {
      setDark(stored === "dark");
    } else {
      setDark(
        window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
      );
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const value = next ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("matjar-theme", value);
    } catch {
      /* storage blocked — the in-memory toggle still works this session */
    }
  }

  // Avoid a hydration mismatch: render a neutral icon until we know the theme.
  const isDark = dark ?? false;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
      title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground active:scale-95 ${className}`}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
