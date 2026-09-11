"use client";
import { useMemo } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { usePlanner } from "@/hooks/use-planner";
import {
  buildGroceryList,
  defaultUnit,
  formatGrocery,
  grocerySignature,
  unitOptions,
} from "@/lib/ingredients";
import { QuantityInput } from "@/components/quantity-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function GroceryList({
  onStatus: setStatus,
}: {
  onStatus: (message: string) => void;
}) {
  const { state, recipes, update } = usePlanner();
  const { mealPlan, groceryUnits, checked, unitSystem } = state;
  const setMealPlan = (
    change: (current: Record<string, number>) => Record<string, number>,
  ) =>
    update((current) => ({ ...current, mealPlan: change(current.mealPlan) }));
  const setGroceryUnits = (
    change: (current: Record<string, string>) => Record<string, string>,
  ) =>
    update((current) => ({
      ...current,
      groceryUnits: change(current.groceryUnits),
    }));
  const groceryItems = useMemo(
    () => buildGroceryList(mealPlan, recipes),
    [mealPlan, recipes],
  );
  // Skip any planned ID with no matching recipe instead of rendering undefined.
  const plannedRecipes = Object.entries(mealPlan).flatMap(([id, count]) => {
    const recipe = recipes.find((r) => r.id === id);
    return recipe ? [{ recipe, count }] : [];
  });
  if (!plannedRecipes.length) return null;
  return (
    <section className="grocery-section">
      <div className="grocery-wrap">
        <div className="grocery-heading">
          <div>
            <p className="eyebrow">
              <ShoppingCart size={15} />
              Combined shopping
            </p>
            <h2>Grocery list</h2>
            <p>
              Matching measured ingredients are combined across recipes and
              recipe batches. Saved on this device; browser and installed-app
              lists may be separate.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="clear-list">
                <Trash2 size={15} />
                Clear list
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="confirm-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Clear your grocery list?</AlertDialogTitle>
                <AlertDialogDescription>
                  All planned recipes and checked items will be removed from
                  this device.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep list</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setMealPlan(() => ({}));
                    setStatus("Grocery list cleared.");
                  }}
                >
                  Clear list
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="planned-recipes">
          {plannedRecipes.map(({ recipe, count }) => (
            <div className="planned-card" key={recipe.id}>
              <div>
                <strong>{recipe.name}</strong>
                <span>{recipe.type}</span>
              </div>
              <label>
                Batches
                <QuantityInput
                  key={`${recipe.id}:${count}`}
                  aria-label={`Recipe batches for ${recipe.name}`}
                  value={count}
                  onCommit={(quantity) =>
                    setMealPlan((current) => ({
                      ...current,
                      [recipe.id]: quantity,
                    }))
                  }
                />
              </label>
              <button
                aria-label={`Remove ${recipe.name}`}
                onClick={() =>
                  setMealPlan((current) => {
                    const next = { ...current };
                    delete next[recipe.id];
                    return next;
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="grocery-list">
          {groceryItems.map((entry) => {
            const target =
              groceryUnits[entry.key] ??
              defaultUnit(entry.dimension, entry.originalUnit, unitSystem);
            const options = unitOptions(entry.dimension);
            return (
              <div
                className="grocery-row"
                data-checked={checked[entry.key] === grocerySignature(entry)}
                key={entry.key}
              >
                <label className="check-item">
                  <input
                    type="checkbox"
                    aria-label={`Mark ${entry.item} as purchased`}
                    checked={checked[entry.key] === grocerySignature(entry)}
                    onChange={(event) => {
                      const purchased = event.target.checked;
                      update((current) => ({
                        ...current,
                        checked: {
                          ...current.checked,
                          [entry.key]: purchased ? grocerySignature(entry) : "",
                        },
                      }));
                    }}
                  />
                  <span aria-hidden="true"></span>
                </label>
                <div>
                  <strong>{entry.item}</strong>
                  <span>{formatGrocery(entry, target)}</span>
                </div>
                {options.length > 0 && (
                  <Select
                    value={target}
                    onValueChange={(value) =>
                      setGroceryUnits((current) => ({
                        ...current,
                        [entry.key]: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      className="inline-unit grocery-unit"
                      aria-label={`Convert ${entry.item}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="recipe-select-content"
                    >
                      {options.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
