"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";

// Light/dark toggle. Sets data-theme on <html> (which flips the token palette in
// globals.css) and persists the choice; a no-flash inline script in the root
// layout applies the stored choice before paint. With no stored choice the site
// follows the OS preference (prefers-color-scheme), so this button reflects the
// *effective* theme and then takes explicit control on click.
//
// The theme lives outside React — in <html data-theme>, localStorage and the OS
// — so it is read as an external store rather than copied into state on mount.
// That also means the button now follows the OS switching theme mid-session,
// which the previous mount-once effect could not see.

const THEME_EVENT = "matjar-theme-change";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    mq?.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

function isDarkNow(): boolean {
  const applied = document.documentElement.dataset.theme;
  if (applied === "dark" || applied === "light") return applied === "dark";
  try {
    const stored = localStorage.getItem("matjar-theme");
    if (stored === "dark" || stored === "light") return stored === "dark";
  } catch {
    /* storage blocked — fall through to the OS preference */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

// The button carries no visible text, so these labels are the only thing a
// screen reader — or anyone hovering — gets. They were hardcoded Arabic, which
// meant every English page shipped an Arabic control name.
//
// The locale comes from the path rather than a prop because this button is
// mounted from five places (both layouts, both mobile menus, the site header),
// and every route in the app is locale-prefixed, so the path already knows.
const LABELS = {
  ar: { toLight: "الوضع الفاتح", toDark: "الوضع الداكن" },
  en: { toLight: "Light mode", toDark: "Dark mode" },
} as const;

export function ThemeToggle({ className = "" }: { className?: string }) {
  // "/en/merchant/..." → en; anything else (including "/") falls back to the
  // primary locale, matching how the rest of the app treats an absent prefix.
  const lang = usePathname()?.split("/")[1] === "en" ? "en" : "ar";
  const t = LABELS[lang];
  // Light on the server: the markup has to match what renders before the
  // no-flash script has had a chance to touch it.
  const isDark = useSyncExternalStore(subscribe, isDarkNow, () => false);

  const toggle = useCallback(() => {
    const value = isDarkNow() ? "light" : "dark";
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("matjar-theme", value);
    } catch {
      /* storage blocked — the in-memory toggle still works this session */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t.toLight : t.toDark}
      title={isDark ? t.toLight : t.toDark}
      // 36px visual, 44px hit area (WCAG 2.5.5) via a transparent outset.
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-surface-muted hover:text-foreground active:scale-95 ${className}`}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
