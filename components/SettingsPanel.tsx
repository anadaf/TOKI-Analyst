"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type OutputLanguage = "English" | "Arabic";
export type DetailLevel = "Brief" | "Standard" | "Detailed";

export interface AISettings {
  language: OutputLanguage;
  detail: DetailLevel;
}

export const DEFAULT_SETTINGS: AISettings = {
  language: "English",
  detail: "Standard",
};

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  value: AISettings;
  onChange: (v: AISettings) => void;
}

const TEAL = "#1CC5C8";
const BORDER = "#E3E8EF";
const MUTED = "#8896AB";
const TEXT = "#1A2537";
const BG = "#FAFBFC";

export default function SettingsPanel({ open, onClose, anchorRef, value, onChange }: Props) {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const set = (patch: Partial<AISettings>) => onChange({ ...value, ...patch });

  const panel = (
    <div
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        width: 280,
        background: "white",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        zIndex: 9999,
        fontFamily: "DM Sans, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: "-0.2px" }}>AI Settings</h3>
        <button
          onClick={onClose}
          style={{ width: 22, height: 22, borderRadius: 6, background: "transparent", border: "none", color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Output Language */}
        <div>
          <Label>Output Language</Label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {(["English", "Arabic"] as OutputLanguage[]).map((lang) => (
              <OptionChip
                key={lang}
                label={lang}
                active={value.language === lang}
                onClick={() => set({ language: lang })}
              />
            ))}
          </div>
        </div>

        {/* Level of Detail */}
        <div>
          <Label>Level of Detail</Label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {(["Brief", "Standard", "Detailed"] as DetailLevel[]).map((d) => (
              <OptionChip
                key={d}
                label={d}
                active={value.detail === d}
                onClick={() => set({ detail: d })}
                description={
                  d === "Brief" ? "Short, key insight only" :
                  d === "Standard" ? "Balanced explanation" :
                  "Full analysis & context"
                }
              />
            ))}
          </div>
        </div>

        {/* Current settings summary */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
          <p style={{ fontSize: 10.5, color: MUTED, margin: 0, lineHeight: 1.6 }}>
            TOKI will respond in <strong style={{ color: TEXT }}>{value.language}</strong> with <strong style={{ color: TEXT }}>{value.detail.toLowerCase()}</strong> detail. Settings apply to the next message.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onPointerDown={onClose} />
      {panel}
    </>,
    document.body
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {children}
    </span>
  );
}

function OptionChip({ label, active, onClick, description }: {
  label: string; active: boolean; onClick: () => void; description?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        padding: "7px 4px",
        borderRadius: 8,
        border: `1.5px solid ${active ? TEAL : hover ? "#CBD3DE" : BORDER}`,
        background: active ? "#E6F9F9" : hover ? "#F7F9FB" : "white",
        color: active ? "#0b8e91" : "#4A5568",
        fontFamily: "DM Sans, sans-serif",
        fontSize: 11.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "all 0.12s",
        textAlign: "center",
      }}
    >
      {label}
    </button>
  );
}
