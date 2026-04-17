"use client";

import { useRef, useState } from "react";
import {
  BarChart, Bar, AreaChart, Area,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { tableToCSV, downloadElementAsPng } from "@/lib/export";

export type MessageRole = "user" | "assistant";

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
}

export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
}

export interface BoxplotDatum {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers?: number[];
}

export interface ResponseBlock {
  type:
    | "text"
    | "table"
    | "bar_chart"
    | "line_chart"
    | "pie_chart"
    | "radar_chart"
    | "scatter_chart"
    | "stacked_bar_chart"
    | "grouped_bar_chart"
    | "heatmap"
    | "boxplot"
    | "area_chart"
    | "gauge";
  content?: string;
  columns?: string[];
  rows?: (string | number)[][];
  data?: Array<Record<string, string | number>>;
  dataKey?: string;
  xKey?: string;
  yKey?: string;
  axisKey?: string;
  labelKey?: string;
  xLabel?: string;
  yLabel?: string;
  series?: ChartSeries[];
  title?: string;
  description?: string;
  colors?: string[];
  // heatmap
  xAxis?: string[];
  yAxis?: string[];
  cells?: HeatmapCell[];
  valueRange?: [number, number];
  colorScale?: string[];
  // gauge
  value?: number;
  max?: number;
  unit?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  blocks?: ResponseBlock[];
  text?: string;
  timestamp: Date;
  attachments?: Array<{ name: string; mimeType: string; preview?: string }>;
}

const PALETTE = ["#1CC5C8", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981", "#F97316"];

const CARD_STYLE: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--border)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  position: "relative",
};

/* ── Download button (top-right on each exportable card) ── */
function DownloadButton({
  onClick,
  tooltip,
  busy,
}: { onClick: () => void; tooltip: string; busy?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-html2canvas-ignore="true"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 2,
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        background: hover ? "rgba(28,197,200,0.10)" : "transparent",
        border: "none",
        color: hover ? "#1CC5C8" : "var(--muted, #8896AB)",
        cursor: busy ? "progress" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  );
}

/* ── Score badge ── */
function ScoreBadge({ val }: { val: number }) {
  const bg = val < 60 ? "#FEE2E2" : val < 75 ? "#FEF3C7" : "#D1FAE5";
  const fg = val < 60 ? "#DC2626" : val < 75 ? "#D97706" : "#059669";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: fg }}>{val}%</span>
  );
}

/* ── Proficiency badge ── */
function ProfBadge({ val }: { val: string }) {
  const v = String(val).toLowerCase();
  const map: Record<string, [string, string]> = {
    below:          ["#FEE2E2", "#DC2626"],
    approaching:    ["#FEF3C7", "#D97706"],
    "on grade level": ["#D1FAE5", "#059669"],
    "above level":  ["#EDE9FE", "#7C3AED"],
  };
  const [bg, fg] = map[v] || ["#F1F5F9", "#64748B"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: fg }}>{val || "—"}</span>
  );
}

/* ── Inline markdown helpers ── */
function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    if (m[1]) result.push(<strong key={m.index} style={{ fontWeight: 700, color: "var(--text-dark, #1A2537)" }}>{m[2]}</strong>);
    else if (m[3]) result.push(<em key={m.index}>{m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

function renderMarkdown(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => {
    const isBullet = /^[-•]\s/.test(line);
    const body = isBullet ? line.replace(/^[-•]\s/, "") : line;
    const parts = parseInline(body);
    return (
      <span key={i} style={{ display: isBullet ? "flex" : "block", gap: isBullet ? 6 : 0, marginBottom: isBullet ? 2 : 0 }}>
        {isBullet && <span style={{ color: "#1CC5C8", flexShrink: 0 }}>•</span>}
        <span>{parts}</span>
      </span>
    );
  });
}

/* ── Text block ── */
function TextBlock({ content }: { content: string }) {
  return (
    <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 ai-msg" style={CARD_STYLE}>
      <div className="text-sm leading-relaxed" style={{ color: "var(--text-mid)" }}>
        {renderMarkdown(content)}
      </div>
    </div>
  );
}

/* ── Table block ── */
function TableBlock({
  columns = [],
  rows = [],
  title,
}: { columns?: string[]; rows?: (string | number)[][]; title?: string }) {
  return (
    <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 ai-msg overflow-hidden" style={CARD_STYLE}>
      <DownloadButton
        tooltip="Download CSV"
        onClick={() => tableToCSV(columns, rows, title)}
      />
      <div className="w-full">
        {title && (
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest"
            style={{ color: "var(--muted)", letterSpacing: "0.08em", paddingRight: 28 }}>
            {title}
          </p>
        )}
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "var(--bg)" }}>
                {columns.map((col, i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="data-row"
                  style={{ background: ri % 2 === 0 ? "white" : "var(--bg)", borderBottom: ri < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
                  {row.map((cell, ci) => {
                    const col = (columns[ci] || "").toLowerCase();
                    const isScore = typeof cell === "number" && (col.includes("score") || col.includes("avg") || col.includes("%"));
                    const isProf  = col.includes("proficiency") || col.includes("level");
                    return (
                      <td key={ci} className="px-3 py-2.5 text-xs" style={{ color: "var(--text)" }}>
                        {isScore ? <ScoreBadge val={cell as number} /> :
                         isProf  ? <ProfBadge val={String(cell)} /> :
                         (cell ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Custom tooltip ── */
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-lg"
      style={{ background: "var(--navy)", color: "white", border: "none", minWidth: 100 }}>
      <p className="font-semibold mb-1" style={{ color: "var(--teal-mid)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i}>{p.name || "Value"}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

/* ── Hook: wraps chart cards with a download handler that snapshots the card to PNG ── */
function useChartDownload(title?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      // Let Recharts finish any pending layout before capture
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await downloadElementAsPng(ref.current, title);
    } catch (err) {
      console.error("Chart PNG export failed", err);
    } finally {
      setBusy(false);
    }
  };
  return { ref, busy, download };
}

/* ── Bar chart block ── */
function BarChartBlock({ data = [], dataKey = "value", xKey = "name", title, description, colors }: {
  data?: Array<Record<string, string | number>>;
  dataKey?: string; xKey?: string; title?: string; description?: string; colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);
  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} margin={{ top: 22, right: 8, left: -16, bottom: 4 }} barSize={32}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(28,197,200,0.06)" }} />
            <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
              <LabelList dataKey={dataKey} position="top"
                style={{ fontSize: 11, fontWeight: 600, fill: "var(--text-mid)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Line chart block ── */
function LineChartBlock({ data = [], dataKey = "value", xKey = "name", title, description }: {
  data?: Array<Record<string, string | number>>;
  dataKey?: string; xKey?: string; title?: string; description?: string;
}) {
  const { ref, busy, download } = useChartDownload(title);
  const gradId = `lg-${title?.replace(/\W/g, "") || "line"}`;
  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data} margin={{ top: 22, right: 8, left: -16, bottom: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1CC5C8" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#1CC5C8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey={dataKey}
              stroke="#1CC5C8" strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={{ fill: "#1CC5C8", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: "#1CC5C8", strokeWidth: 0 }}>
              <LabelList dataKey={dataKey} position="top"
                style={{ fontSize: 11, fontWeight: 600, fill: "var(--text-mid)" }} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Pie chart block ── */
function PieChartBlock({ data = [], title, description, colors }: {
  data?: Array<Record<string, string | number>>;
  title?: string; description?: string; colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const renderLabel = ({ cx, cy, midAngle, outerRadius, value }: {
    cx: number; cy: number; midAngle: number; outerRadius: number; value: number;
  }) => {
    const RAD = Math.PI / 180;
    const r = outerRadius + 22;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    if (pct < 4) return null; // skip tiny slices
    return (
      <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central"
        style={{ fontSize: 11, fontWeight: 600, fill: "var(--text-mid)" }}>
        {pct}%
      </text>
    );
  };
  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={data} cx="50%" cy="47%" innerRadius={56} outerRadius={88}
              paddingAngle={3} dataKey="value"
              label={renderLabel} labelLine={{ stroke: "var(--border)", strokeWidth: 1 }}>
              {data.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
            </Pie>
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }}
              formatter={(v) => <span style={{ color: "var(--text-mid)", fontSize: 11 }}>{v}</span>} />
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Radar chart block ── */
function RadarChartBlock({
  data = [],
  axisKey = "axis",
  dataKey = "value",
  series,
  title,
  description,
  colors,
}: {
  data?: Array<Record<string, string | number>>;
  axisKey?: string;
  dataKey?: string;
  series?: ChartSeries[];
  title?: string;
  description?: string;
  colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);
  const resolvedSeries: ChartSeries[] =
    series && series.length > 0
      ? series
      : [{ key: dataKey, label: title || "Value", color: c[0] }];
  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} margin={{ top: 16, right: 24, left: 24, bottom: 8 }}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey={axisKey} tick={{ fontSize: 11, fill: "var(--muted)" }} />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} />
            {resolvedSeries.map((s, i) => (
              <Radar
                key={s.key}
                name={s.label || s.key}
                dataKey={s.key}
                stroke={s.color || c[i % c.length]}
                fill={s.color || c[i % c.length]}
                fillOpacity={0.25}
                strokeWidth={2}
              />
            ))}
            {resolvedSeries.length > 1 && (
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ color: "var(--text-mid)", fontSize: 11 }}>{v}</span>} />
            )}
            <Tooltip content={<ChartTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Scatter chart block ── */
function ScatterChartBlock({
  data = [],
  xKey = "x",
  yKey = "y",
  labelKey,
  xLabel,
  yLabel,
  title,
  description,
  colors,
}: {
  data?: Array<Record<string, string | number>>;
  xKey?: string;
  yKey?: string;
  labelKey?: string;
  xLabel?: string;
  yLabel?: string;
  title?: string;
  description?: string;
  colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);
  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 16, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey={xKey}
              name={xLabel || xKey}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
              label={xLabel ? { value: xLabel, position: "insideBottom", offset: -8, style: { fontSize: 11, fill: "var(--muted)" } } : undefined}
            />
            <YAxis
              type="number"
              dataKey={yKey}
              name={yLabel || yKey}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
              label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "var(--muted)", textAnchor: "middle" } } : undefined}
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Record<string, string | number>;
                return (
                  <div className="rounded-xl px-3 py-2.5 text-xs shadow-lg"
                    style={{ background: "var(--navy)", color: "white", minWidth: 100 }}>
                    {labelKey && p[labelKey] != null && (
                      <p className="font-semibold mb-1" style={{ color: "var(--teal-mid)" }}>{String(p[labelKey])}</p>
                    )}
                    <p>{xLabel || xKey}: <strong>{String(p[xKey])}</strong></p>
                    <p>{yLabel || yKey}: <strong>{String(p[yKey])}</strong></p>
                  </div>
                );
              }}
            />
            <Scatter data={data} fill={c[0]}>
              {data.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Stacked / grouped bar block ── */
function MultiBarBlock({
  data = [],
  xKey = "name",
  series = [],
  stacked = false,
  title,
  description,
  colors,
}: {
  data?: Array<Record<string, string | number>>;
  xKey?: string;
  series?: ChartSeries[];
  stacked?: boolean;
  title?: string;
  description?: string;
  colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);
  const resolvedSeries: ChartSeries[] =
    series && series.length > 0
      ? series
      : Object.keys(data[0] || {}).filter((k) => k !== xKey).map((k) => ({ key: k, label: k }));
  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 22, right: 8, left: -16, bottom: 4 }} barSize={stacked ? 32 : 18}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(28,197,200,0.06)" }} />
            <Legend iconType="circle" iconSize={8}
              formatter={(v) => <span style={{ color: "var(--text-mid)", fontSize: 11 }}>{v}</span>} />
            {resolvedSeries.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label || s.key}
                fill={s.color || c[i % c.length]}
                stackId={stacked ? "stack" : undefined}
                radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Area chart block ── */
function AreaChartBlock({
  data = [],
  xKey = "name",
  series,
  dataKey = "value",
  title,
  description,
  colors,
}: {
  data?: Array<Record<string, string | number>>;
  xKey?: string;
  series?: ChartSeries[];
  dataKey?: string;
  title?: string;
  description?: string;
  colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);
  const resolvedSeries: ChartSeries[] =
    series && series.length > 0
      ? series
      : [{ key: dataKey, label: title || "Value", color: c[0] }];
  const gradId = `area-${(title || "a").replace(/\W/g, "")}`;
  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 22, right: 8, left: -16, bottom: 4 }}>
            <defs>
              {resolvedSeries.map((s, i) => (
                <linearGradient key={s.key} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color || c[i % c.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color || c[i % c.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            {resolvedSeries.length > 1 && (
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ color: "var(--text-mid)", fontSize: 11 }}>{v}</span>} />
            )}
            {resolvedSeries.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label || s.key}
                stackId={resolvedSeries.length > 1 ? "a" : undefined}
                stroke={s.color || c[i % c.length]}
                strokeWidth={2}
                fill={`url(#${gradId}-${i})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Heatmap block (custom SVG) ── */
function HeatmapBlock({
  xAxis = [],
  yAxis = [],
  cells = [],
  valueRange,
  colorScale,
  title,
  description,
}: {
  xAxis?: string[];
  yAxis?: string[];
  cells?: HeatmapCell[];
  valueRange?: [number, number];
  colorScale?: string[];
  title?: string;
  description?: string;
}) {
  const { ref, busy, download } = useChartDownload(title);
  const [hover, setHover] = useState<{ x: number; y: number; value: number; mx: number; my: number } | null>(null);
  const scale = colorScale && colorScale.length >= 2 ? colorScale : ["#EF4444", "#F59E0B", "#1CC5C8"];
  const values = cells.map((c) => c.value);
  const vMin = valueRange?.[0] ?? (values.length ? Math.min(...values) : 0);
  const vMax = valueRange?.[1] ?? (values.length ? Math.max(...values) : 100);

  const interp = (v: number): string => {
    if (vMax === vMin) return scale[Math.floor(scale.length / 2)];
    const t = Math.max(0, Math.min(1, (v - vMin) / (vMax - vMin)));
    const seg = t * (scale.length - 1);
    const idx = Math.floor(seg);
    const frac = seg - idx;
    const a = hexToRgb(scale[idx]);
    const b = hexToRgb(scale[Math.min(idx + 1, scale.length - 1)]);
    const mix = (ca: number, cb: number) => Math.round(ca + (cb - ca) * frac);
    return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
  };

  const cellW = 26;
  const cellH = 18;
  const leftPad = 96;
  const topPad = 60;
  const width = leftPad + xAxis.length * cellW + 12;
  const height = topPad + yAxis.length * cellH + 8;

  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <div style={{ overflow: "auto", maxHeight: 420, position: "relative" }}
          onMouseLeave={() => setHover(null)}>
          <svg width={width} height={height} style={{ fontFamily: "DM Sans, sans-serif" }}>
            {xAxis.map((x, i) => (
              <text
                key={`x-${i}`}
                x={leftPad + i * cellW + cellW / 2}
                y={topPad - 8}
                textAnchor="start"
                transform={`rotate(-45, ${leftPad + i * cellW + cellW / 2}, ${topPad - 8})`}
                style={{ fontSize: 10, fill: "var(--muted)" }}
              >
                {x.length > 18 ? x.slice(0, 16) + "…" : x}
              </text>
            ))}
            {yAxis.map((y, i) => (
              <text
                key={`y-${i}`}
                x={leftPad - 6}
                y={topPad + i * cellH + cellH / 2 + 3}
                textAnchor="end"
                style={{ fontSize: 10, fill: "var(--muted)" }}
              >
                {y.length > 12 ? y.slice(0, 10) + "…" : y}
              </text>
            ))}
            {cells.map((cell, i) => (
              <rect
                key={i}
                x={leftPad + cell.x * cellW}
                y={topPad + cell.y * cellH}
                width={cellW - 1}
                height={cellH - 1}
                fill={interp(cell.value)}
                rx={2}
                onMouseMove={(e) => setHover({
                  x: cell.x, y: cell.y, value: cell.value,
                  mx: e.nativeEvent.offsetX, my: e.nativeEvent.offsetY,
                })}
              />
            ))}
          </svg>
          {hover && (
            <div
              style={{
                position: "absolute",
                left: Math.min(hover.mx + 12, width - 180),
                top: Math.max(hover.my - 40, 4),
                background: "var(--navy)",
                color: "white",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 11,
                pointerEvents: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                zIndex: 2,
              }}
            >
              <div style={{ color: "var(--teal-mid)", fontWeight: 600 }}>{yAxis[hover.y]}</div>
              <div>{xAxis[hover.x]}</div>
              <div><strong>{hover.value}</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const f = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(f, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/* ── Boxplot block (custom SVG) ── */
function BoxplotBlock({
  data = [],
  title,
  description,
  colors,
}: {
  data?: BoxplotDatum[];
  title?: string;
  description?: string;
  colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);

  const all = data.flatMap((d) => [d.min, d.max, ...(d.outliers || [])]);
  const vMin = all.length ? Math.min(...all) : 0;
  const vMax = all.length ? Math.max(...all) : 100;
  const pad = (vMax - vMin) * 0.05 || 5;
  const yMin = vMin - pad;
  const yMax = vMax + pad;

  const width = Math.max(data.length * 70 + 64, 360);
  const height = 260;
  const leftPad = 40;
  const bottomPad = 40;
  const topPad = 16;
  const plotH = height - topPad - bottomPad;
  const plotW = width - leftPad - 16;
  const boxW = Math.min(36, (plotW / Math.max(1, data.length)) * 0.6);

  const yScale = (v: number) => topPad + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const ticks = [yMin, yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.75, yMax];

  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{description}</p>}
        <div style={{ overflowX: "auto" }}>
          <svg width={width} height={height} style={{ fontFamily: "DM Sans, sans-serif" }}>
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={leftPad} x2={width - 16} y1={yScale(t)} y2={yScale(t)}
                  stroke="var(--border)" strokeDasharray="2 4" />
                <text x={leftPad - 6} y={yScale(t) + 3} textAnchor="end"
                  style={{ fontSize: 10, fill: "var(--muted)" }}>{Math.round(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = leftPad + (i + 0.5) * (plotW / data.length);
              const color = c[i % c.length];
              const yQ1 = yScale(d.q1);
              const yQ3 = yScale(d.q3);
              const yMed = yScale(d.median);
              const yMinP = yScale(d.min);
              const yMaxP = yScale(d.max);
              return (
                <g key={i}>
                  <line x1={cx} x2={cx} y1={yMaxP} y2={yMinP} stroke={color} strokeWidth={1.5} />
                  <line x1={cx - 8} x2={cx + 8} y1={yMaxP} y2={yMaxP} stroke={color} strokeWidth={1.5} />
                  <line x1={cx - 8} x2={cx + 8} y1={yMinP} y2={yMinP} stroke={color} strokeWidth={1.5} />
                  <rect x={cx - boxW / 2} y={yQ3} width={boxW} height={Math.max(2, yQ1 - yQ3)}
                    fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} rx={3} />
                  <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yMed} y2={yMed}
                    stroke={color} strokeWidth={2.5} />
                  {(d.outliers || []).map((o, oi) => (
                    <circle key={oi} cx={cx} cy={yScale(o)} r={3}
                      fill="white" stroke={color} strokeWidth={1.5} />
                  ))}
                  <text x={cx} y={height - bottomPad + 16} textAnchor="middle"
                    style={{ fontSize: 10, fill: "var(--muted)" }}>
                    {d.name.length > 12 ? d.name.slice(0, 10) + "…" : d.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Gauge / progress-ring block ── */
function GaugeBlock({
  value = 0,
  max = 100,
  unit = "%",
  title,
  description,
  colors,
}: {
  value?: number;
  max?: number;
  unit?: string;
  title?: string;
  description?: string;
  colors?: string[];
}) {
  const c = (colors && colors[0]) || "#1CC5C8";
  const { ref, busy, download } = useChartDownload(title);
  const size = 180;
  const r = 70;
  const stroke = 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // half circle
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));

  return (
    <div ref={ref} className="rounded-2xl rounded-tl-sm px-4 py-4 ai-msg" style={CARD_STYLE}>
      <DownloadButton tooltip="Download PNG" onClick={download} busy={busy} />
      <div className="w-full flex flex-col items-center">
        {title && <p className="text-xs font-semibold mb-0.5 uppercase tracking-widest self-start"
          style={{ color: "var(--muted)", paddingRight: 28 }}>{title}</p>}
        {description && <p className="text-xs mb-2 self-start" style={{ color: "var(--muted)" }}>{description}</p>}
        <svg width={size} height={size * 0.66} viewBox={`0 0 ${size} ${size * 0.66}`}>
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={c}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${pct * circumference} ${circumference}`}
          />
          <text x={cx} y={cy - 4} textAnchor="middle"
            style={{ fontSize: 26, fontWeight: 700, fill: "var(--text-dark, #1A2537)" }}>
            {Math.round(value)}{unit}
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ── Unsupported-type fallback ── */
function UnsupportedBlock({ type }: { type: string }) {
  return (
    <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 ai-msg" style={CARD_STYLE}>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Unsupported chart type: <code>{type}</code>. The AI generated a chart format this version can&apos;t render yet.
      </p>
    </div>
  );
}

/* ── Typing indicator ── */
export function TypingBubble() {
  return (
    <div className="flex items-start gap-3 fade-in">
      <AiAvatar />
      <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 ai-msg"
        style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <div className="flex items-center gap-1.5 px-1 py-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="dot-pulse inline-block rounded-full"
              style={{ width: 7, height: 7, background: "var(--teal)", animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="flex-shrink-0 flex items-center justify-center rounded-xl"
      style={{ width: 32, height: 32, background: "white", border: "1.5px solid var(--border)", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/toki.png" alt="TOKI" style={{ width: 24, height: 24, objectFit: "contain" }} />
    </div>
  );
}

/* ── Main message component ── */
export function ChatMessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end fade-up">
        <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[68%]"
          style={{ background: "var(--navy)", color: "rgba(255,255,255,0.92)", lineHeight: 1.65, fontWeight: 400 }}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att, i) =>
                att.mimeType.startsWith("image/") && att.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={att.preview} alt={att.name}
                    style={{ maxHeight: 140, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                ) : (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "DM Sans, sans-serif" }}>{att.name}</span>
                  </div>
                )
              )}
            </div>
          )}
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 fade-up">
      <AiAvatar />
      <div className="flex-1 flex flex-col gap-2.5" style={{ maxWidth: "calc(100% - 44px)" }}>
        {message.blocks?.map((block, i) => {
          if (block.type === "text" && block.content)
            return <TextBlock key={i} content={block.content} />;

          if (block.type === "table")
            return <TableBlock key={i} columns={block.columns} rows={block.rows} title={block.title} />;

          if (block.type === "bar_chart")
            return <BarChartBlock key={i} data={block.data} dataKey={block.dataKey} xKey={block.xKey}
              title={block.title} description={block.description} colors={block.colors} />;

          if (block.type === "line_chart")
            return <LineChartBlock key={i} data={block.data} dataKey={block.dataKey} xKey={block.xKey}
              title={block.title} description={block.description} />;

          if (block.type === "pie_chart")
            return <PieChartBlock key={i} data={block.data} title={block.title}
              description={block.description} colors={block.colors} />;

          if (block.type === "radar_chart")
            return <RadarChartBlock key={i} data={block.data} axisKey={block.axisKey}
              dataKey={block.dataKey} series={block.series} title={block.title}
              description={block.description} colors={block.colors} />;

          if (block.type === "scatter_chart")
            return <ScatterChartBlock key={i} data={block.data} xKey={block.xKey}
              yKey={block.yKey} labelKey={block.labelKey} xLabel={block.xLabel}
              yLabel={block.yLabel} title={block.title} description={block.description}
              colors={block.colors} />;

          if (block.type === "stacked_bar_chart")
            return <MultiBarBlock key={i} data={block.data} xKey={block.xKey}
              series={block.series} stacked title={block.title}
              description={block.description} colors={block.colors} />;

          if (block.type === "grouped_bar_chart")
            return <MultiBarBlock key={i} data={block.data} xKey={block.xKey}
              series={block.series} stacked={false} title={block.title}
              description={block.description} colors={block.colors} />;

          if (block.type === "heatmap")
            return <HeatmapBlock key={i} xAxis={block.xAxis} yAxis={block.yAxis}
              cells={block.cells} valueRange={block.valueRange} colorScale={block.colorScale}
              title={block.title} description={block.description} />;

          if (block.type === "boxplot")
            return <BoxplotBlock key={i} data={block.data as unknown as BoxplotDatum[]}
              title={block.title} description={block.description} colors={block.colors} />;

          if (block.type === "area_chart")
            return <AreaChartBlock key={i} data={block.data} xKey={block.xKey}
              series={block.series} dataKey={block.dataKey} title={block.title}
              description={block.description} colors={block.colors} />;

          if (block.type === "gauge")
            return <GaugeBlock key={i} value={block.value} max={block.max}
              unit={block.unit} title={block.title} description={block.description}
              colors={block.colors} />;

          return <UnsupportedBlock key={i} type={String(block.type)} />;
        })}
      </div>
    </div>
  );
}
