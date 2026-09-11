"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { recipeSchema, type Recipe } from "@/lib/recipe-schema";
import { usePlanner } from "@/hooks/use-planner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

function RecipeForm({
  recipe,
  onSave,
  onCancel,
  ingredientNames,
}: {
  recipe?: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
  ingredientNames: string[];
}) {
  const prefix = useId();
  const [error, setError] = useState("");
  const lines = (value: FormDataEntryValue | null) =>
    String(value ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  // crypto.randomUUID exists only in secure contexts; keep saving working when
  // the app is opened over plain HTTP on a LAN address during testing.
  const newRecipeId = () => {
    if (typeof crypto.randomUUID === "function")
      return `custom-${crypto.randomUUID()}`;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `custom-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  };
  // All four figures are optional; an empty form means "no macros recorded"
  // rather than zeroes, which would read as a real nutrition claim.
  const macrosFrom = (data: FormData) => {
    const read = (name: string) => {
      const raw = String(data.get(name) ?? "").trim();
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    const macros = {
      calories: read("calories"),
      protein: read("protein"),
      carbs: read("carbs"),
      fat: read("fat"),
      basis: null,
    };
    return Object.values(macros).some((value) => value !== null) ? macros : null;
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = recipeSchema.safeParse({
      id: recipe?.id ?? newRecipeId(),
      name: data.get("name"),
      type: data.get("type"),
      goal: data.get("goal"),
      style: data.get("style"),
      source: String(data.get("source") || "My recipes"),
      page: data.get("page") ? Number(data.get("page")) : null,
      macros: macrosFrom(data),
      perishables: lines(data.get("perishables")),
      pantry: recipe?.pantry ?? [],
      ingredients: lines(data.get("ingredients")),
      instructions: lines(data.get("instructions")),
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((issue) => `${issue.path.join(" ")}: ${issue.message}`)
          .join(". "),
      );
      return;
    }
    try {
      onSave(parsed.data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save this recipe.",
      );
    }
  }
  return (
    <form className="recipe-form" onSubmit={submit}>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <label htmlFor={`${prefix}-name`}>
        Recipe name
        <input
          id={`${prefix}-name`}
          name="name"
          required
          maxLength={120}
          defaultValue={recipe?.name}
          autoComplete="off"
        />
      </label>
      <div className="form-columns">
        <div>
          <label htmlFor={`${prefix}-type`}>Meal type</label>
          <Select
            name="type"
            defaultValue={recipe?.type ?? "Breakfast / lunch"}
          >
            <SelectTrigger id={`${prefix}-type`} className="unit-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="recipe-select-content">
              <SelectItem value="Breakfast / lunch">
                Breakfast / lunch
              </SelectItem>
              <SelectItem value="Dinner">Dinner</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor={`${prefix}-goal`}>Goal</label>
          <Select name="goal" defaultValue={recipe?.goal ?? "Either"}>
            <SelectTrigger id={`${prefix}-goal`} className="unit-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="recipe-select-content">
              <SelectItem value="Cutting">Cutting</SelectItem>
              <SelectItem value="Bulking">Bulking</SelectItem>
              <SelectItem value="Either">Depends on portion size</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label htmlFor={`${prefix}-style`}>
          Recipe style
          <input
            id={`${prefix}-style`}
            name="style"
            required
            maxLength={60}
            placeholder="e.g. Pasta"
            defaultValue={recipe?.style}
          />
        </label>
      </div>
      <label htmlFor={`${prefix}-perishables`}>
        Refrigerated ingredients
        <textarea
          id={`${prefix}-perishables`}
          name="perishables"
          required
          rows={3}
          maxLength={5000}
          defaultValue={recipe?.perishables.join("\n")}
          aria-describedby={`${prefix}-matching`}
          placeholder={"0% Greek yogurt\nCooked chicken"}
        />
      </label>
      <p id={`${prefix}-matching`} className="field-help">
        One name per line, without quantities. Reuse an existing name to find
        matching recipes.
      </p>
      <details className="ingredient-reference">
        <summary>Existing ingredient names</summary>
        <p>{ingredientNames.join(" · ")}</p>
      </details>
      <label htmlFor={`${prefix}-ingredients`}>
        Full ingredient list
        <textarea
          id={`${prefix}-ingredients`}
          name="ingredients"
          required
          rows={5}
          maxLength={24000}
          defaultValue={recipe?.ingredients.join("\n")}
          aria-describedby={`${prefix}-quantities`}
          placeholder={"1 cup 0% Greek yogurt\n100g cooked chicken"}
        />
      </label>
      <p id={`${prefix}-quantities`} className="field-help">
        One ingredient per line, for one full batch. Start with a quantity to
        enable scaling. Use g, kg, oz or lb for weight; mL, L, tsp, tbsp, cup or
        fl oz for volume.
      </p>
      <label htmlFor={`${prefix}-instructions`}>
        Instructions
        <textarea
          id={`${prefix}-instructions`}
          name="instructions"
          required
          rows={5}
          maxLength={72000}
          defaultValue={recipe?.instructions.join("\n")}
          aria-describedby={`${prefix}-steps`}
        />
      </label>
      <p id={`${prefix}-steps`} className="field-help">
        One step per line. Refer to ingredients by name or proportion so the
        steps still work when batch quantities change. Cooking times stay as
        written.
      </p>
      <fieldset className="macro-fields">
        <legend>Macros per batch (optional)</legend>
        <div className="macro-inputs">
          {(
            [
              ["calories", "Calories"],
              ["protein", "Protein (g)"],
              ["carbs", "Carbs (g)"],
              ["fat", "Fat (g)"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} htmlFor={`${prefix}-${field}`}>
              {label}
              <input
                id={`${prefix}-${field}`}
                name={field}
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                defaultValue={recipe?.macros?.[field] ?? ""}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-columns">
        <label htmlFor={`${prefix}-source`}>
          Source (optional)
          <input
            id={`${prefix}-source`}
            name="source"
            maxLength={160}
            defaultValue={recipe?.source}
            placeholder="My recipes"
          />
        </label>
        <label htmlFor={`${prefix}-page`}>
          Page (optional)
          <input
            id={`${prefix}-page`}
            name="page"
            type="number"
            min={1}
            max={10000}
            step={1}
            defaultValue={recipe?.page ?? ""}
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="clear-list" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="add-list">
          {recipe ? "Save changes" : "Save recipe"}
        </button>
      </div>
    </form>
  );
}

export function RecipeEditor({
  recipe,
  onSaved,
}: {
  recipe?: Recipe;
  onSaved: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { recipes, update } = usePlanner();
  const ingredientNames = [
    ...new Set(recipes.flatMap((item) => item.perishables)),
  ].sort();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="clear-list">
          {recipe ? <Pencil size={16} /> : <Plus size={16} />}
          {recipe ? "Edit recipe" : "Add recipe"}
        </button>
      </DialogTrigger>
      <DialogContent className="recipe-editor">
        <DialogHeader>
          <DialogTitle>
            {recipe ? "Edit your recipe" : "Add your recipe"}
          </DialogTitle>
          <DialogDescription>
            Saved on this device. Your recipe will appear in matches and grocery
            lists.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <RecipeForm
            recipe={recipe}
            ingredientNames={ingredientNames}
            onCancel={() => setOpen(false)}
            onSave={(saved) => {
              update((current) => ({
                ...current,
                customRecipes: recipe
                  ? current.customRecipes.map((item) =>
                      item.id === recipe.id ? saved : item,
                    )
                  : [...current.customRecipes, saved],
                selectedId: saved.id,
                servings: current.mealPlan[saved.id] ?? 1,
              }));
              setOpen(false);
              onSaved(`${saved.name} saved.`);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteRecipe({
  recipe,
  onDeleted,
}: {
  recipe: Recipe;
  onDeleted: (message: string) => void;
}) {
  const { update } = usePlanner();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="clear-list">
          <Trash2 size={16} />
          Delete recipe
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {recipe.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes your recipe and its planned batches from this device.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep recipe</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              update((current) => ({
                ...current,
                customRecipes: current.customRecipes.filter(
                  (item) => item.id !== recipe.id,
                ),
              }));
              onDeleted(`${recipe.name} deleted.`);
            }}
          >
            Delete recipe
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
