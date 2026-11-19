"use client";

import { useId, useState } from "react";
import { formatNumber } from "@/lib/format";

export type Datum = { key: string; label: string; value: number; tooltip?: string; highlight?: boolean };

/** Serializable formats, so Server Components can configure the chart. */
export type ValueFormat = "count" | "hours" | "number" | "euros";
const FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  count: (v) => String(Math.round(v)),
  hours: (v) => `${v.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`,
  number: (v) => v.toLocaleString("es-ES", { maximumFractionDigits: 2 }),
  euros: (v) => `${formatNumber(v)} €`,
};

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Single-series column chart: thin bars with 4px rounded tops anchored to the
 * baseline, recessive grid, hover tooltip and a hidden data table for screen
 * readers. One series, so no legend: the section title names it.
 */
export function ColumnChart({
  data,
  height = 160,
  label,
  valueFormat = "count",
  color = "var(--chart-1)",
  labelEvery = 1,
}: {
  data: Datum[];
  height?: number;
  label: string;
  valueFormat?: ValueFormat;
  color?: string;
  labelEvery?: number;
}) {
  const id = useId();
  const format = FORMATTERS[valueFormat];
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, max / 2, max];
  const W = 640;
  const padL = 34;
  const padB = 22;
  const plotW = W - padL;
  const plotH = height - padB - 6;
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(4, Math.min(28, slot - 2 - slot * 0.35));
  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="relative m-0">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby={`${id}-t`}
        onMouseLeave={() => setHover(null)}
      >
        <title id={`${id}-t`}>{label}</title>
        {ticks.map((t) => {
          const y = 6 + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--faint)" className="tabular-nums">
                {format(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(2, (d.value / max) * plotH) : 0;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = 6 + plotH - h;
          const r = Math.min(4, barW / 2, h);
          const dimmed = hover !== null && hover !== i;
          return (
            <g key={d.key}>
              {h > 0 ? (
                <path
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                  fill={color}
                  opacity={dimmed ? 0.35 : d.highlight || hover === i ? 1 : 0.82}
                  style={{ transition: "opacity 120ms" }}
                />
              ) : null}
              {i % labelEvery === 0 || i === data.length - 1 ? (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={10} fill={d.highlight ? "var(--muted)" : "var(--faint)"}>
                  {d.label}
                </text>
              ) : null}
              {/* Hit target: the whole slot, taller and wider than the bar. */}
              <rect
                x={padL + i * slot}
                y={0}
                width={slot}
                height={height - padB}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.tooltip ?? d.label}: ${format(d.value)}`}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-xs shadow-panel"
          style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}
          role="status"
        >
          <div className="text-faint">{active.tooltip ?? active.label}</div>
          <div className="font-medium tabular-nums text-fg">{format(active.value)}</div>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.tooltip ?? d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
