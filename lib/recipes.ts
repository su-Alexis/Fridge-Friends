import rawCatalog from "../data/recipes.json";
import { catalogSchema } from "./recipe-schema";
export type { Recipe } from "./recipe-schema";

// One validated source of truth for both the website and the native bundle.
export const recipes = catalogSchema.parse(rawCatalog).recipes;
export const recipeDetails = Object.fromEntries(
  recipes.map(({ id, ingredients, instructions }) => [
    id,
    { ingredients, instructions },
  ]),
);
