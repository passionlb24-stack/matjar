"use client";

import { useId } from "react";

// Tiny dependency-free trend charts for stat tiles and table rows. Pure SVG:
// stroke/fill use currentColor, so color them with a text-* class (e.g.
// `text-success`). Client component only because the area gradient needs a
// collision-free id (useId); there is no state and no effects.

const round = (n: number) => Math.round(n * 100) / 100;

/** Smooth line + soft gradient area fill + a dot on the latest point. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  strokeWidth = 2,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const id = useId();
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = strokeWidth + 1.5; // headroom for the stroke + end dot
  const stepX = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [
    round(pad + i * stepX),
    round(pad + (1 - (v - min) / range) * (height - pad * 2)),
  ]);

  // Midpoint-smoothed quadratic path through every point.
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = round((pts[i][0] + pts[i + 1][0]) / 2);
    const my = round((pts[i][1] + pts[i + 1][1]) / 2);
    d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` T ${last[0]} ${last[1]}`;

  const area = `${d} L ${last[0]} ${height} L ${pts[0][0]} ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} stroke="none" />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.5} fill="currentColor" />
    </svg>
  );
}

/** Tiny bar chart with rounded tops; the latest bar is emphasized. */
export function MiniBars({
  values,
  width = 120,
  height = 36,
  gap = 2,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  gap?: number;
  className?: string;
}) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 0) || 1;
  const barW = (width - gap * (values.length - 1)) / values.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {values.map((v, i) => {
        const h = Math.max(2, (Math.max(0, v) / max) * height);
        const x = round(i * (barW + gap));
        const y = round(height - h);
        const r = round(Math.min(2, barW / 2, h));
        // Rounded top corners only; flat baseline.
        const d =
          `M ${x} ${height} V ${round(y + r)} Q ${x} ${y} ${round(x + r)} ${y} ` +
          `H ${round(x + barW - r)} Q ${round(x + barW)} ${y} ${round(x + barW)} ${round(y + r)} ` +
          `V ${height} Z`;
        return (
          <path
            key={i}
            d={d}
            fill="currentColor"
            opacity={i === values.length - 1 ? 1 : 0.4}
          />
        );
      })}
    </svg>
  );
}
