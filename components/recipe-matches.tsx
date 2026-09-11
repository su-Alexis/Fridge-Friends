"use client";
import { useMemo } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { findRecipeMatches } from "@/lib/matching";
import type { Recipe } from "@/lib/recipe-schema";
export function RecipeMatches({
  selected,
  recipes,
  onSelect: setSelectedId,
}: {
  selected: Recipe;
  recipes: Recipe[];
  onSelect: (id: string) => void;
}) {
  const matches = useMemo(
    () => findRecipeMatches(selected, recipes),
    [selected, recipes],
  );
  const reused = new Set(
    matches.flatMap((match) => match.shared.map((name) => name.toLowerCase())),
  ).size;
  return (
    <section className="results-section">
      <div className="results-heading">
        <div>
          <p className="eyebrow">Best matches</p>
          <h2>{matches.length} ways to reuse your fridge items</h2>
        </div>
        <div className="reuse-summary">
          <strong>{reused}</strong>
          <span>
            perishable {reused === 1 ? "item" : "items"}
            <br />
            reused
          </span>
        </div>
      </div>
      {matches.length === 0 && (
        <p className="empty-matches">
          No other recipes share these refrigerated ingredients yet. Add another
          recipe to find more matches.
        </p>
      )}
      <div className="match-grid">
        {matches.map(({ recipe, shared, missing }, index) => (
          <button
            className="match-card"
            key={recipe.id}
            onClick={() => {
              setSelectedId(recipe.id);
              document
                .getElementById("recipe-picker")
                ?.focus({ preventScroll: true });
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              });
            }}
          >
            <div className="rank">{String(index + 1).padStart(2, "0")}</div>
            <div className="match-content">
              <div className="match-meta">
                <span>{recipe.style}</span>
                <span>{recipe.type}</span>
              </div>
              <h3>{recipe.name}</h3>
              <p className="mini-label">Shared with your selected recipe</p>
              <div className="chips">
                {shared.map((i) => (
                  <span className="chip shared-chip" key={i}>
                    {i}
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
            </div>
            <ArrowRight className="card-arrow" size={20} />
          </button>
        ))}
      </div>
    </section>
  );
}
