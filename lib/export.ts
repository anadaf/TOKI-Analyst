/* ─────────────────── Download helpers ───────────────────
 * Client-side only. Used by ChatMessage blocks to let teachers
 * download generated tables as CSV and charts as PNG.
 * ─────────────────────────────────────────────────────────── */

export function safeFilename(name: string | undefined, fallback: string): string {
  const base = (name?.trim() || fallback)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-");
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${base}-${date}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Serialise columns+rows to a CSV string (RFC 4180-style quoting) and
 * trigger a browser download. Prepends BOM so Excel opens UTF-8 correctly.
 */
export function tableToCSV(
  columns: string[],
  rows: (string | number)[][],
  title?: string
) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    columns.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, `${safeFilename(title, "table")}.csv`);
}

/**
 * Capture a DOM subtree as a PNG via html-to-image and trigger a download.
 * Uses dynamic import so html-to-image never lands in the server bundle.
 */
export async function downloadElementAsPng(node: HTMLElement, title?: string) {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
  const blob = await (await fetch(dataUrl)).blob();
  triggerDownload(blob, `${safeFilename(title, "chart")}.png`);
}
