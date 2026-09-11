import type { Recipe } from "./recipe-schema";

const normalize = (name: string) => name.trim().toLocaleLowerCase("en-US");
export function findRecipeMatches(selected: Recipe, catalog: Recipe[]) {
  const ingredients = new Set(selected.perishables.map(normalize));
  return catalog
    .filter((recipe) => recipe.id !== selected.id)
    .map((recipe) => {
      const shared = recipe.perishables.filter((item) =>
        ingredients.has(normalize(item)),
      );
      const missing = recipe.perishables.filter(
        (item) => !ingredients.has(normalize(item)),
      );
      return { recipe, shared, missing };
    })
    .filter((match) => match.shared.length > 0)
    .sort(
      (a, b) =>
        b.shared.length - a.shared.length ||
        a.missing.length - b.missing.length ||
        a.recipe.name.localeCompare(b.recipe.name),
    );
}
