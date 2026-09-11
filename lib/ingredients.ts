import { recipes, type Recipe } from "./recipes";
import {
  parseIngredient,
  factor,
  formatNumber,
  type GroceryEntry,
} from "./measurements";
export * from "./measurements";

function groceryName(item: string): string {
  const value = item.replace(/,?\s*divided/gi, "").trim();
  // The catalog says "cooked chicken"; fold a personal recipe's canned wording
  // into the same name so both land on one grocery line.
  if (/^(?:drained )?canned chicken\b/i.test(value)) return "cooked chicken";
  if (/^fat-free fairlife milk$/i.test(value)) return "Fat-free Fairlife milk";
  if (/^0% greek yogurt$/i.test(value)) return "0% Greek yogurt";
  if (/^fat-free (?:shredded )?cheddar$/i.test(value))
    return "Fat-free cheddar";
  if (/^fat-free (?:shredded )?mozzarella$/i.test(value))
    return "Fat-free mozzarella";
  if (/^xtreme wellness (?:high-fiber )?tortillas$/i.test(value))
    return "Xtreme Wellness tortillas";
  return value;
}

export function buildGroceryList(
  mealPlan: Record<string, number>,
  catalog: Recipe[] = recipes,
): GroceryEntry[] {
  const entries = new Map<string, GroceryEntry>();
  const byId = new Map(catalog.map((recipe) => [recipe.id, recipe]));
  for (const [id, count] of Object.entries(mealPlan)) {
    const recipe = byId.get(id);
    if (!recipe || !Number.isFinite(count) || count < 0.5 || count > 24)
      continue;
    for (const ingredient of recipe.ingredients) {
      const parsed = parseIngredient(ingredient);
      const item = groceryName(parsed?.item || ingredient);
      const dimension = parsed?.dimension ?? "count";
      const unit = parsed?.unit ?? "";
      const key = `${item.toLowerCase()}|${dimension}|${dimension === "count" ? unit : ""}`;
      const amounts =
        parsed?.amounts.map((n) => n * count * factor(dimension, unit)) ?? [];
      const existing = entries.get(key);
      if (existing?.amounts.length && amounts.length) {
        const low = existing.amounts[0] + amounts[0];
        const high =
          (existing.amounts[1] ?? existing.amounts[0]) +
          (amounts[1] ?? amounts[0]);
        existing.amounts = Math.abs(low - high) < 1e-8 ? [low] : [low, high];
      } else if (!existing)
        entries.set(key, {
          key,
          item,
          amounts,
          unit,
          dimension,
          originalUnit: unit,
        });
    }
  }
  return [...entries.values()].sort(
    (a, b) => a.item.localeCompare(b.item) || a.key.localeCompare(b.key),
  );
}

export function formatGrocery(entry: GroceryEntry, target: string): string {
  if (!entry.amounts.length) return "As needed";
  const amounts = entry.amounts.map((n) => n / factor(entry.dimension, target));
  const unit =
    entry.dimension === "count" && target && amounts.some((n) => n !== 1)
      ? `${target}s`
      : target;
  return `${amounts.map((n) => formatNumber(n, ["g", "kg", "ml", "l"].includes(target.toLowerCase()))).join("–")} ${unit}`.trim();
}

export const grocerySignature = (entry: GroceryEntry): string =>
  JSON.stringify(entry.amounts);
