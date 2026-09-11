import { z } from "zod";
import { parseIngredient } from "./measurements.ts";

// Invisible formatting characters: zero-width spaces, soft hyphens, word
// joiners, and the bidirectional controls used to make text render differently
// from how it reads. ZWNJ/ZWJ (U+200C/U+200D) are deliberately absent because
// they carry meaning inside emoji sequences and in scripts such as Persian.
const invisible =
  /[\u00AD\u061C\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

const plainText = (max: number) =>
  z
    .string()
    // Strip rather than reject: whoever typed these cannot see them, so an
    // error naming an invisible character would be impossible to act on. They
    // also break ingredient matching silently, which is the real damage.
    .transform((value) => value.replace(invisible, ""))
    .pipe(
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
        ),
    );
const uniqueTextList = (maxItems: number, maxLength: number, minItems = 1) =>
  z
    .array(plainText(maxLength))
    .min(minItems)
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
    // Cutting and Bulking are explicit designations in the source. "Either" means no
    // designation was given: the recipe suits either goal depending on portion.
    goal: z.enum(["Cutting", "Bulking", "Either"]),
    // Nutrition as given in the source, for one batch unless `basis` says
    // otherwise. Each figure is independently nullable: a few entries state
    // only calories and protein, and nothing here is calculated or inferred.
    macros: z
      .object({
        calories: z.number().int().min(0).max(100000).nullable(),
        protein: z.number().min(0).max(10000).nullable(),
        carbs: z.number().min(0).max(10000).nullable(),
        fat: z.number().min(0).max(10000).nullable(),
        basis: plainText(60).nullable(),
      })
      .strict()
      .nullable()
      // Defaulted, not merely nullable: a backup written before macros existed
      // has no such key, and must still restore rather than be rejected.
      .default(null),
    style: plainText(60),
    // A recipe can legitimately have no refrigerated ingredients (protein
    // powder, water and ice), in which case it simply never shares any.
    perishables: uniqueTextList(40, 120, 0),
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
