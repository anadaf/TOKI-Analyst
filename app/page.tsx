"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import { ChatMessageBubble, TypingBubble, Message, ResponseBlock } from "@/components/ChatMessage";
import FilterPanel, { FilterValue, FilterMetadata } from "@/components/FilterPanel";
import SettingsPanel, { AISettings, DEFAULT_SETTINGS } from "@/components/SettingsPanel";

const SUGGESTIONS = [
  "Which students are struggling the most?",
  "Show me the class proficiency breakdown",
  "Which lessons have the lowest scores?",
  "Compare time spent vs scores",
  "Who are the top performers?",
  "Show completion rates by activity type",
  "Which students haven't completed Exit Tickets?",
  "What topics need re-teaching?",
];

interface AttachmentItem {
  name: string;
  mimeType: string;
  data: string;     // raw base64, in-memory only (never persisted)
  preview?: string; // data URL for image thumbnails
}

const EMPTY_METADATA: FilterMetadata = {
  students: [],
  lessons: [],
  dateRange: { from: "", to: "" },
};

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(56);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");

  // CSV state
  const [activeCsv, setActiveCsv] = useState<string | null>(null);
  const [activeCsvName, setActiveCsvName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Filter state
  const [metadata, setMetadata] = useState<FilterMetadata>(EMPTY_METADATA);
  const [filters, setFilters] = useState<FilterValue>({});
  const [filterOpen, setFilterOpen] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>(""); // committed text before current voice session

  /* ── Keep sidebar width in sync ── */
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const sidebar = document.querySelector("aside");
      if (sidebar) setSidebarWidth(sidebar.offsetWidth);
    });
    const sidebar = document.querySelector("aside");
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ["style"] });
      setSidebarWidth(sidebar.offsetWidth);
    }
    return () => observer.disconnect();
  }, []);

  /* ── Restore conversation + CSV filename from localStorage on mount ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("toki-chat-history");
      if (saved) {
        const parsed = JSON.parse(saved);
        const restored = parsed.map((m: Record<string, unknown>) => ({
          ...m,
          timestamp: new Date(m.timestamp as string),
        }));
        setMessages(restored);
      }
    } catch {
      // ignore corrupted storage
    }
    try {
      const name = localStorage.getItem("toki-csv-name");
      if (name) setActiveCsvName(name);
    } catch {
      // ignore
    }
    try {
      const saved = localStorage.getItem("toki-settings");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch {
      // ignore
    }
  }, []);

  /* ── Persist settings ── */
  const handleSettingsChange = (v: AISettings) => {
    setSettings(v);
    try { localStorage.setItem("toki-settings", JSON.stringify(v)); } catch {}
  };

  /* ── Persist conversation ── */
  useEffect(() => {
    if (typeof window === "undefined" || messages.length === 0) return;
    try {
      const toSave = messages.slice(-60).map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          preview: a.preview,
        })),
      }));
      localStorage.setItem("toki-chat-history", JSON.stringify(toSave));
    } catch {
      // ignore quota
    }
  }, [messages]);

  /* ── Check SpeechRecognition support + mic permission ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    setSpeechSupported(supported);
    if (!supported) return;

    // Probe permission (non-blocking, best-effort)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (nav?.permissions?.query) {
      nav.permissions
        .query({ name: "microphone" as PermissionName })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((status: any) => {
          if (status.state === "denied") setMicPermissionDenied(true);
          status.onchange = () => setMicPermissionDenied(status.state === "denied");
        })
        .catch(() => {});
    }
  }, []);

  /* ── Fetch metadata (default CSV or uploaded) ── */
  useEffect(() => {
    let cancelled = false;
    async function loadMetadata() {
      try {
        let res: Response;
        if (activeCsv) {
          res = await fetch("/api/metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csv: activeCsv }),
          });
        } else {
          res = await fetch("/api/metadata");
        }
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMetadata({
          students: data.students || [],
          lessons: data.lessons || [],
          dateRange: data.dateRange || { from: "", to: "" },
        });
      } catch {
        // ignore
      }
    }
    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [activeCsv]);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ── Auto-clear voice error after 4s ── */
  useEffect(() => {
    if (!voiceError) return;
    const t = setTimeout(() => setVoiceError(null), 4000);
    return () => clearTimeout(t);
  }, [voiceError]);

  /* ── Auto-clear CSV error after 4s ── */
  useEffect(() => {
    if (!csvError) return;
    const t = setTimeout(() => setCsvError(null), 4000);
    return () => clearTimeout(t);
  }, [csvError]);

  /* ── Cleanup recognition on unmount ── */
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  /* ── Handlers ── */

  const clearChat = () => {
    setMessages([]);
    setAttachments([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("toki-chat-history");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const isCSV =
        file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

      if (isCSV) {
        // CSV → dataset swap (not a Gemini multimodal attachment)
        ingestCsvFile(file);
        return;
      }

      // PDF / image → existing attachments flow
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const preview = file.type.startsWith("image/") ? dataUrl : undefined;
        setAttachments((prev) => [
          ...prev,
          { name: file.name, mimeType: file.type, data: base64, preview },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const ingestCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (typeof text !== "string" || !text.trim()) {
        setCsvError("CSV appears empty or unreadable.");
        return;
      }
      const firstLine = text.split(/\r?\n/)[0] || "";
      if (!firstLine.includes(",")) {
        setCsvError("CSV must have comma-separated headers.");
        return;
      }
      setActiveCsv(text);
      setActiveCsvName(file.name);
      setFilters({}); // stale filters wouldn't match new CSV
      if (typeof window !== "undefined") {
        try { localStorage.setItem("toki-csv-name", file.name); } catch {}
      }
    };
    reader.onerror = () => setCsvError("Could not read file.");
    reader.readAsText(file);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetCsv = () => {
    setActiveCsv(null);
    setActiveCsvName(null);
    setFilters({});
    if (typeof window !== "undefined") {
      try { localStorage.removeItem("toki-csv-name"); } catch {}
    }
  };

  /* ── Voice (continuous + interim + errors) ── */
  const toggleVoice = useCallback(() => {
    if (!speechSupported || micPermissionDenied) return;

    // Stop if already listening
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
      setInterimTranscript("");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    baseInputRef.current = input;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let finalChunk = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript as string;
        if (res.isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) {
        const newBase = baseInputRef.current
          ? baseInputRef.current.trimEnd() + " " + finalChunk.trim()
          : finalChunk.trim();
        baseInputRef.current = newBase;
        setInput(newBase);
      }
      setInterimTranscript(interim);

      // Auto-resize textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height =
            Math.min(textareaRef.current.scrollHeight, 120) + "px";
        }
      }, 0);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      const err = e?.error || "unknown";
      if (err === "not-allowed" || err === "service-not-allowed") {
        setMicPermissionDenied(true);
        setVoiceError("Microphone access blocked. Enable it in browser settings.");
      } else if (err === "no-speech") {
        setVoiceError("No speech detected — try again.");
      } else if (err === "audio-capture") {
        setVoiceError("No microphone found.");
      } else if (err !== "aborted") {
        setVoiceError(`Voice input error: ${err}`);
      }
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Could not start voice input.");
      setIsListening(false);
    }
  }, [speechSupported, micPermissionDenied, isListening, input]);

  const stopVoiceIfRunning = () => {
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
      setInterimTranscript("");
    }
  };

  /* ── Filters ── */
  const activeFilterCount =
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.students?.length ? 1 : 0) +
    (filters.lessons?.length ? 1 : 0);

  const removeDateFilter = () =>
    setFilters((p) => ({ ...p, dateFrom: undefined, dateTo: undefined }));
  const removeStudentFilter = () =>
    setFilters((p) => ({ ...p, students: undefined }));
  const removeLessonFilter = () =>
    setFilters((p) => ({ ...p, lessons: undefined }));

  const formatDatePill = () => {
    if (filters.dateFrom && filters.dateTo) return `${filters.dateFrom} → ${filters.dateTo}`;
    if (filters.dateFrom) return `From ${filters.dateFrom}`;
    if (filters.dateTo) return `Until ${filters.dateTo}`;
    return "";
  };

  /* ── Send ── */
  const send = async (text: string) => {
    stopVoiceIfRunning();
    const hasAttachments = attachments.length > 0;
    const textToSend = text.trim() || (hasAttachments ? "Please analyze the attached file(s) and provide insights relevant to my class." : "");
    if (!textToSend || isLoading) return;

    const currentAttachments = [...attachments];
    const userMsg: Message = {
      id: `u${Date.now()}`,
      role: "user",
      text: text.trim() || undefined,
      timestamp: new Date(),
      attachments: currentAttachments.map((a) => ({
        name: a.name,
        mimeType: a.mimeType,
        preview: a.preview,
      })),
    };

    setMessages((p) => [...p, userMsg]);
    setInput("");
    baseInputRef.current = "";
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({
            role: m.role,
            content:
              m.text ||
              m.blocks?.map((b) => b.content || b.title || "").join(" ") ||
              "",
          })),
          attachments: currentAttachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            data: a.data,
          })),
          customCsv: activeCsv || undefined,
          filters: activeFilterCount > 0 ? filters : undefined,
          settings,
        }),
      });
      const data = await res.json();
      setMessages((p) => [
        ...p,
        {
          id: `a${Date.now()}`,
          role: "assistant",
          blocks: data.blocks as ResponseBlock[],
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        {
          id: `e${Date.now()}`,
          role: "assistant",
          blocks: [{ type: "text", content: "Something went wrong. Please try again." }],
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const isEmpty = messages.length === 0;
  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isLoading;
  const csvNeedsReupload = !!activeCsvName && !activeCsv; // restored from localStorage

  return (
    <div style={{ background: "#F2F4F7", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <Sidebar />

      {/* Main content */}
      <div
        className="flex flex-col"
        style={{
          position: "fixed",
          top: 52,
          left: sidebarWidth,
          right: 0,
          bottom: 0,
          transition: "left 0.2s",
        }}
      >
        {/* Control bar: filter/settings/clear + optional CSV & filter pills */}
        <div
          className="flex-shrink-0 flex items-center flex-wrap gap-2"
          style={{
            padding: "8px 28px",
            background: "transparent",
            justifyContent: "flex-end",
          }}
        >
          {/* Filter icon with dynamic badge + panel */}
          <div style={{ position: "relative" }}>
            <button
              ref={filterBtnRef}
              onClick={() => setFilterOpen((v) => !v)}
              title="Scope AI conversation by date, student, or lesson"
              className="relative flex items-center justify-center rounded-xl transition-all"
              style={{
                width: 32,
                height: 32,
                background: filterOpen || activeFilterCount > 0 ? "#E6F9F9" : "#F2F4F7",
                border: `1px solid ${filterOpen || activeFilterCount > 0 ? "#1CC5C8" : "#E3E8EF"}`,
                color: filterOpen || activeFilterCount > 0 ? "#0b8e91" : "#8896AB",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeFilterCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                  style={{ width: 16, height: 16, background: "#1CC5C8", fontSize: 9, fontFamily: "Outfit, sans-serif" }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            <FilterPanel
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              anchorRef={filterBtnRef}
              metadata={metadata}
              value={filters}
              onApply={setFilters}
            />
          </div>

          {/* Settings icon */}
          <div style={{ position: "relative" }}>
            <button
              ref={settingsBtnRef}
              onClick={() => setSettingsOpen((v) => !v)}
              title="AI settings (language, detail level)"
              className="flex items-center justify-center rounded-xl transition-colors"
              style={{
                width: 32, height: 32,
                background: settingsOpen || settings.language !== "English" || settings.detail !== "Standard" ? "#E6F9F9" : "#F2F4F7",
                border: `1px solid ${settingsOpen || settings.language !== "English" || settings.detail !== "Standard" ? "#1CC5C8" : "#E3E8EF"}`,
                color: settingsOpen || settings.language !== "English" || settings.detail !== "Standard" ? "#0b8e91" : "#8896AB",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <SettingsPanel
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              anchorRef={settingsBtnRef}
              value={settings}
              onChange={handleSettingsChange}
            />
          </div>

          {/* Clear conversation — only when messages exist */}
          {!isEmpty && (
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="flex items-center justify-center rounded-xl transition-all"
              style={{ width: 32, height: 32, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#EF4444";
                (e.currentTarget as HTMLElement).style.color = "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                (e.currentTarget as HTMLElement).style.color = "#EF4444";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4.89" />
              </svg>
            </button>
          )}

          {/* CSV chip */}
            {activeCsvName && (
              <div
                className="flex items-center gap-2 rounded-full"
                style={{
                  padding: "4px 4px 4px 10px",
                  background: csvNeedsReupload ? "#FEF3C7" : "#E6F9F9",
                  border: `1px solid ${csvNeedsReupload ? "#F59E0B" : "#1CC5C8"}`,
                  fontSize: 11.5,
                  fontFamily: "DM Sans, sans-serif",
                  color: csvNeedsReupload ? "#92400E" : "#0b8e91",
                  fontWeight: 600,
                }}
                title={csvNeedsReupload ? "CSV data not persisted — re-upload to activate" : "Custom CSV is active for all questions"}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {csvNeedsReupload ? `Re-upload ${activeCsvName}` : activeCsvName}
                </span>
                <button
                  onClick={resetCsv}
                  title="Reset to default CSV"
                  style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(255,255,255,0.6)", border: "none",
                    color: csvNeedsReupload ? "#92400E" : "#0b8e91",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Filter pills */}
            {(filters.dateFrom || filters.dateTo) && (
              <FilterPill label={formatDatePill()} onRemove={removeDateFilter} />
            )}
            {filters.students?.length ? (
              <FilterPill
                label={`${filters.students.length} student${filters.students.length > 1 ? "s" : ""}`}
                onRemove={removeStudentFilter}
              />
            ) : null}
            {filters.lessons?.length ? (
              <FilterPill
                label={`${filters.lessons.length} lesson${filters.lessons.length > 1 ? "s" : ""}`}
                onRemove={removeLessonFilter}
              />
            ) : null}

            {/* CSV error */}
            {csvError && (
              <span
                style={{
                  fontSize: 11.5,
                  color: "#DC2626",
                  fontFamily: "DM Sans, sans-serif",
                  padding: "4px 10px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 999,
                }}
              >
                {csvError}
              </span>
            )}
        </div>

        {/* Chat area */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "#F2F4F7" }}>
          <div
            className="flex-1 overflow-y-auto px-8 py-6 space-y-4"
            style={{
              backgroundImage: "radial-gradient(circle, #D8DCE6 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          >
            {isEmpty ? (
              <WelcomeScreen onSend={send} />
            ) : (
              <>
                {messages.map((m) => <ChatMessageBubble key={m.id} message={m} />)}
                {isLoading && <TypingBubble />}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div
            className="flex-shrink-0 px-8 pb-5 pt-3"
            style={{ background: "white", borderTop: "1px solid #E8ECF0" }}
          >
            {/* Voice error banner */}
            {voiceError && (
              <div
                className="mb-2 rounded-xl px-3 py-2 fade-in"
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#DC2626",
                  fontSize: 12,
                  fontFamily: "DM Sans, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {voiceError}
              </div>
            )}

            {/* Quick chips after first message */}
            {!isEmpty && (
              <div
                className="flex gap-2 mb-3 overflow-x-auto"
                style={{ scrollbarWidth: "none", paddingBottom: 2 }}
              >
                {SUGGESTIONS.slice(0, 5).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={isLoading}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: "#F2F4F7",
                      border: "1px solid #E3E8EF",
                      color: "#8896AB",
                      whiteSpace: "nowrap",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#E6F9F9";
                      (e.currentTarget as HTMLElement).style.borderColor = "#1CC5C8";
                      (e.currentTarget as HTMLElement).style.color = "#0b8e91";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#F2F4F7";
                      (e.currentTarget as HTMLElement).style.borderColor = "#E3E8EF";
                      (e.currentTarget as HTMLElement).style.color = "#8896AB";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Pending attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="relative flex items-center gap-2 rounded-xl"
                    style={{ background: "#F2F4F7", border: "1px solid #E3E8EF", padding: "4px 8px 4px 6px" }}
                  >
                    {att.mimeType.startsWith("image/") && att.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.preview}
                        alt={att.name}
                        style={{ height: 36, width: 36, objectFit: "cover", borderRadius: 6 }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-md"
                        style={{ width: 36, height: 36, background: "#EF4444", color: "white", flexShrink: 0 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                    )}
                    <span
                      className="text-xs truncate"
                      style={{ color: "#4A5568", maxWidth: 100, fontFamily: "DM Sans, sans-serif" }}
                    >
                      {att.name}
                    </span>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="flex items-center justify-center rounded-full"
                      style={{ width: 16, height: 16, background: "#E3E8EF", color: "#8896AB", fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Text input row */}
            <div
              className="flex items-end gap-2 rounded-2xl px-3 py-3"
              style={{
                background: "#F2F4F7",
                border: "1.5px solid #E3E8EF",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              {/* Paperclip / attach button — CSV, PDF, or image */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach CSV, PDF, or image"
                className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all"
                style={{ width: 32, height: 32, color: "#8896AB", background: "transparent" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1CC5C8")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#8896AB")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.pdf,.png,.jpg,.jpeg,.gif,.webp"
                multiple
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <div style={{ flex: 1, position: "relative" }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    baseInputRef.current = e.target.value;
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKey}
                  placeholder={
                    isListening
                      ? "Listening…"
                      : "Ask about your class data… or attach a CSV, PDF, or image"
                  }
                  rows={1}
                  disabled={isLoading}
                  className="w-full resize-none bg-transparent text-sm outline-none"
                  style={{ color: "#1A2537", lineHeight: 1.6, fontFamily: "DM Sans, sans-serif", maxHeight: 120 }}
                  onFocus={(e) => {
                    const wrap = e.currentTarget.parentElement!.parentElement!;
                    wrap.style.borderColor = "#1CC5C8";
                    wrap.style.boxShadow = "0 0 0 3px rgba(28,197,200,0.1)";
                  }}
                  onBlur={(e) => {
                    const wrap = e.currentTarget.parentElement!.parentElement!;
                    wrap.style.borderColor = "#E3E8EF";
                    wrap.style.boxShadow = "none";
                  }}
                />
                {/* Interim transcript preview */}
                {interimTranscript && (
                  <span
                    style={{
                      color: "#8896AB",
                      fontStyle: "italic",
                      fontSize: 13,
                      fontFamily: "DM Sans, sans-serif",
                      marginLeft: input ? 4 : 0,
                      pointerEvents: "none",
                      display: "inline",
                    }}
                  >
                    {input ? " " : ""}{interimTranscript}
                  </span>
                )}
              </div>

              {/* Mic button */}
              {speechSupported && (
                <button
                  onClick={toggleVoice}
                  disabled={isLoading || micPermissionDenied}
                  title={
                    micPermissionDenied
                      ? "Microphone blocked — enable in browser settings"
                      : isListening
                      ? "Stop listening"
                      : "Speak your question"
                  }
                  className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all"
                  style={{
                    width: 34,
                    height: 34,
                    background: isListening ? "#EF4444" : micPermissionDenied ? "#F2F4F7" : "#E3E8EF",
                    color: isListening ? "white" : micPermissionDenied ? "#CBD3DE" : "#8896AB",
                    animation: isListening ? "glow-pulse 1.5s infinite" : "none",
                    transition: "background 0.15s",
                    cursor: micPermissionDenied ? "not-allowed" : "pointer",
                  }}
                >
                  {isListening ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="8" y2="18" />
                      <line x1="12" y1="3" x2="12" y2="21" />
                      <line x1="16" y1="8" x2="16" y2="16" />
                      <line x1="4" y1="10" x2="4" y2="14" />
                      <line x1="20" y1="10" x2="20" y2="14" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
              )}

              {/* Send */}
              <button
                onClick={() => send(input)}
                disabled={!canSend}
                className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all"
                style={{
                  width: 34,
                  height: 34,
                  background: canSend ? "#1CC5C8" : "#E3E8EF",
                  color: canSend ? "white" : "#B0BAC9",
                  transition: "background 0.15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "#C8D0DC", fontFamily: "DM Sans, sans-serif" }}>
              AI can make mistakes!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Filter pill ── */
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full"
      style={{
        padding: "4px 4px 4px 10px",
        background: "#F2F4F7",
        border: "1px solid #CBD3DE",
        fontSize: 11.5,
        fontFamily: "DM Sans, sans-serif",
        color: "#4A5568",
        fontWeight: 500,
      }}
    >
      <span>{label}</span>
      <button
        onClick={onRemove}
        title="Remove filter"
        style={{
          width: 18, height: 18, borderRadius: "50%",
          background: "#E3E8EF", border: "none", color: "#8896AB",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, lineHeight: 1, padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

/* ── Welcome screen ── */
function WelcomeScreen({ onSend }: { onSend: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/toki.png" alt="TOKI" className="mb-4" style={{ width: 80, height: 80, objectFit: "contain" }} />
      <h2 style={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 22, color: "#1A2537", marginBottom: 8, letterSpacing: "-0.4px" }}>
        Hi, I&apos;m TOKI!
      </h2>
      <p className="text-sm max-w-sm mx-auto mb-8" style={{ color: "#8896AB", lineHeight: 1.7 }}>
        Ask anything about your Grade 6 Math class. I&apos;ll analyze the data and respond with insights, tables, and charts.
      </p>

      <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="text-left px-4 py-3 rounded-xl text-sm transition-all"
            style={{
              background: "white",
              border: "1px solid #E3E8EF",
              color: "#4A5568",
              lineHeight: 1.45,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              fontFamily: "DM Sans, sans-serif",
              animationDelay: `${i * 0.05}s`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#E6F9F9";
              (e.currentTarget as HTMLElement).style.borderColor = "#1CC5C8";
              (e.currentTarget as HTMLElement).style.color = "#0b8e91";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "white";
              (e.currentTarget as HTMLElement).style.borderColor = "#E3E8EF";
              (e.currentTarget as HTMLElement).style.color = "#4A5568";
            }}
          >
            <span style={{ color: "#1CC5C8", marginRight: 6 }}>→</span>{s}
          </button>
        ))}
      </div>
    </div>
  );
}
