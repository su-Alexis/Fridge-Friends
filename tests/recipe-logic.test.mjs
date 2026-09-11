import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
});
after(() => vite.close());
const { recipes, recipeDetails } = await vite.ssrLoadModule("/lib/recipes.ts");
const {
  calculateIngredient,
  parseIngredient,
  buildGroceryList,
  formatGrocery,
  targetOptions,
  grocerySignature,
} = await vite.ssrLoadModule("/lib/ingredients.ts");
const { initialState, validateState, parseSavedState } =
  await vite.ssrLoadModule("/lib/planner-state.ts");
const { normalizeIngredient } = await vite.ssrLoadModule("/lib/matching.ts");
const { matchesSearch, searchRank } = await vite.ssrLoadModule("/lib/search.ts");
const { catalogPantry, pantryMatches } = await vite.ssrLoadModule("/lib/pantry.ts");

test("every catalog recipe has unique identity, ingredients and instructions", () => {
  assert.equal(new Set(recipes.map((r) => r.id)).size, recipes.length);
  assert.deepEqual(
    Object.keys(recipeDetails).sort(),
    recipes.map((r) => r.id).sort(),
  );
  for (const recipe of recipes) {
    assert.ok(recipeDetails[recipe.id].ingredients.length);
    assert.ok(recipeDetails[recipe.id].instructions.length);
    assert.equal(new Set(recipe.perishables).size, recipe.perishables.length);
  }
});

test("converts explicit weight and fluid ounces without guessing food density", () => {
  assert.equal(
    calculateIngredient("8 fl oz coffee", 1, "metric"),
    "236.6 mL coffee",
  );
  assert.equal(calculateIngredient("8 oz sauce", 1, "metric"), "226.8 g sauce");
  assert.equal(
    calculateIngredient("1 lb chicken", 1, "metric"),
    "453.6 g chicken",
  );
  assert.equal(calculateIngredient("1 L milk", 1, "us"), "33.814 fl oz milk");
  assert.throws(
    () => calculateIngredient("10g chicken", 1, "metric", "cup"),
    /Incompatible/,
  );
});

test("preserves fractions, ranges, small quantities and original descriptions", () => {
  assert.equal(
    calculateIngredient("1 1/2 cups yogurt", 2, "original"),
    "3 cup yogurt",
  );
  assert.equal(
    calculateIngredient("2-3 tbsp sweetener", 0.5, "original"),
    "1–1 1/2 tbsp sweetener",
  );
  assert.equal(
    calculateIngredient("1/4 tsp vanilla", 0.5, "metric", "L"),
    "0.0006161 L vanilla",
  );
  assert.equal(
    calculateIngredient("20g (1/4 cup) quick oats", 1, "original"),
    "20g (1/4 cup) quick oats",
  );
  assert.equal(
    calculateIngredient("20g (1/4 cup) quick oats", 2, "original"),
    "40 g quick oats",
  );
  assert.equal(parseIngredient("1/0 cup milk"), null);
  assert.throws(
    () => calculateIngredient("1 cup milk", Infinity, "metric"),
    /Invalid/,
  );
});

test("all recipe calculations and grocery unit choices produce finite quantities", () => {
  for (const recipe of recipes)
    for (const count of [0.5, 1, 2.5, 24]) {
      for (const item of recipeDetails[recipe.id].ingredients) {
        for (const system of ["original", "us", "metric"]) {
          assert.doesNotMatch(
            calculateIngredient(item, count, system),
            /NaN|Infinity/,
          );
          for (const unit of targetOptions(item))
            assert.doesNotMatch(
              calculateIngredient(item, count, system, unit),
              /NaN|Infinity/,
            );
        }
      }
    }
});

test("merges compatible ingredients and keeps package counts separate from weights", () => {
  // Two recipes that both measure Greek yogurt in grams combine into one line.
  const list = buildGroceryList({
    "fully-stuffed-omelette-cutting": 1,
    "fully-stuffed-omelette-bulking": 1,
  });
  const yogurt = list.find((entry) => /greek yogurt/i.test(entry.item));
  assert.ok(yogurt, "greek yogurt did not appear in the grocery list");
  assert.equal(formatGrocery(yogurt, "g"), "175 g");

  // The same food bought by weight and by package must stay on separate lines,
  // because a can count cannot be added to an ounce total. Uses its own catalog
  // so the check does not depend on how a built-in recipe happens to be worded.
  const shape = {
    type: "Dinner",
    goal: "Either",
    style: "Test",
    perishables: ["Cooked chicken"],
    pantry: [],
    source: "Test",
    page: null,
    instructions: ["Cook."],
  };
  const mixed = buildGroceryList({ weighed: 1, canned: 1 }, [
    { ...shape, id: "weighed", name: "W", ingredients: ["8 oz cooked chicken"] },
    { ...shape, id: "canned", name: "C", ingredients: ["2 cans cooked chicken"] },
  ]).filter((entry) => /chicken/i.test(entry.item));
  assert.equal(mixed.length, 2);
  assert.deepEqual(mixed.map((entry) => entry.dimension).sort(), [
    "count",
    "weight",
  ]);
});

test("rejects corrupted, oversized, future-version and hostile persisted state", () => {
  assert.throws(() => parseSavedState("{"));
  assert.throws(() => parseSavedState("x".repeat(1000001)));
  assert.throws(() => validateState({ version: 99 }));
  const hostile = JSON.parse(
    '{"version":1,"selectedId":"__proto__","servings":1e999,"mealPlan":{"__proto__":1,"missing":1,"creamsicle-smoothie":-1,"chicken-enchiladas":2},"ingredientUnits":{"chicken-enchiladas:1 whole Tortilla":"<script>"}}',
  );
  const state = validateState(hostile);
  assert.equal(state.selectedId, initialState.selectedId);
  assert.equal(state.servings, 1);
  assert.deepEqual(state.mealPlan, { "chicken-enchiladas": 2 });
  assert.deepEqual(state.ingredientUnits, {});
  assert.deepEqual(
    buildGroceryList({ missing: 2, constructor: 1, "creamsicle-smoothie": Infinity }),
    [],
  );
});

test("saving and restoring keeps checked items only while quantities stay the same", () => {
  const state = validateState({ ...initialState, mealPlan: { "creamsicle-smoothie": 1 } });
  const entry = buildGroceryList(state.mealPlan)[0];
  state.checked[entry.key] = grocerySignature(entry);
  const restored = parseSavedState(JSON.stringify(state));
  assert.deepEqual(restored, state);
  assert.deepEqual(
    validateState({ ...restored, mealPlan: { "creamsicle-smoothie": 2 } }).checked,
    {},
  );
  assert.deepEqual(validateState({ ...restored, mealPlan: {} }).checked, {});
});

test("ingredient comparison sees through zero-width characters", () => {
  // U+200D is preserved by the schema (it joins emoji sequences), so the
  // comparison has to ignore it rather than rely on the schema removing it.
  const invisible = [0x200d, 0x200b, 0x00ad, 0x2060, 0xfeff].map((c) =>
    String.fromCharCode(c),
  );
  for (const ch of invisible)
    assert.equal(
      normalizeIngredient("Cooked" + ch + " chicken"),
      "cooked chicken",
      `U+${ch.charCodeAt(0).toString(16)} was not ignored`,
    );
  assert.equal(normalizeIngredient("  Greek Yogurt  "), "greek yogurt");
});

test("search treats milk as a request for shakes", () => {
  // The catalog names most shakes "... Shake", so a plain substring search for
  // "milk" would miss them.
  assert.ok(matchesSearch("Banana Peanut & Oats Shake", "milk"));
  assert.ok(matchesSearch("Vanilla Protein Shake", "milk"));
  assert.ok(matchesSearch("Strawberry Cheesecake Milkshake", "milk"));
  // Still matches the literal word wherever it appears.
  assert.ok(matchesSearch("Almond milk oatmeal", "milk"));
  // And does not drag in unrelated recipes.
  assert.equal(matchesSearch("Chicken Burrito", "milk"), false);
  assert.equal(matchesSearch("Beef Mazesoba", "milk"), false);

  // Every word typed must still match something.
  assert.ok(matchesSearch("Banana Protein Shake", "banana milk"));
  assert.equal(matchesSearch("Vanilla Protein Shake", "banana milk"), false);
  // An empty query matches everything.
  assert.ok(matchesSearch("anything", "   "));
});

test("the catalog actually surfaces shakes when searching milk", () => {
  const hits = recipes.filter((r) =>
    matchesSearch(`${r.name} ${r.style} ${r.goal}`, "milk"),
  );
  assert.ok(hits.length > 20, `only ${hits.length} results for "milk"`);
  assert.ok(
    hits.some((r) => /Banana Peanut & Oats Shake/.test(r.name)),
    "the renamed shake is not found by searching milk",
  );
  assert.ok(
    hits.every((r) => /shake|smoothie|milk/i.test(`${r.name} ${r.style}`)),
    "milk matched something unrelated",
  );
});

test("a literal match outranks a synonym one, and both still appear", () => {
  // Typing the word beats matching only by synonym.
  assert.ok(
    searchRank("Strawberry Cheesecake Milkshake", "milk") >
      searchRank("Vanilla Protein Shake", "milk"),
    "a milkshake should outrank a plain shake when searching milk",
  );
  // But the synonym match is still a match, not a rejection.
  assert.ok(searchRank("Vanilla Protein Shake", "milk") > 0);
  assert.equal(searchRank("Chicken Burrito", "milk"), 0);

  // Ranked over the real catalog, every literal "milk" title sorts above the
  // shakes, so both kinds are visible in the first screenful.
  const ranked = recipes
    .map((r) => ({ r, rank: searchRank(`${r.name} ${r.style} ${r.goal}`, "milk") }))
    .filter((e) => e.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  const literal = ranked.filter((e) => /milk/i.test(e.r.name));
  const synonym = ranked.filter((e) => !/milk/i.test(e.r.name));
  assert.ok(literal.length > 0 && synonym.length > 0, "one of the groups is empty");
  const lastLiteral = ranked.findIndex((e) => e === literal[literal.length - 1]);
  const firstSynonym = ranked.findIndex((e) => e === synonym[0]);
  assert.ok(
    lastLiteral < firstSynonym,
    "literal milk titles are not all ranked above the shakes",
  );
  // Both groups fit inside the 20 the picker shows.
  const shown = ranked.slice(0, 20);
  assert.ok(shown.some((e) => /milk/i.test(e.r.name)), "no milk titles shown");
  assert.ok(shown.some((e) => !/milk/i.test(e.r.name)), "no shakes shown");
});

test("a search term finds the ingredient it names, whatever the casing", () => {
  const pantry = catalogPantry(recipes);
  for (const spelling of ["chicken", "Chicken", "CHICKEN", "  cHiCkEn  "]) {
    const [best] = pantryMatches(pantry, spelling);
    assert.ok(best, `no ingredient found for ${JSON.stringify(spelling)}`);
    assert.match(best.label, /chicken/i);
  }
  // An exact ingredient name outranks one that merely contains the word.
  assert.equal(pantryMatches(pantry, "cheese")[0].label, "Cheese");
  // Very short fragments do not offer an ingredient; they are still typing.
  assert.deepEqual(pantryMatches(pantry, "ch"), []);
  // A word that names no ingredient offers nothing.
  assert.deepEqual(pantryMatches(pantry, "burrito"), []);
});

test("filtering by one ingredient keeps only recipes that use it", () => {
  const pantry = catalogPantry(recipes);
  const [chicken] = pantryMatches(pantry, "chicken");
  const using = recipes.filter((r) =>
    r.perishables.some(
      (p) => normalizeIngredient(p) === normalizeIngredient(chicken.label),
    ),
  );
  assert.equal(using.length, chicken.uses, "the count shown does not match");
  assert.ok(using.length > 10, `only ${using.length} recipes use it`);
  // Nothing without it can appear when it is the only ingredient chosen.
  assert.ok(
    using.every((r) => r.perishables.some((p) => /chicken/i.test(p))),
    "a recipe without chicken slipped in",
  );
});
