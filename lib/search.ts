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

/** True when every word typed appears in the text, directly or by synonym. */
export function matchesSearch(text: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = text.toLowerCase();
  return terms.every((term) =>
    [term, ...(SYNONYMS[term] ?? [])].some((word) => haystack.includes(word)),
  );
}
