import { z } from "zod";
import { parseIngredient } from "./measurements.ts";

const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        // Reject control characters intentionally; they are never recipe markup.
        // eslint-disable-next-line no-control-regex
        !/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value),
      "Use plain text, without HTML or control characters",
    );
const uniqueTextList = (maxItems: number, maxLength: number) =>
  z
    .array(plainText(maxLength))
    .min(1)
    .max(maxItems)
    .refine(
      (items) =>
        new Set(items.map((item) => item.toLowerCase())).size === items.length,
      "Remove duplicate entries",
    );

export const recipeSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(80)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use a lowercase hyphen-separated ID",
      )
      .refine(
        (id) => !["constructor", "prototype"].includes(id),
        "Reserved recipe ID",
      ),
    name: plainText(120),
    type: z.enum(["Breakfast / lunch", "Dinner"]),
    style: plainText(60),
    perishables: uniqueTextList(40, 120),
    pantry: z.array(plainText(120)).max(60),
    source: plainText(160),
    page: z.number().int().min(1).max(10000).nullable(),
    ingredients: uniqueTextList(60, 400),
    instructions: z.array(plainText(1200)).min(1).max(60),
  })
  .strict()
  .superRefine((recipe, context) => {
    recipe.ingredients.forEach((ingredient, index) => {
      if (!/^\d/.test(ingredient)) return;
      const parsed = parseIngredient(ingredient);
      if (!parsed || parsed.amounts.some((amount) => amount > 1_000_000)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ingredients", index],
          message:
            "Use a positive, finite quantity up to 1,000,000 (for example: 1/2 cup milk)",
        });
      }
    });
  });

export const catalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    recipes: z.array(recipeSchema).min(1).max(500),
  })
  .strict()
  .superRefine((catalog, context) => {
    const ids = new Set<string>();
    catalog.recipes.forEach((recipe, index) => {
      if (ids.has(recipe.id))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recipes", index, "id"],
          message: `Duplicate recipe ID: ${recipe.id}`,
        });
      ids.add(recipe.id);
    });
  });

export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeCatalog = z.infer<typeof catalogSchema>;
