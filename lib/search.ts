// Words that should also match something else. Someone typing "milk" in a
// recipe app is usually after a milkshake, and most of the catalog's shakes are
// named "... Shake" rather than "... Milkshake", so they would otherwise be
// missed. Keyed on the whole word the user typed, so it stays predictable.
const SYNONYMS: Record<string, readonly string[]> = {
  milk: ["shake"],
  milkshake: ["shake"],
  shake: ["smoothie"],
  smoothie: ["shake"],
};

/**
 * How well `text` answers `query`. 0 means no match.
 *
 * The word actually typed outranks a synonym, so searching "milk" lists the
 * milkshakes first and the other shakes below them, rather than burying every
 * literal match under thirty synonym hits.
 */
export function searchRank(text: string, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const haystack = text.toLowerCase();
  let rank = 0;
  for (const term of terms) {
    if (haystack.includes(term)) rank += 2;
    else if ((SYNONYMS[term] ?? []).some((word) => haystack.includes(word)))
      rank += 1;
    // Every word typed has to match something, directly or by synonym.
    else return 0;
  }
  return rank;
}

/** True when every word typed appears in the text, directly or by synonym. */
export function matchesSearch(text: string, query: string): boolean {
  return searchRank(text, query) > 0;
}
