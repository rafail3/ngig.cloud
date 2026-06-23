// Lightweight fuzzy matcher for client-side, single-folder file/folder search.
// No dependency: a folder rarely holds enough items for this to matter for perf,
// and a subsequence match is what users expect from "modern" search ("rdme" →
// "README.md"). Higher score = better match; -1 means no match.

export function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qi = 0;
  let score = 0;
  let streak = 0;
  let prev = -1; // index in `t` of the previously matched char

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;

    let bonus = 1;
    // Consecutive matches read as a real substring — reward them, growing.
    if (prev === ti - 1) {
      streak++;
      bonus += streak * 4;
    } else {
      streak = 0;
    }
    // Matching at a word boundary (start, or after a separator) is meaningful.
    if (ti === 0 || /[\s._\-/]/.test(t[ti - 1])) bonus += 10;
    // Slight preference for matches near the start of the name.
    if (ti < 4) bonus += 4 - ti;

    score += bonus;
    prev = ti;
    qi++;
  }

  // Only a hit if every query char was consumed (full subsequence).
  return qi === q.length ? score : -1;
}

/** Convenience predicate: does `text` fuzzy-match `query`? */
export function fuzzyMatch(query: string, text: string): boolean {
  return fuzzyScore(query, text) >= 0;
}
