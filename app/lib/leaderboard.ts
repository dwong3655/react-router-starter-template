// app/lib/leaderboard.ts
//
// Computes the "Top Posters" leaderboard from the same `items` array
// home.tsx's loader already builds for "Recent Creations" (already
// filtered to customMetadata.status === "approved", excludes updates/).
// No extra R2 calls needed.

export interface ArtItemForLeaderboard {
  artist: string;
  uploadedAt: string; // ISO string, as produced by obj.uploaded.toISOString()
}

export interface LeaderboardEntry {
  artist: string;
  count: number;
  mostRecent: number; // epoch ms, for tie-break sorting only
}

/**
 * Build the top-N posters leaderboard from an already-approved item list.
 *
 * - Groups by artist name (trimmed exact match — see note in
 *   HOME_TSX_CHANGES.md about name-consistency across uploads).
 * - Sorts by count desc; ties broken by most recent post desc.
 */
export function computeTopPosters(
  items: ArtItemForLeaderboard[],
  topN: number = 5
): LeaderboardEntry[] {
  const byArtist = new Map<string, LeaderboardEntry>();

  for (const item of items) {
    // "Unknown" already covers missing artist (set in the loader's ?? fallback),
    // but trim here too in case of stray whitespace-only values.
    const artist = item.artist?.trim() || "Unknown";
    const ts = Date.parse(item.uploadedAt);
    const safeTs = Number.isNaN(ts) ? 0 : ts;

    const existing = byArtist.get(artist);
    if (existing) {
      existing.count += 1;
      if (safeTs > existing.mostRecent) existing.mostRecent = safeTs;
    } else {
      byArtist.set(artist, { artist, count: 1, mostRecent: safeTs });
    }
  }

  return Array.from(byArtist.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.mostRecent - a.mostRecent; // more recent wins tie
    })
    .slice(0, topN);
}
