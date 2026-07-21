import { Lightbulb } from "lucide-react";
import type { GuideBlock } from "@/content/academy";

// Renders a guide's structured blocks as clean, readable RTL prose. No markdown
// library — the content is typed blocks, so there's nothing to sanitize.
export function GuideBody({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-5 text-[15.5px] leading-[1.9] text-foreground/90">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return (
              <h2 key={i} className="pt-3 text-xl font-extrabold tracking-tight text-foreground">
                {b.text}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="max-w-2xl">
                {b.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="max-w-2xl space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="max-w-2xl space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                      {j + 1}
                    </span>
                    <span className="pt-0.5">{it}</span>
                  </li>
                ))}
              </ol>
            );
          case "tip":
            return (
              <div key={i} className="flex max-w-2xl gap-3 rounded-2xl border border-primary/25 bg-primary-soft/40 p-4">
                <Lightbulb className="h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm font-medium">{b.text}</p>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
