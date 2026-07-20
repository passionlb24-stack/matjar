"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

// Sticky search that reveals itself in the header once the hero search has
// scrolled out of view — so search is always one tap away as you go down the
// page. Collapsed (max-h-0) until scrolled, so it adds no height at the top.
export function HeaderSearch({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 460);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`overflow-hidden border-t transition-all duration-300 ease-out ${
        show ? "max-h-20 border-border/60 opacity-100" : "max-h-0 border-transparent opacity-0"
      }`}
    >
      <Container className="py-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const term = q.trim();
            router.push(
              `/${lang}/${term ? `search?q=${encodeURIComponent(term)}` : "explore"}`,
            );
          }}
          className="flex items-center gap-2"
        >
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 transition-colors focus-within:border-primary">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={dict.hero.searchPlaceholder}
              aria-label={dict.hero.searchButton}
              tabIndex={show ? 0 : -1}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            tabIndex={show ? 0 : -1}
            className="h-10 shrink-0 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover active:scale-[0.97]"
          >
            {dict.hero.searchButton}
          </button>
        </form>
      </Container>
    </div>
  );
}
