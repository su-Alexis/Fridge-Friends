import { recipes } from "./recipes";
import { recipeSchema, type Recipe } from "./recipe-schema";
import { z } from "zod";
import {
  buildGroceryList,
  grocerySignature,
  targetOptions,
  unitOptions,
  type UnitSystem,
} from "./ingredients";

export const STORAGE_KEY = "fridge-friends:planner:v1";
export const MAX_SAVED_LENGTH = 1_000_000;
export type PlannerState = {
  version: 1;
  selectedId: string;
  servings: number;
  unitSystem: UnitSystem;
  mealPlan: Record<string, number>;
  ingredientUnits: Record<string, string>;
  groceryUnits: Record<string, string>;
  checked: Record<string, string>;
  customRecipes: Recipe[];
};
export const initialState: PlannerState = {
  version: 1,
  selectedId: recipes[0].id,
  servings: 1,
  unitSystem: "original",
  mealPlan: {},
  ingredientUnits: {},
  groceryUnits: {},
  checked: {},
  customRecipes: [],
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const quantity = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0.5 &&
  value <= 24 &&
  Number.isInteger(value * 2);

// Storage is untrusted and versioned. Whitelist known IDs/units and cap work.
export function validateState(value: unknown): PlannerState {
  if (!object(value) || value.version !== 1)
    throw new Error("Unsupported saved list");
  const state: PlannerState = {
    ...initialState,
    mealPlan: {},
    ingredientUnits: {},
    groceryUnits: {},
    checked: {},
  };
  state.customRecipes = z
    .array(recipeSchema)
    .max(100)
    .parse(value.customRecipes ?? []);
  const ids = new Set(recipes.map((recipe) => recipe.id));
  for (const recipe of state.customRecipes) {
    if (!recipe.id.startsWith("custom-") || ids.has(recipe.id))
      throw new Error("Invalid custom recipe ID");
    ids.add(recipe.id);
  }
  const catalog = [...recipes, ...state.customRecipes];
  if (ids.has(value.selectedId as string))
    state.selectedId = value.selectedId as string;
  if (quantity(value.servings)) state.servings = value.servings;
  if (["original", "us", "metric"].includes(value.unitSystem as string))
    state.unitSystem = value.unitSystem as UnitSystem;
  for (const recipe of catalog) {
    const count =
      object(value.mealPlan) && Object.hasOwn(value.mealPlan, recipe.id)
        ? value.mealPlan[recipe.id]
        : undefined;
    if (quantity(count)) state.mealPlan[recipe.id] = count;
    for (const item of recipe.ingredients) {
      const key = `${recipe.id}:${item}`;
      const unit = object(value.ingredientUnits)
        ? value.ingredientUnits[key]
        : undefined;
      if (typeof unit === "string" && targetOptions(item).includes(unit))
        state.ingredientUnits[key] = unit;
    }
  }
  for (const entry of buildGroceryList(state.mealPlan, catalog)) {
    const unit = object(value.groceryUnits)
      ? value.groceryUnits[entry.key]
      : undefined;
    if (typeof unit === "string" && unitOptions(entry.dimension).includes(unit))
      state.groceryUnits[entry.key] = unit;
    if (
      object(value.checked) &&
      value.checked[entry.key] === grocerySignature(entry)
    )
      state.checked[entry.key] = grocerySignature(entry);
  }
  return state;
}

export function parseSavedState(raw: string): PlannerState {
  if (raw.length > MAX_SAVED_LENGTH) throw new Error("Saved list is too large");
  return validateState(JSON.parse(raw));
}
