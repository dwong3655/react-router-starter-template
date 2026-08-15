// app/components/TopPosters.tsx
//
// Sidebar "Top Posters" leaderboard card. Renders up to 5 artists ranked
// by approved-piece count, each as a horizontal bar sized relative to
// the #1 poster's count. Styled to match home.tsx's COLORS palette.
//
// Usage in home.tsx:
//   import { TopPosters } from "../components/TopPosters";
//   ...
//   <TopPosters entries={topPosters} />

import type { LeaderboardEntry } from "../lib/leaderboard";

interface TopPostersProps {
  entries: LeaderboardEntry[];
}

// Mirrors the COLORS object in home.tsx. Kept local (rather than imported)
// since home.tsx doesn't currently export COLORS — see HOME_TSX_CHANGES.md
// if you'd rather export it and import here instead of duplicating.
const COLORS = {
  bg: "#0A0A0A",
  bgPanel: "#1A1A1A",
  violet: "#FACC15",
  text: "#FFFFFF",
  textDim: "#9CA3AF",
  border: "#2E2E2E",
};

const RANK_BAR_COLORS = [
  COLORS.violet, // 1st — full accent
  "#E5BB14",
  "#CBA412",
  "#B18D10",
  "#97770E",
];

export function TopPosters({ entries }: TopPostersProps) {
  if (!entries || entries.length === 0) {
    return null; // nothing to show yet — don't render an empty card
  }

  const maxCount = entries[0].count;

  return (
    <div
      style={{
        background: COLORS.bgPanel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding: 28,
      }}
    >
      <h3
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          color: COLORS.text,
          fontSize: 16,
          margin: "0 0 20px 0",
          letterSpacing: 0.3,
        }}
      >
        Top Posters
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {entries.map((entry, i) => {
          const widthPct = Math.max((entry.count / maxCount) * 100, 8); // min width so bar stays visible at low counts
          return (
            <div key={entry.artist}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    color: COLORS.text,
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={entry.artist}
                >
                  #{i + 1} {entry.artist}
                </span>
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    color: COLORS.textDim,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {entry.count} {entry.count === 1 ? "piece" : "pieces"}
                </span>
              </div>
              <div
                style={{
                  background: COLORS.bg,
                  borderRadius: 4,
                  height: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: RANK_BAR_COLORS[i] ?? COLORS.violet,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
