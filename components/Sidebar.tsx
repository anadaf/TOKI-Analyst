"use client";

// Exact icon color from Alef platform — muted blue-gray, not white
const INACTIVE = "#8896AB";
const ACTIVE   = "#1CC5C8";
const BG       = "#FFFFFF";

const NAV = [
  {
    label: "Dashboard",
    // Calculator-style: 4 boxes with math operators (+, -, ×, ÷)
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="9" height="9" rx="1.5"/>
        <rect x="13" y="2" width="9" height="9" rx="1.5"/>
        <rect x="2" y="13" width="9" height="9" rx="1.5"/>
        <rect x="13" y="13" width="9" height="9" rx="1.5"/>
        {/* Plus */}
        <line x1="6.5" y1="4.5" x2="6.5" y2="8.5"/>
        <line x1="4.5" y1="6.5" x2="8.5" y2="6.5"/>
        {/* Minus */}
        <line x1="15" y1="6.5" x2="21" y2="6.5"/>
        {/* Multiply */}
        <line x1="15.5" y1="15.5" x2="20.5" y2="20.5"/>
        <line x1="20.5" y1="15.5" x2="15.5" y2="20.5"/>
        {/* Divide */}
        <line x1="4" y1="16.5" x2="9" y2="16.5"/>
        <line x1="4" y1="19.5" x2="9" y2="19.5"/>
      </svg>
    ),
    chevron: true,
  },
  {
    label: "Content",
    // Closed book with content lines and bookmark ribbon
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="8" y1="9" x2="16" y2="9"/>
        <line x1="8" y1="13" x2="14" y2="13"/>
      </svg>
    ),
  },
  {
    label: "Classes",
    // Graduation cap
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    label: "Analytics",
    active: true,
    // Combo bar+line chart — bars with trend line on top
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3"  y="14" width="4" height="7" rx="0.5"/>
        <rect x="10" y="9"  width="4" height="12" rx="0.5"/>
        <rect x="17" y="5"  width="4" height="16" rx="0.5"/>
        <polyline points="5 14 12 9 19 5"/>
      </svg>
    ),
  },
  {
    label: "Students",
    // Person presenting at a board
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="7" r="3"/>
        <path d="M2 21v-1a6 6 0 0 1 6-6h0"/>
        <rect x="13" y="9" width="9" height="7" rx="1"/>
        <line x1="17.5" y1="16" x2="17.5" y2="20"/>
        <line x1="15" y1="20" x2="20" y2="20"/>
        <polyline points="15 14 17 12 19 13 21 11"/>
      </svg>
    ),
  },
  {
    label: "Tasks",
    // Checklist — checkmarks on the left, task lines on the right
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 8 9 4"/>
        <polyline points="3 13 5 15 9 11"/>
        <polyline points="3 20 5 22 9 18"/>
        <line x1="12" y1="6"  x2="21" y2="6"/>
        <line x1="12" y1="13" x2="21" y2="13"/>
        <line x1="12" y1="20" x2="21" y2="20"/>
      </svg>
    ),
  },
  {
    label: "Reports",
    // Ascending bar chart — wider bars with rounded tops
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3"  y="15" width="4" height="6" rx="1"/>
        <rect x="10" y="9"  width="4" height="12" rx="1"/>
        <rect x="17" y="4"  width="4" height="17" rx="1"/>
      </svg>
    ),
    chevronFilled: true,
  },
  {
    label: "Settings",
    // Gear
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
      </svg>
    ),
    chevronFilled: true,
  },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        position: "fixed",
        top: 52,
        left: 0,
        bottom: 0,
        width: 56,
        background: BG,
        borderRight: "1px solid #E8ECF0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 50,
      }}
    >
      {/* ▶ Collapse toggle */}
      <div style={{ padding: "10px 0 6px", display: "flex", justifyContent: "center", width: "100%" }}>
        <button
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "#F2F4F7",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: INACTIVE,
            cursor: "pointer",
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          width: "100%",
          padding: "2px 8px",
        }}
      >
        {NAV.map((item) => (
          <button
            key={item.label}
            title={item.label}
            style={{
              position: "relative",
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "none",
              background: item.active ? "rgba(28,197,200,0.12)" : "transparent",
              color: item.active ? ACTIVE : INACTIVE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={e => {
              if (!item.active) {
                (e.currentTarget as HTMLElement).style.color = "#4A5568";
                (e.currentTarget as HTMLElement).style.background = "#F2F4F7";
              }
            }}
            onMouseLeave={e => {
              if (!item.active) {
                (e.currentTarget as HTMLElement).style.color = INACTIVE;
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }
            }}
          >
            {/* Active left-border indicator */}
            {item.active && (
              <span
                style={{
                  position: "absolute",
                  left: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: 20,
                  background: ACTIVE,
                  borderRadius: "0 3px 3px 0",
                }}
              />
            )}

            {item.icon}

            {/* Small outline dropdown chevron (Dashboard) */}
            {item.chevron && (
              <span
                style={{
                  position: "absolute",
                  right: 5,
                  bottom: 6,
                  color: INACTIVE,
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            )}

            {/* Small filled triangle chevron (Reports, Settings) */}
            {item.chevronFilled && (
              <span
                style={{
                  position: "absolute",
                  right: 4,
                  bottom: 7,
                  lineHeight: 1,
                  opacity: 0.6,
                }}
              >
                <svg width="7" height="7" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="0,0 10,0 5,8"/>
                </svg>
              </span>
            )}

          </button>
        ))}
      </nav>

      {/* TD Avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: ACTIVE,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Outfit, sans-serif",
          fontWeight: 700,
          fontSize: 11,
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        TD
      </div>
    </aside>
  );
}
