"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface FilterValue {
  dateFrom?: string;
  dateTo?: string;
  students?: string[];
  lessons?: string[];
}

export interface FilterMetadata {
  students: string[];
  lessons: string[];
  dateRange: { from: string; to: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  metadata: FilterMetadata;
  value: FilterValue;
  onApply: (v: FilterValue) => void;
}

const TEAL = "#1CC5C8";
const BORDER = "#E3E8EF";
const MUTED = "#8896AB";
const TEXT = "#1A2537";

export default function FilterPanel({ open, onClose, anchorRef, metadata, value, onApply }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Working copy — only committed on Apply
  const [dateFrom, setDateFrom] = useState(value.dateFrom || "");
  const [dateTo, setDateTo] = useState(value.dateTo || "");
  const [students, setStudents] = useState<string[]>(value.students || []);
  const [lessons, setLessons] = useState<string[]>(value.lessons || []);
  const [studentQuery, setStudentQuery] = useState("");
  const [lessonQuery, setLessonQuery] = useState("");

  // Viewport-relative position, calculated when panel opens
  const [pos, setPos] = useState({ top: 0, right: 0 });

  // Reset working copy + recalculate position when panel opens
  useEffect(() => {
    if (open) {
      setDateFrom(value.dateFrom || "");
      setDateTo(value.dateTo || "");
      setStudents(value.students || []);
      setLessons(value.lessons || []);
      setStudentQuery("");
      setLessonQuery("");

      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setPos({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        });
      }
    }
  }, [open, value, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const filteredStudents = metadata.students.filter((s) =>
    s.toLowerCase().includes(studentQuery.toLowerCase())
  );
  const filteredLessons = metadata.lessons.filter((l) =>
    l.toLowerCase().includes(lessonQuery.toLowerCase())
  );

  const toggleStudent = (id: string) =>
    setStudents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleLesson = (title: string) =>
    setLessons((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]
    );

  const handleClearAll = () => {
    setDateFrom("");
    setDateTo("");
    setStudents([]);
    setLessons([]);
  };

  const handleApply = () => {
    onApply({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      students: students.length ? students : undefined,
      lessons: lessons.length ? lessons : undefined,
    });
    onClose();
  };

  const inputBase: React.CSSProperties = {
    fontFamily: "DM Sans, sans-serif",
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: "white",
    color: TEXT,
    outline: "none",
    width: "100%",
  };

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        width: 340,
        maxHeight: "min(460px, calc(100vh - " + pos.top + "px - 16px))",
        background: "white",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: "-0.2px" }}>
          Scope AI conversation
        </h3>
        <button
          onClick={onClose}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            color: MUTED,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body (scrollable) */}
      <div style={{ padding: "12px 16px", overflowY: "auto", flex: 1 }}>
        {/* Date range */}
        <Section
          title="Date range"
          action={
            dateFrom || dateTo ? (
              <LinkBtn onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</LinkBtn>
            ) : null
          }
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="date"
              value={dateFrom}
              min={metadata.dateRange.from || undefined}
              max={metadata.dateRange.to || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputBase}
            />
            <span style={{ color: MUTED, fontSize: 11 }}>→</span>
            <input
              type="date"
              value={dateTo}
              min={metadata.dateRange.from || undefined}
              max={metadata.dateRange.to || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputBase}
            />
          </div>
          {metadata.dateRange.from && (
            <p style={{ fontSize: 10.5, color: MUTED, margin: "6px 0 0" }}>
              Data available: {metadata.dateRange.from} → {metadata.dateRange.to}
            </p>
          )}
        </Section>

        {/* Students */}
        <Section
          title={`Students${students.length ? ` · ${students.length} selected` : ""}`}
          action={
            students.length ? (
              <LinkBtn onClick={() => setStudents([])}>Clear</LinkBtn>
            ) : null
          }
        >
          <input
            type="text"
            placeholder="Search student ID…"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            style={{ ...inputBase, marginBottom: 6 }}
          />
          <div
            style={{
              maxHeight: 128,
              overflowY: "auto",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              background: "#FAFBFC",
            }}
          >
            {filteredStudents.length === 0 ? (
              <p style={{ padding: 10, fontSize: 11, color: MUTED, margin: 0 }}>No matches.</p>
            ) : (
              filteredStudents.map((id) => (
                <CheckRow
                  key={id}
                  label={id}
                  checked={students.includes(id)}
                  onToggle={() => toggleStudent(id)}
                />
              ))
            )}
          </div>
        </Section>

        {/* Lessons */}
        <Section
          title={`Lessons${lessons.length ? ` · ${lessons.length} selected` : ""}`}
          action={
            lessons.length ? <LinkBtn onClick={() => setLessons([])}>Clear</LinkBtn> : null
          }
        >
          <input
            type="text"
            placeholder="Search lesson title…"
            value={lessonQuery}
            onChange={(e) => setLessonQuery(e.target.value)}
            style={{ ...inputBase, marginBottom: 6 }}
          />
          <div
            style={{
              maxHeight: 140,
              overflowY: "auto",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              background: "#FAFBFC",
            }}
          >
            {filteredLessons.length === 0 ? (
              <p style={{ padding: 10, fontSize: 11, color: MUTED, margin: 0 }}>No matches.</p>
            ) : (
              filteredLessons.map((title) => (
                <CheckRow
                  key={title}
                  label={title}
                  checked={lessons.includes(title)}
                  onToggle={() => toggleLesson(title)}
                />
              ))
            )}
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#FAFBFC",
          flexShrink: 0,
        }}
      >
        <LinkBtn onClick={handleClearAll}>Clear all</LinkBtn>
        <button
          onClick={handleApply}
          style={{
            background: TEAL,
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "7px 18px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            letterSpacing: "-0.1px",
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onPointerDown={onClose}
      />
      {panel}
    </>,
    document.body
  );
}

/* ── Section header ── */
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── "Clear" inline link ── */
function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: TEAL,
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        padding: 0,
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

/* ── Checkbox row ── */
function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        cursor: "pointer",
        fontSize: 11.5,
        color: TEXT,
        transition: "background 0.12s",
        background: hover ? "#F2F4F7" : "transparent",
        width: "100%",
        border: "none",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          border: `1.5px solid ${checked ? TEAL : "#CBD3DE"}`,
          background: checked ? TEAL : "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.12s, border-color 0.12s",
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {label}
      </span>
    </button>
  );
}
