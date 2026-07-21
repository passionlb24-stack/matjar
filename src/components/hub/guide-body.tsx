import { Lightbulb } from "lucide-react";
import type { GuideBlock, AcademyCategory } from "@/content/academy";
import { CATEGORY_STYLE } from "@/content/academy";

// Renders a guide's structured blocks as a premium editorial reading experience:
// a drop-capped lead, numbered accent section headings, refined list markers,
// and a styled "tip" callout. No markdown library — the content is typed blocks.
export function GuideBody({
  blocks,
  category,
}: {
  blocks: GuideBlock[];
  category: AcademyCategory;
}) {
  const s = CATEGORY_STYLE[category];
  const firstP = blocks.findIndex((b) => b.t === "p");
  let hn = 0;

  return (
    <article className="mt-2">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": {
            hn += 1;
            const n = hn;
            return (
              <h2
                key={i}
                className="mt-11 flex items-baseline gap-3 border-t border-border pt-6 text-[1.6rem] font-extrabold leading-tight tracking-tight text-foreground"
              >
                <span className={`shrink-0 text-2xl font-black tabular-nums ${s.text}`}>
                  {String(n).padStart(2, "0")}
                </span>
                <span>{b.text}</span>
              </h2>
            );
          }
          case "p":
            return (
              <p
                key={i}
                className={
                  i === firstP
                    ? `mt-6 max-w-[68ch] text-xl leading-[1.9] text-foreground first-letter:float-right first-letter:ms-1 first-letter:me-3 first-letter:mt-1.5 first-letter:text-6xl first-letter:font-black first-letter:leading-[0.7] first-letter:text-primary`
                    : "mt-5 max-w-[68ch] text-[17px] leading-[2] text-foreground/80"
                }
              >
                {b.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="mt-5 max-w-[68ch] space-y-3">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3 text-[17px] leading-[1.8] text-foreground/85">
                    <span className={`mt-2.5 h-2 w-2 shrink-0 rotate-45 rounded-[2px] ${s.bar}`} />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="mt-5 max-w-[68ch] space-y-3">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3.5 text-[17px] leading-[1.8] text-foreground/85">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums ${s.tint}`}>
                      {j + 1}
                    </span>
                    <span className="pt-0.5">{it}</span>
                  </li>
                ))}
              </ol>
            );
          case "tip":
            return (
              <div
                key={i}
                className={`mt-7 max-w-[68ch] overflow-hidden rounded-2xl border border-border bg-gradient-to-bl ${s.grad} to-transparent`}
              >
                <div className="flex gap-4 p-5">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.tint}`}>
                    <Lightbulb className="h-5 w-5" />
                  </span>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest ${s.text}`}>نصيحة</p>
                    <p className="mt-1 text-[15.5px] font-medium leading-[1.8] text-foreground/90">{b.text}</p>
                  </div>
                </div>
              </div>
            );
          default:
            return null;
        }
      })}
    </article>
  );
}
