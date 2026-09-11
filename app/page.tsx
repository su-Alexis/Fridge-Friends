"use client";

import recipeImage from "./assets/recipe-spread.webp";
import { useState } from "react";
import { RecipeEditor, DeleteRecipe } from "@/components/recipe-editor";
import { BackupDialog } from "@/components/backup";
import { Toast, type Notice } from "@/components/toast";
import {
  ALL_GOALS,
  GoalBadge,
  GoalFilterBar,
  type Goal,
  type GoalFilter,
} from "@/components/goal-filter";
import { RecipeCalculator } from "@/components/recipe-calculator";
import { GroceryList } from "@/components/grocery-list";
import { FridgeFinder } from "@/components/fridge-finder";
import { usePlanner } from "@/hooks/use-planner";
import { matchesSearch } from "@/lib/search";
import {
  Check,
  Refrigerator,
  Search,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
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
  const [notice, setNotice] = useState<Notice>(null);
  // `important` messages stay on screen until dismissed.
  const setStatus = (text: string, important = false) =>
    setNotice(text ? { text, important } : null);
  const [goals, setGoals] = useState<GoalFilter>(ALL_GOALS);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [openResults, setOpenResults] = useState(false);
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
  const goalCounts = recipes.reduce(
    (totals, recipe) => ({ ...totals, [recipe.goal]: totals[recipe.goal] + 1 }),
    { Cutting: 0, Bulking: 0, Either: 0 } as Record<Goal, number>,
  );
  // 309 recipes is too many to scroll, so the search narrows the list by name,
  // style and goal, with a few synonyms so "milk" finds the shakes.
  const visible = recipes.filter(
    (recipe) =>
      goals[recipe.goal] &&
      matchesSearch(`${recipe.name} ${recipe.style} ${recipe.goal}`, query),
  );
  // Changing the filter can hide whatever is selected. Move the selection to
  // the first recipe still showing, rather than leaving a hidden recipe on
  // screen as though the filter had not applied to it.
  const applyQuery = (next: string) => {
    setQuery(next);
  };
  void applyQuery;
  const matches = visible.slice(0, 12);
  const showResults = openResults && query.trim() !== "" && matches.length > 0;
  const choose = (id: string) => {
    setSelectedId(id);
    setQuery("");
    setOpenResults(false);
  };
  const applyGoals = (next: GoalFilter) => {
    setGoals(next);
    const stillShowing = recipes.filter((recipe) => next[recipe.goal]);
    if (stillShowing.length && !stillShowing.some((r) => r.id === selected.id))
      setSelectedId(stillShowing[0].id);
  };

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
      <Toast notice={notice} onDismiss={() => setNotice(null)} />
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
            Choose what you want to make first. We’ll surface the other recipes
            that reuse its refrigerated ingredients.
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
          <GoalFilterBar value={goals} counts={goalCounts} onChange={applyGoals} />
          <div className="recipe-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                setOpenResults(true);
              }}
              onFocus={() => query && setOpenResults(true)}
              onBlur={() => setOpenResults(false)}
              onKeyDown={(event) => {
                if (!matches.length) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setOpenResults(true);
                  setActive((current) => {
                    const step = event.key === "ArrowDown" ? 1 : -1;
                    return (current + step + matches.length) % matches.length;
                  });
                } else if (event.key === "Enter" && openResults) {
                  event.preventDefault();
                  choose(matches[active].id);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  // First Escape closes the list, a second clears the search.
                  if (openResults) setOpenResults(false);
                  else setQuery("");
                }
              }}
              placeholder="Search recipes — try chicken, burrito or pancakes"
              aria-label="Search recipes by name or style"
              aria-describedby="recipe-search-count"
              autoComplete="off"
              role="combobox"
              aria-expanded={showResults}
              aria-controls="recipe-search-results"
              aria-activedescendant={
                showResults ? `search-option-${matches[active]?.id}` : undefined
              }
            />
            {query && (
              <button
                type="button"
                className="recipe-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setOpenResults(false);
                }}
              >
                <X size={15} />
              </button>
            )}
            {showResults && (
              <ul
                className="search-results"
                id="recipe-search-results"
                role="listbox"
                aria-label="Matching recipes"
              >
                {matches.map((recipe, index) => (
                  <li
                    key={recipe.id}
                    id={`search-option-${recipe.id}`}
                    role="option"
                    aria-selected={index === active}
                    data-active={index === active}
                    // mousedown, not click: blur would close the list first.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(recipe.id);
                    }}
                    onMouseEnter={() => setActive(index)}
                  >
                    <span className="search-result-name">{recipe.name}</span>
                    <span className="search-result-style">{recipe.style}</span>
                  </li>
                ))}
                {visible.length > matches.length && (
                  <li className="search-results-more" aria-hidden="true">
                    {visible.length - matches.length} more — keep typing to
                    narrow
                  </li>
                )}
              </ul>
            )}
          </div>
          <p id="recipe-search-count" className="search-count" role="status">
            {query
              ? `${visible.length} of ${recipes.length} recipes match`
              : `${visible.length} recipes shown`}
          </p>
          <Select value={selected.id} onValueChange={setSelectedId}>
            <SelectTrigger
              id="recipe-picker"
              className="recipe-select"
              aria-label="Choose a recipe"
            >
              {/* Explicit children: when the search hides the selected recipe
                  from the list, SelectValue finds no item and renders blank. */}
              <SelectValue>{selected.name}</SelectValue>
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="recipe-select-content max-w-[calc(100vw-2rem)]"
            >
              <SelectGroup>
                <SelectLabel>Breakfast and lunch</SelectLabel>
                {visible
                  .filter((r) => r.type === "Breakfast / lunch")
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Dinner</SelectLabel>
                {visible
                  .filter((r) => r.type === "Dinner")
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {visible.length === 0 && (
            <p className="empty-picker" role="status">
              {query
                ? `No recipes match “${query}”. Clear the search or try another word.`
                : "No recipes match those goals. Tick a goal above to see recipes again."}
            </p>
          )}
          <div className="selected-recipe">
            <div className="selected-top">
              <span>
                {selected.style}
                <GoalBadge goal={selected.goal} />
              </span>
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
      <FridgeFinder
        recipes={recipes}
        selected={selected}
        onSelect={setSelectedId}
        onAdd={(recipe) => {
          setMealPlan((current) => ({
            ...current,
            [recipe.id]: current[recipe.id] ?? 1,
          }));
          setStatus(`${recipe.name} added to your grocery list.`);
        }}
      />
    </main>
  );
}
