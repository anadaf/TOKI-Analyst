"use client";

import { useRef, useState } from "react";
import {
  BarChart, Bar, AreaChart, Area,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { tableToCSV, downloadElementAsPng } from "@/lib/export";

export type MessageRole = "user" | "assistant";

export interface ResponseBlock {
  type: "text" | "table" | "bar_chart" | "line_chart" | "pie_chart";
  content?: string;
  columns?: string[];
  rows?: (string | number)[][];
  data?: { name: string; value: number; [key: string]: string | number }[];
  dataKey?: string;
  xKey?: string;
  title?: string;
  description?: string;
  colors?: string[];
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

/* ── Text block ── */
function TextBlock({ content }: { content: string }) {
  return (
    <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 ai-msg" style={CARD_STYLE}>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-mid)", whiteSpace: "pre-wrap" }}>
        {content}
      </p>
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
  data?: { name: string; value: number; [key: string]: string | number }[];
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
  data?: { name: string; value: number; [key: string]: string | number }[];
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
  data?: { name: string; value: number; [key: string]: string | number }[];
  title?: string; description?: string; colors?: string[];
}) {
  const c = colors || PALETTE;
  const { ref, busy, download } = useChartDownload(title);
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
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

          return null;
        })}
      </div>
    </div>
  );
}
