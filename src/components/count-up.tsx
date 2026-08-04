"use client";

import { useEffect, useRef, useState } from "react";

// Count-up number that animates once when it scrolls into view. Respects
// reduced-motion (renders the final value immediately). Used by the hero stat
// pills and the stats band.
export function CountUp({
  to,
  suffix = "",
  duration = 1200,
  locale = "en",
  className,
}: {
  to: number;
  suffix?: string;
  duration?: number;
  locale?: "ar" | "en";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || done.current) return;
        done.current = true;
        io.disconnect();
        // Reduced motion still lands on the final number — it just skips the
        // count. Checked here rather than in the effect body so the state write
        // happens in a callback, and so the number appears when it scrolls into
        // view like every other one.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setN(to);
          return;
        }
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - start) / duration, 1);
          // easeOutCubic
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(eased * to));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {n.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
      {suffix}
    </span>
  );
}
