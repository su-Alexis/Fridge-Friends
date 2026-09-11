import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogSchema, recipeSchema } from "../lib/recipe-schema.ts";

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const catalog = catalogSchema.parse(
  JSON.parse(
    await readFile(new URL("../data/recipes.json", import.meta.url), "utf8"),
  ),
);

const template = JSON.parse(
  await readFile(
    new URL("../examples/recipe-template.json", import.meta.url),
    "utf8",
  ),
);
test("recipe template is valid and supports personal sources without a page", () => {
  assert.equal(recipeSchema.parse(template).page, null);
});
test("schema rejects executable markup, invalid quantities, unknown fields and oversized lists", () => {
  for (const change of [
    { name: "<img src=x onerror=alert(1)>" },
    { id: "__proto__" },
    { ingredients: ["1/0 cup milk"] },
    { ingredients: ["999999999999999999999999g rice"] },
    { instructions: Array(61).fill("Mix.") },
    { perishables: ["Milk", "milk"] },
    { page: -1 },
    { execute: "alert(1)" },
  ])
    assert.equal(
      recipeSchema.safeParse({ ...template, ...change }).success,
      false,
      JSON.stringify(change),
    );
});
test("catalog rejects duplicate IDs", () => {
  assert.equal(
    catalogSchema.safeParse({ schemaVersion: 1, recipes: [template, template] })
      .success,
    false,
  );
});

const ch = (code) => String.fromCharCode(code);
const ZWSP = ch(0x200b); // zero-width space
const SHY = ch(0x00ad); // soft hyphen
const WJ = ch(0x2060); // word joiner
const BOM = ch(0xfeff); // zero-width no-break space
const RLO = ch(0x202e); // right-to-left override
const PDF = ch(0x202c); // pop directional formatting
const LRI = ch(0x2066); // left-to-right isolate
const PDI = ch(0x2069); // pop directional isolate
const ZWJ = ch(0x200d); // zero-width joiner, kept: joins emoji sequences
const anyInvisible =
  /[\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/;

test("invisible formatting characters are stripped from every text field", () => {
  const parsed = recipeSchema.parse({
    ...template,
    name: "Cook" + ZWSP + "ed chicken" + BOM,
    style: "Bo" + SHY + "wl",
    source: RLO + "Fridge Friends" + PDF,
    perishables: ["Cooked" + WJ + " chicken"],
    ingredients: ["12 oz cook" + ZWSP + "ed chicken"],
    instructions: [LRI + "Cook it." + PDI],
  });
  assert.equal(parsed.name, "Cooked chicken");
  assert.equal(parsed.style, "Bowl");
  assert.equal(parsed.source, "Fridge Friends");
  assert.deepEqual(parsed.perishables, ["Cooked chicken"]);
  assert.deepEqual(parsed.ingredients, ["12 oz cooked chicken"]);
  assert.deepEqual(parsed.instructions, ["Cook it."]);
  assert.doesNotMatch(JSON.stringify(parsed), anyInvisible);
});

test("stripping does not let empty or duplicate values through", () => {
  // A value made only of invisible characters is empty once cleaned.
  assert.equal(
    recipeSchema.safeParse({ ...template, name: ZWSP + BOM + SHY }).success,
    false,
  );
  // Two names differing only by an invisible character are the same name.
  assert.equal(
    recipeSchema.safeParse({
      ...template,
      perishables: ["Milk", "Mi" + ZWSP + "lk"],
    }).success,
    false,
  );
});

test("emoji survive, including sequences joined with U+200D", () => {
  const chef = String.fromCodePoint(0x1f469) + ZWJ + String.fromCodePoint(0x1f373);
  assert.equal(
    recipeSchema.parse({ ...template, name: "Chef " + chef }).name,
    "Chef " + chef,
  );
});

test("goal is required and restricted to the three source designations", () => {
  for (const goal of ["Cutting", "Bulking", "Either"])
    assert.equal(recipeSchema.parse({ ...template, goal }).goal, goal);
  for (const bad of [undefined, null, "", "cutting", "Maintenance", 1])
    assert.equal(
      recipeSchema.safeParse({ ...template, goal: bad }).success,
      false,
      JSON.stringify(bad),
    );
});

test("a recipe may have no refrigerated ingredients, but must have ingredients", () => {
  // Protein powder, water and ice: nothing to share, which is legitimate.
  assert.deepEqual(
    recipeSchema.parse({ ...template, perishables: [] }).perishables,
    [],
  );
  assert.equal(
    recipeSchema.safeParse({ ...template, ingredients: [] }).success,
    false,
  );
});

test("macros are optional, partial, and never invented", () => {
  // A recipe file written before macros existed still validates.
  const { macros, ...withoutMacros } = template;
  assert.equal(recipeSchema.parse(withoutMacros).macros, null, String(macros));

  // Every figure is independently optional: the source states only calories
  // and protein for a few recipes.
  const partial = recipeSchema.parse({
    ...template,
    macros: { calories: 310, protein: 45, carbs: null, fat: null, basis: null },
  });
  assert.equal(partial.macros.calories, 310);
  assert.equal(partial.macros.carbs, null);

  // A per-unit basis is carried so the UI knows not to scale it by batches.
  assert.equal(
    recipeSchema.parse({
      ...template,
      macros: { calories: 150, protein: 23, carbs: 4, fat: 4, basis: "per donut" },
    }).macros.basis,
    "per donut",
  );

  for (const bad of [
    { calories: -1, protein: null, carbs: null, fat: null, basis: null },
    { calories: 1.5, protein: null, carbs: null, fat: null, basis: null },
    { calories: 10, protein: null, carbs: null, fat: null, basis: null, extra: 1 },
    { protein: 10 },
  ])
    assert.equal(
      recipeSchema.safeParse({ ...template, macros: bad }).success,
      false,
      JSON.stringify(bad),
    );
});

test("every catalog recipe carries the macros the source states", () => {
  const withMacros = catalog.recipes.filter((r) => r.macros);
  assert.equal(withMacros.length, catalog.recipes.length, "a recipe lost its macros");
  const complete = withMacros.filter(
    (r) => ["calories", "protein", "carbs", "fat"].every((k) => r.macros[k] !== null),
  );
  // Three source entries state only calories and protein. Nothing is inferred
  // to fill the gaps, so this stays at three unless the source itself changes.
  assert.equal(catalog.recipes.length - complete.length, 3);

  // Guard the parser bug that read a nutrient's value from the NEXT line:
  // every stated calorie figure should be a plausible meal, not a gram count.
  const calories = catalog.recipes
    .map((r) => r.macros?.calories)
    .filter((c) => typeof c === "number");
  assert.equal(calories.length, catalog.recipes.length - 0);
  assert.ok(
    Math.min(...calories) >= 50,
    `implausibly low calories: ${Math.min(...calories)}`,
  );
  assert.ok(median(calories) > 250, `median calories too low: ${median(calories)}`);
});
