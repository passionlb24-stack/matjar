"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

// Lightweight accordion FAQ — answers the "what is this / is it safe / how do
// I start" questions a first-time visitor has, right before the footer.
export function HomeFaq({ dict }: { dict: Dictionary }) {
  const t = dict.homeFaq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-14 sm:py-20">
      <Container>
        <div className="mb-8 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
            {t.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.title}
          </h2>
        </div>

        <div className="mx-auto grid max-w-2xl gap-2.5">
          {t.items.map((qa, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 p-4 text-start text-[15px] font-bold transition-colors hover:bg-surface-muted/50 sm:p-5"
                >
                  {qa.q}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
                      isOpen
                        ? "rotate-45 bg-primary text-primary-foreground"
                        : "bg-surface-muted text-muted-foreground"
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pb-5">
                      {qa.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
