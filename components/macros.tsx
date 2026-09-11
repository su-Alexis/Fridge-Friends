"use client";

import type { Recipe } from "@/lib/recipe-schema";

type Macros = NonNullable<Recipe["macros"]>;

const GRAMS: Array<[keyof Macros, string]> = [
  ["protein", "Protein"],
  ["carbs", "Carbs"],
  ["fat", "Fat"],
];

const round = (value: number) =>
  Number(value.toFixed(value < 10 ? 1 : 0)).toLocaleString("en-US");

export function MacroRow({
  macros,
  batches,
}: {
  macros: Recipe["macros"];
  batches: number;
}) {
  if (!macros) return null;
  // A per-unit figure ("per donut") describes one item, not one batch, so it
  // must not be multiplied by the batch count.
  const perUnit = Boolean(macros.basis);
  const scale = perUnit ? 1 : batches;
  const tiles: Array<{ label: string; value: string }> = [];
  if (macros.calories !== null)
    tiles.push({ label: "Calories", value: round(macros.calories * scale) });
  for (const [key, label] of GRAMS) {
    const amount = macros[key];
    if (typeof amount === "number")
      tiles.push({ label, value: `${round(amount * scale)} g` });
  }
  if (!tiles.length) return null;

  return (
    <section className="macros" aria-label="Nutrition">
      <h3>
        Macros{" "}
        <span>
          {perUnit
            ? macros.basis
            : `for ${round(batches)} ${batches === 1 ? "batch" : "batches"}`}
        </span>
      </h3>
      <div className="macro-row">
        {tiles.map((tile) => (
          <div className="macro-tile" key={tile.label}>
            <span className="macro-label">{tile.label}</span>
            <strong className="macro-value">{tile.value}</strong>
          </div>
        ))}
      </div>
      {tiles.length < 4 && (
        <p className="macro-note">
          Only these figures are recorded for this recipe.
        </p>
      )}
    </section>
  );
}

export function MacroSummary({ macros }: { macros: Recipe["macros"] }) {
  if (!macros || macros.calories === null) return null;
  return (
    <span className="macro-summary">
      {round(macros.calories)} cal
      {macros.protein === null ? "" : ` · ${round(macros.protein)} g protein`}
      {macros.basis ? ` ${macros.basis}` : ""}
    </span>
  );
}
