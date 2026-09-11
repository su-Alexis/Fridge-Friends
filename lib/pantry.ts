import { normalizeIngredient } from "./matching";
import type { Recipe } from "./recipe-schema";

export type PantryItem = { label: string; uses: number };

/**
 * Every refrigerated ingredient in the catalog, commonest first so the ones
 * most likely to be in a fridge are easiest to reach.
 */
export function catalogPantry(recipes: Recipe[]): PantryItem[] {
  const counts = new Map<string, PantryItem>();
  for (const recipe of recipes)
    for (const item of recipe.perishables) {
      const key = normalizeIngredient(item);
      const seen = counts.get(key);
      if (seen) seen.uses += 1;
      else counts.set(key, { label: item, uses: 1 });
    }
  return [...counts.values()].sort(
    (a, b) => b.uses - a.uses || a.label.localeCompare(b.label),
  );
}

/**
 * Ingredients a search term is asking for. Matching is case-insensitive, so
 * "chicken", "Chicken" and "CHICKEN" all find "Cooked chicken". The closest
 * name comes first: an exact hit beats one that merely contains the word.
 */
export function pantryMatches(
  pantry: PantryItem[],
  query: string,
  limit = 2,
): PantryItem[] {
  const term = normalizeIngredient(query);
  if (term.length < 3) return [];
  return pantry
    .filter((item) => normalizeIngredient(item.label).includes(term))
    .sort((a, b) => {
      const exact =
        Number(normalizeIngredient(b.label) === term) -
        Number(normalizeIngredient(a.label) === term);
      return exact || b.uses - a.uses;
    })
    .slice(0, limit);
}
