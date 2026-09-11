"use client";

import recipeImage from "./assets/recipe-spread.webp";
import { useState } from "react";
import { RecipeEditor, DeleteRecipe } from "@/components/recipe-editor";
import { BackupDialog } from "@/components/backup";
import { RecipeCalculator } from "@/components/recipe-calculator";
import { RecipeMatches } from "@/components/recipe-matches";
import { GroceryList } from "@/components/grocery-list";
import { usePlanner } from "@/hooks/use-planner";
import { Check, Refrigerator, ShoppingCart, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Home() {
  const { state, recipes, error, update } = usePlanner();
  const { selectedId, servings, mealPlan } = state;
  const [status, setStatus] = useState("");
  const setSelectedId = (id: string) =>
    update((current) => ({
      ...current,
      selectedId: id,
      servings: current.mealPlan[id] ?? 1,
    }));
  const setMealPlan = (
    change: (current: Record<string, number>) => Record<string, number>,
  ) =>
    update((current) => ({ ...current, mealPlan: change(current.mealPlan) }));
  // validateState keeps selectedId inside the catalog; fall back rather than
  // crash if a future code path ever breaks that invariant.
  const selected =
    recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0];

  return (
    <main>
      <a className="skip-link" href="#recipe-picker">
        Skip to recipe picker
      </a>
      <header className="topbar">
        <div className="brand-mark">
          <Refrigerator size={18} />
        </div>
        <div>
          <strong>Fridge Friends</strong>
          <span>Recipe overlap finder</span>
        </div>
        <div className="recipe-count">{recipes.length} recipes indexed</div>
        <div className="topbar-actions">
          <RecipeEditor onSaved={setStatus} />
          <BackupDialog onStatus={setStatus} />
        </div>
      </header>
      {error && (
        <p className="storage-notice" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {status}
      </p>
      <section className="workspace">
        <div className="intro">
          <p className="eyebrow">
            <Sparkles size={15} />
            Waste less. Eat differently.
          </p>
          <h1>
            Pick one recipe.
            <br />
            <em>Use up the rest.</em>
          </h1>
          <p>
            Choose what you want to make first. We’ll surface the other cookbook
            recipes that reuse its refrigerated ingredients.
          </p>
          {/* Local asset also used by the static native bundle; no image proxy. */}
          <img
            className="food-strip"
            src={recipeImage}
            alt="Protein shake, berry yogurt bowl, and chicken wrap"
            width={1536}
            height={1024}
          />
        </div>
        <div className="picker-card">
          <label htmlFor="recipe-picker">Start with a recipe</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger
              id="recipe-picker"
              className="recipe-select"
              aria-label="Choose a recipe"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="recipe-select-content max-w-[calc(100vw-2rem)]"
            >
              <SelectGroup>
                <SelectLabel>Breakfast and lunch</SelectLabel>
                {recipes
                  .filter((r) => r.type === "Breakfast / lunch")
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Dinner</SelectLabel>
                {recipes
                  .filter((r) => r.type === "Dinner")
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="selected-recipe">
            <div className="selected-top">
              <span>{selected.style}</span>
              <span>
                {selected.source}
                {selected.page ? ` · p. ${selected.page}` : ""}
              </span>
            </div>
            <div className="recipe-title-row">
              <h2>{selected.name}</h2>
              <button
                className={mealPlan[selectedId] ? "add-list added" : "add-list"}
                onClick={() => {
                  setMealPlan((current) => ({
                    ...current,
                    [selectedId]: servings,
                  }));
                  setStatus(
                    `${selected.name} added to your grocery list: ${servings} recipe batches.`,
                  );
                }}
              >
                <ShoppingCart size={16} />
                {mealPlan[selectedId]
                  ? "Update grocery list"
                  : "Add to grocery list"}
              </button>
            </div>
            {selected.id.startsWith("custom-") && (
              <div className="recipe-actions">
                <RecipeEditor recipe={selected} onSaved={setStatus} />
                <DeleteRecipe recipe={selected} onDeleted={setStatus} />
              </div>
            )}
            <p className="mini-label">Quick perishables in this recipe</p>
            <div className="chips">
              {selected.perishables.map((i) => (
                <span className="chip selected-chip" key={i}>
                  <Check size={13} />
                  {i}
                </span>
              ))}
            </div>
            <RecipeCalculator recipe={selected} />
          </div>
        </div>
      </section>
      <GroceryList onStatus={setStatus} />
      <RecipeMatches
        selected={selected}
        recipes={recipes}
        onSelect={setSelectedId}
      />
    </main>
  );
}
