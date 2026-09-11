"use client";
import { Calculator, Minus, Plus } from "lucide-react";
import { usePlanner } from "@/hooks/use-planner";
import {
  calculateIngredient,
  targetOptions,
  type UnitSystem,
} from "@/lib/ingredients";
import type { Recipe } from "@/lib/recipe-schema";
import { QuantityInput } from "@/components/quantity-input";
import { MacroRow } from "@/components/macros";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RecipeCalculator({
  recipe: selectedDetails,
}: {
  recipe: Recipe;
}) {
  const { state, update } = usePlanner();
  const { selectedId, servings, ingredientUnits, unitSystem } = state;
  const setServings = (count: number) =>
    update((current) => ({ ...current, servings: count }));
  const setUnitSystem = (system: UnitSystem) =>
    update((current) => ({
      ...current,
      unitSystem: system,
      ingredientUnits: {},
      groceryUnits: {},
    }));
  const setIngredientUnits = (
    change: (current: Record<string, string>) => Record<string, string>,
  ) =>
    update((current) => ({
      ...current,
      ingredientUnits: change(current.ingredientUnits),
    }));
  return (
    <>
      {" "}
      <div className="calculator">
        <div className="calculator-title">
          <Calculator size={18} />
          <div>
            <strong>Ingredient calculator</strong>
            <span>One batch uses the full recipe quantities</span>
          </div>
        </div>
        <div className="calculator-controls">
          <div>
            <label htmlFor="servings">Recipe batches</label>
            <div className="stepper">
              <button
                aria-label="Decrease recipe batches"
                disabled={servings <= 0.5}
                onClick={() => setServings(Math.max(0.5, servings - 0.5))}
              >
                <Minus size={15} />
              </button>
              <QuantityInput
                key={`${selectedId}:${servings}`}
                id="servings"
                value={servings}
                onCommit={setServings}
              />
              <button
                aria-label="Increase recipe batches"
                disabled={servings >= 24}
                onClick={() => setServings(Math.min(24, servings + 0.5))}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="units">Measurements</label>
            <Select
              value={unitSystem}
              onValueChange={(value) => setUnitSystem(value as UnitSystem)}
            >
              <SelectTrigger
                id="units"
                className="unit-select"
                aria-label="Measurement system"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="recipe-select-content"
              >
                <SelectItem value="original">Recipe original</SelectItem>
                <SelectItem value="us">US customary</SelectItem>
                <SelectItem value="metric">Metric</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="conversion-note">
          Volume converts only to volume and weight only to weight. Counts such
          as scoops, packets, and tortillas stay as counts. Conversions are
          approximate. Batch sizes range from 0.5 to 24; cooking times do not
          scale automatically.
        </p>
      </div>
      <MacroRow macros={selectedDetails.macros} batches={servings} />
      <div className="recipe-details">
        <section>
          <h3>
            Ingredients{" "}
            <span>
              for {servings} {servings === 1 ? "batch" : "batches"}
            </span>
          </h3>
          <ul>
            {selectedDetails.ingredients.map((item) => {
              const key = `${selectedId}:${item}`;
              const options = targetOptions(item);
              const override = ingredientUnits[key];
              return (
                <li className="ingredient-row" key={item}>
                  <span>
                    {calculateIngredient(item, servings, unitSystem, override)}
                  </span>
                  {options.length > 0 && (
                    <Select
                      value={override || "auto"}
                      onValueChange={(value) =>
                        setIngredientUnits((current) => ({
                          ...current,
                          [key]: value === "auto" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger
                        className="inline-unit"
                        aria-label={`Convert ${item}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="recipe-select-content"
                      >
                        <SelectItem value="auto">
                          Follow recipe setting
                        </SelectItem>
                        {options.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3>Instructions</h3>
          <ol>
            {selectedDetails.instructions.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
