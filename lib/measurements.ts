export type UnitSystem = "original" | "us" | "metric";
export type Dimension = "weight" | "volume" | "count";
export type ParsedIngredient = {
  amounts: number[];
  unit: string;
  item: string;
  dimension: Dimension;
};
export type GroceryEntry = ParsedIngredient & {
  key: string;
  originalUnit: string;
};

const volumeUnits: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  cup: 236.5882365,
  cups: 236.5882365,
  "fl oz": 29.5735295625,
};
const weightUnits: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};
const numberPattern = "(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)";
const quantityPattern = new RegExp(
  `^(${numberPattern}(?:[-–]${numberPattern})?)\\s*(.*)$`,
);
const parseNumber = (text: string): number => {
  const parts = text.trim().split(/\s+/);
  const fraction = parts.pop()!.split("/").map(Number);
  return (
    Number(parts[0] ?? 0) +
    (fraction.length === 2 ? fraction[0] / fraction[1] : fraction[0])
  );
};

export function normalizeQuantity(value: number): number {
  return Number.isFinite(value)
    ? Math.min(24, Math.max(0.5, Math.round(value * 2) / 2))
    : 1;
}

export function formatNumber(value: number, metric = false): string {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError("Invalid quantity");
  if (!metric) {
    const whole = Math.floor(value);
    const fractions: Array<[number, string]> = [
      [1 / 8, "1/8"],
      [1 / 4, "1/4"],
      [1 / 3, "1/3"],
      [1 / 2, "1/2"],
      [2 / 3, "2/3"],
      [3 / 4, "3/4"],
      [7 / 8, "7/8"],
    ];
    const fraction = fractions.find(
      ([n]) => Math.abs(value - whole - n) < 0.001,
    );
    if (fraction) return `${whole ? `${whole} ` : ""}${fraction[1]}`;
  }
  // Keep small nonzero quantities nonzero (e.g. 1/4 tsp expressed in liters).
  return String(Number(value.toPrecision(metric ? 4 : 5)));
}

export function parseIngredient(ingredient: string): ParsedIngredient | null {
  const match = ingredient.match(quantityPattern);
  if (!match) return null;
  const amounts = match[1].split(/[-–]/).map(parseNumber);
  if (
    amounts.some((n) => !Number.isFinite(n) || n <= 0) ||
    (amounts.length === 2 && amounts[0] > amounts[1])
  )
    return null;
  const measured = match[2].match(
    /^(fl oz|cups?|tbsp|tsp|oz|kg|g|ml|l|lb)\b\s*(.*)$/i,
  );
  if (measured) {
    const unit = measured[1].toLowerCase();
    // A parenthetical equivalent describes the original amount, not the food.
    const item = measured[2].replace(
      /^\([\d\s./]+(?:cups?|tbsp|tsp|oz|g|ml)\)\s*/i,
      "",
    );
    return {
      amounts,
      unit,
      item,
      dimension: Object.hasOwn(volumeUnits, unit) ? "volume" : "weight",
    };
  }
  const counted = match[2].match(
    /^(scoops?|packets?|servings?|cans?)\b\s*(.*)$/i,
  );
  return {
    amounts,
    unit: counted ? counted[1].toLowerCase().replace(/s$/, "") : "",
    item: counted ? counted[2] : match[2],
    dimension: "count",
  };
}

export function unitOptions(dimension: Dimension): string[] {
  return dimension === "weight"
    ? ["g", "kg", "oz", "lb"]
    : dimension === "volume"
      ? ["mL", "L", "tsp", "tbsp", "cup", "fl oz"]
      : [];
}
export const targetOptions = (ingredient: string) =>
  unitOptions(parseIngredient(ingredient)?.dimension ?? "count");
export const factor = (dimension: Dimension, unit: string) => {
  if (dimension === "count") return 1;
  const units = dimension === "weight" ? weightUnits : volumeUnits;
  const key = unit.toLowerCase();
  if (!Object.hasOwn(units, key))
    throw new RangeError("Incompatible measurement unit");
  return units[key];
};
const displayUnit = (unit: string) =>
  unit === "ml" ? "mL" : unit === "l" ? "L" : unit === "cups" ? "cup" : unit;
export function defaultUnit(
  dimension: Dimension,
  originalUnit: string,
  system: UnitSystem,
): string {
  if (dimension === "count" || system === "original")
    return displayUnit(originalUnit);
  return dimension === "weight"
    ? system === "metric"
      ? "g"
      : "oz"
    : system === "metric"
      ? "mL"
      : "fl oz";
}

export function calculateIngredient(
  ingredient: string,
  batches: number,
  system: UnitSystem,
  override?: string,
): string {
  if (!Number.isFinite(batches) || batches <= 0)
    throw new RangeError("Invalid recipe multiplier");
  const parsed = parseIngredient(ingredient);
  if (!parsed) return ingredient;
  if (system === "original" && !override && batches === 1) return ingredient;
  const target = override || defaultUnit(parsed.dimension, parsed.unit, system);
  const amounts = parsed.amounts.map(
    (n) =>
      (n * batches * factor(parsed.dimension, parsed.unit)) /
      factor(parsed.dimension, target),
  );
  const amount = amounts
    .map((n) =>
      formatNumber(n, ["g", "kg", "ml", "l"].includes(target.toLowerCase())),
    )
    .join("–");
  const unit =
    parsed.dimension === "count" && target && amounts.some((n) => n !== 1)
      ? `${target}s`
      : target;
  return [amount, unit, parsed.item].filter(Boolean).join(" ");
}
