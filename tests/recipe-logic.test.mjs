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
  const list = buildGroceryList({ "strawberry-cheesecake": 2, creamsicle: 1 });
  const milk = list.find((entry) => entry.item === "Fat-free Fairlife milk");
  assert.equal(formatGrocery(milk, "cup"), "2 1/2 cup");
  // Every catalog recipe measures chicken by weight, so they all combine.
  const catalogChicken = buildGroceryList({
    "buffalo-wrap": 1,
    enchiladas: 1,
    "teriyaki-mac": 1,
    "bbq-quesadilla": 1,
    "buffalo-mac": 1,
    taquitos: 1,
  }).filter((entry) => /chicken/i.test(entry.item));
  assert.equal(catalogChicken.length, 1);
  assert.equal(formatGrocery(catalogChicken[0], "oz"), "55 oz");

  // The same food bought by weight and by package must stay on separate lines,
  // because a can count cannot be added to an ounce total. Uses its own catalog
  // so the check does not depend on how a built-in recipe happens to be worded.
  const shape = {
    name: "Test",
    type: "Dinner",
    style: "Test",
    perishables: ["Cooked chicken"],
    pantry: [],
    source: "Test",
    page: null,
    instructions: ["Cook."],
  };
  const mixed = buildGroceryList({ weighed: 1, canned: 1 }, [
    { ...shape, id: "weighed", ingredients: ["8 oz cooked chicken"] },
    { ...shape, id: "canned", ingredients: ["2 cans cooked chicken"] },
  ]).filter((entry) => /chicken/i.test(entry.item));
  assert.equal(mixed.length, 2);
  assert.deepEqual(mixed.map((entry) => entry.dimension).sort(), [
    "count",
    "weight",
  ]);
  const tortillas = buildGroceryList({ enchiladas: 1, taquitos: 1 }).filter(
    (entry) => /Xtreme Wellness/.test(entry.item),
  );
  assert.equal(tortillas.length, 1);
  assert.equal(formatGrocery(tortillas[0], ""), "4");
});

test("rejects corrupted, oversized, future-version and hostile persisted state", () => {
  assert.throws(() => parseSavedState("{"));
  assert.throws(() => parseSavedState("x".repeat(1000001)));
  assert.throws(() => validateState({ version: 99 }));
  const hostile = JSON.parse(
    '{"version":1,"selectedId":"__proto__","servings":1e999,"mealPlan":{"__proto__":1,"missing":1,"creamsicle":-1,"enchiladas":2},"ingredientUnits":{"enchiladas:12 oz cooked chicken":"<script>"}}',
  );
  const state = validateState(hostile);
  assert.equal(state.selectedId, initialState.selectedId);
  assert.equal(state.servings, 1);
  assert.deepEqual(state.mealPlan, { enchiladas: 2 });
  assert.deepEqual(state.ingredientUnits, {});
  assert.deepEqual(
    buildGroceryList({ missing: 2, constructor: 1, creamsicle: Infinity }),
    [],
  );
});

test("saving and restoring keeps checked items only while quantities stay the same", () => {
  const state = validateState({ ...initialState, mealPlan: { creamsicle: 1 } });
  const entry = buildGroceryList(state.mealPlan)[0];
  state.checked[entry.key] = grocerySignature(entry);
  const restored = parseSavedState(JSON.stringify(state));
  assert.deepEqual(restored, state);
  assert.deepEqual(
    validateState({ ...restored, mealPlan: { creamsicle: 2 } }).checked,
    {},
  );
  assert.deepEqual(validateState({ ...restored, mealPlan: {} }).checked, {});
});
