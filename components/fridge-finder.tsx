"use client";

import { useMemo } from "react";
import { ArrowRight, BookOpen, Check, Plus, RotateCcw } from "lucide-react";
import type { Recipe } from "@/lib/recipe-schema";
import { GoalBadge } from "@/components/goal-filter";
import { MacroSummary } from "@/components/macros";
import { normalizeIngredient as normalize } from "@/lib/matching";
import type { PantryItem } from "@/lib/pantry";

export function FridgeFinder({
  recipes,
  pantry,
  chosen,
  onChosen,
  onSelect,
  onAdd,
}: {
  recipes: Recipe[];
  pantry: PantryItem[];
  chosen: string[];
  onChosen: (next: string[]) => void;
  onSelect: (id: string) => void;
  onAdd: (recipe: Recipe) => void;
}) {

  const picked = useMemo(() => new Set(chosen.map(normalize)), [chosen]);

  // Sharing "Cheese" says almost nothing - most recipes contain it. Sharing
  // "Seaweed" is a real signal. Weight each ingredient by how rare it is, so
  // results are ranked by meaningful overlap rather than by staples.
  const weights = useMemo(() => {
    const total = recipes.length || 1;
    return new Map(
      pantry.map(({ label, uses }) => [
        normalize(label),
        Math.log(total / uses) || 0.01,
      ]),
    );
  }, [pantry, recipes.length]);

  // An ingredient in more than a sixth of the catalog is a staple: sharing it
  // says little. At a quarter only Greek yogurt qualified, so the rule never
  // engaged.
  const staples = useMemo(() => {
    const cutoff = (recipes.length || 1) * 0.15;
    return new Set(
      pantry.filter((p) => p.uses > cutoff).map((p) => normalize(p.label)),
    );
  }, [pantry, recipes.length]);

  const results = useMemo(() => {
    if (!picked.size) return [];
    const distinctive = [...picked].some((i) => !staples.has(i));
    return recipes
      .map((recipe) => {
        const uses = recipe.perishables.filter((i) => picked.has(normalize(i)));
        const missing = recipe.perishables.filter(
          (i) => !picked.has(normalize(i)),
        );
        const score = uses.reduce(
          (total, i) => total + (weights.get(normalize(i)) ?? 0),
          0,
        );
        const notable = uses.filter((i) => !staples.has(normalize(i))).length;
        return { recipe, uses, missing, score, notable };
      })
      // Staples alone are not a match. Require something distinctive, or a
      // large overlap. If the fridge holds only staples, fall back to overlap
      // size so the list is never empty for a legitimate selection.
      .filter((m) =>
        m.uses.length === 0
          ? false
          : distinctive
            ? m.notable > 0 || m.uses.length >= 4
            : m.uses.length >= Math.min(2, picked.size),
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.missing.length - b.missing.length ||
          a.recipe.name.localeCompare(b.recipe.name),
      )
      .slice(0, 40);
  }, [recipes, picked, weights, staples]);

  const toggle = (label: string) =>
    onChosen(
      chosen.some((i) => normalize(i) === normalize(label))
        ? chosen.filter((i) => normalize(i) !== normalize(label))
        : [...chosen, label],
    );

  return (
    <section className="results-section" id="fridge-finder">
      <div className="results-heading">
        <div>
          <p className="eyebrow">From your fridge</p>
          <h2>
            {picked.size === 0
              ? "What have you got?"
              : `${results.length}${results.length === 40 ? "+" : ""} ${
                  results.length === 1 ? "recipe uses" : "recipes use"
                } what you have`}
          </h2>
          <p className="finder-intro">
            Tick what is in your fridge. Recipes using the most of it come
            first, so nothing goes to waste.
          </p>
        </div>
        <div className="finder-actions">
          <button className="clear-list" onClick={() => onChosen([])}>
            <RotateCcw size={15} />
            Clear
          </button>
        </div>
      </div>

      <div className="fridge-picker">
        {pantry.map(({ label, uses }) => {
          const on = picked.has(normalize(label));
          return (
            <label key={label} className="fridge-item" data-on={on}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(label)}
              />
              <span className="fridge-tick" aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
              {label}
              <span className="fridge-count">{uses}</span>
            </label>
          );
        })}
      </div>

      {picked.size === 0 && (
        <p className="empty-matches">
          Choose an ingredient above to see what you can make with it.
        </p>
      )}

      <div className="match-grid">
        {results.map(({ recipe, uses, missing }, index) => (
          <div className="match-card finder-card" key={recipe.id}>
            <div className="rank">{String(index + 1).padStart(2, "0")}</div>
            <div className="match-content">
              <div className="match-meta">
                <span>
                  {recipe.style}
                  <GoalBadge goal={recipe.goal} />
                </span>
                <span>{recipe.type}</span>
              </div>
              <h3>{recipe.name}</h3>
              <MacroSummary macros={recipe.macros} />
              <p className="mini-label">
                Uses {uses.length} of your {picked.size}
              </p>
              <div className="chips">
                {uses.map((item) => (
                  <span className="chip shared-chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
              {missing.length > 0 && (
                <p className="missing">
                  <span>Also needs:</span> {missing.join(", ")}
                </p>
              )}
              <div className="source">
                <BookOpen size={14} />
                {recipe.source}
                {recipe.page ? `, page ${recipe.page}` : ""}
              </div>
              <div className="finder-card-actions">
                <button className="add-list" onClick={() => onAdd(recipe)}>
                  <Plus size={15} />
                  Add to grocery list
                </button>
                <button
                  className="clear-list"
                  onClick={() => {
                    onSelect(recipe.id);
                    document
                      .getElementById("recipe-picker")
                      ?.focus({ preventScroll: true });
                    window.scrollTo({
                      top: 0,
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    });
                  }}
                >
                  Open recipe
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
