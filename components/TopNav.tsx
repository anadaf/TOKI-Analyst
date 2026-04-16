"use client";

export default function TopNav() {
  return (
    <header
      className="fixed top-0 left-0 right-0 flex items-center z-50"
      style={{
        height: 52,
        background: "white",
        borderBottom: "1px solid #E8ECF0",
        paddingLeft: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 56,
          height: 52,
          borderRight: "1px solid #E8ECF0",
        }}
      >
        {/* Alef logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/alef-logo.png" alt="Alef" style={{ width: 34, height: 34, objectFit: "contain" }} />
      </div>

      {/* Nav tabs */}
      <nav className="flex items-center h-full flex-1 px-2">
        {["Home", "Classes", "Task Center"].map((tab) => (
          <button
            key={tab}
            className="h-full px-5 text-sm font-medium transition-colors relative"
            style={{
              color: tab === "Classes" ? "#1CC5C8" : "#8896AB",
              borderBottom: tab === "Classes" ? "2px solid #1CC5C8" : "2px solid transparent",
              fontFamily: "DM Sans, sans-serif",
              background: "none",
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 pr-5">
        {/* Mail */}
        <button
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ width: 34, height: 34, color: "#8896AB" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </button>

        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full font-bold"
          style={{
            width: 34,
            height: 34,
            background: "#1CC5C8",
            color: "white",
            fontSize: 13,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          TD
        </div>
      </div>
    </header>
  );
}
