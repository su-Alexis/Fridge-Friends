import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
});
after(() => vite.close());
const { serializeBackup, parseBackup, backupFilename, describeBackup } =
  await vite.ssrLoadModule("/lib/backup.ts");
const { initialState, validateState, MAX_SAVED_LENGTH } =
  await vite.ssrLoadModule("/lib/planner-state.ts");
const { recipes } = await vite.ssrLoadModule("/lib/recipes.ts");

const custom = {
  id: "custom-abc123",
  name: "Test bowl",
  type: "Dinner",
  style: "Bowl",
  perishables: ["0% Greek yogurt"],
  pantry: [],
  source: "My recipes",
  page: null,
  ingredients: ["1 cup 0% Greek yogurt"],
  instructions: ["Combine and serve."],
};
const populated = validateState({
  ...initialState,
  selectedId: recipes[1].id,
  servings: 2.5,
  unitSystem: "metric",
  customRecipes: [custom],
  mealPlan: { [recipes[1].id]: 2, "custom-abc123": 1.5 },
});

test("a backup round-trips through the same validator that guards storage", () => {
  const restored = parseBackup(serializeBackup(populated));
  assert.deepEqual(restored, populated);
  assert.equal(restored.customRecipes.length, 1);
  assert.equal(restored.mealPlan["custom-abc123"], 1.5);
  assert.equal(restored.unitSystem, "metric");
});

test("restoring rejects corrupt, hostile and oversized files", () => {
  for (const bad of [
    "{",
    "null",
    "[]",
    '"a string"',
    JSON.stringify({ ...initialState, version: 2 }),
    JSON.stringify({ ...initialState, version: 1, customRecipes: [{ id: "__proto__" }] }),
    JSON.stringify({
      ...initialState,
      version: 1,
      // A custom recipe may never shadow a built-in catalog ID.
      customRecipes: [{ ...custom, id: recipes[0].id }],
    }),
    JSON.stringify({
      ...initialState,
      version: 1,
      customRecipes: [{ ...custom, name: "<img src=x onerror=alert(1)>" }],
    }),
  ]) {
    assert.throws(() => parseBackup(bad), undefined, `accepted: ${bad.slice(0, 60)}`);
  }
  assert.throws(() => parseBackup(`{"version":1,"pad":"${"x".repeat(MAX_SAVED_LENGTH)}"}`));
});

test("restoring discards planned recipes and units that are not in the catalog", () => {
  const restored = parseBackup(
    JSON.stringify({
      ...initialState,
      version: 1,
      selectedId: "not-a-recipe",
      mealPlan: { "not-a-recipe": 3, [recipes[0].id]: 2 },
      groceryUnits: { "not-a-key": "kg" },
      checked: { "not-a-key": "[1]" },
    }),
  );
  assert.deepEqual(Object.keys(restored.mealPlan), [recipes[0].id]);
  assert.deepEqual(restored.groceryUnits, {});
  assert.deepEqual(restored.checked, {});
  assert.equal(restored.selectedId, initialState.selectedId);
});

test("backup filenames are dated and describe their contents", () => {
  assert.equal(
    backupFilename(new Date(2026, 0, 5)),
    "fridge-friends-2026-01-05.json",
  );
  assert.match(describeBackup(populated), /1 personal recipe and 2 planned recipes/);
  assert.match(describeBackup(initialState), /0 personal recipes and 0 planned recipes/);
});
