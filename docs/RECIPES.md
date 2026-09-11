# Adding and maintaining recipes

## In the app

Choose **Add recipe**, enter the name, meal type, style, refrigerated ingredient names, full quantities and instructions, then choose **Save recipe**. The new recipe is selected immediately and joins matching and grocery calculations. Select your recipe to edit it or delete it with confirmation. Built-in recipes cannot be overwritten from the app.

Custom recipes are saved only in the current browser or installed app on this device. They are not sent to a server or automatically shared with other users/devices. Up to 100 custom recipes are supported within the total saved-state limit. If storage is unavailable, the app shows a warning and keeps the recipe in memory for the current window.

Use one refrigerated ingredient name per line, with no quantities. The form lists existing names; matching ignores letter case but does not guess that differently named foods are equivalent. Use one full ingredient quantity per line and one instruction step per line. Plain text only.

Supported measured units: `g`, `kg`, `oz`, `lb`, `mL`, `L`, `tsp`, `tbsp`, `cup`, `cups`, `fl oz`. Fractions such as `1/2`, mixed fractions such as `1 1/2`, and ranges such as `2-3` are supported. Ounces are always weight; write fluid ounces as `fl oz`. Scoops, packets, servings and cans remain counts. Qualifiers such as “heaping” are kept as text, without guessing a volume conversion.

Write quantities for one full recipe batch. Instructions should refer to proportions or ingredient names when batch scaling would make fixed quantities misleading. The calculator does not adjust cooking times or infer food density. Unmeasured lines such as “Salt to taste” remain as written.

## Goal labels

Every recipe carries a `goal` of `Cutting`, `Bulking`, or `Either`. Cutting and Bulking are explicit designations in the source collection. `Either` means no designation was given: the recipe suits either goal depending on portion size and the overall eating plan, and is shown in the app as **Depends on portion size**. Batch calories alone are not used to assign a goal.

The picker has a filter for these three, shown as checkboxes above the recipe dropdown. All three start enabled, and the last enabled one cannot be switched off, so the picker can never be emptied. A recipe that is currently selected stays listed even when its goal is filtered out.

## Macros

Each recipe carries a `macros` object holding the nutrition figures **as given in the source collection**: `calories`, `protein`, `carbs`, `fat` and a `basis`. Nothing here is calculated, converted or inferred, and the source's own note applies: the figures were not recalculated for the cooked chicken substitutions.

Every figure is independently nullable, because five entries state fewer than four of them. Two of those (Peanut Butter Cup Jello, High Protein Blizzard) print a second "carbs" line where fat clearly belongs; the mislabelled figure is left out rather than reassigned. `macros` itself may be `null`, and the whole field defaults to `null`, so recipe files and backups written before macros existed still load.

`basis` is normally `null`, meaning the figures describe one batch and the app multiplies them by the batch count. When it is set — `per donut`, `per muffin`, `for entire bread` — the figures describe that unit instead and are **not** scaled.

## Refrigerated ingredient names

`perishables` drives recipe matching, which compares names exactly after normalising case and zero-width characters. Names are therefore **canonical rather than descriptive**: every recipe using any Greek yogurt lists `Greek yogurt`, not `Fat-Free Greek Yogurt` or `0% Greek Yogurt`. The full quantity and brand stay in `ingredients`, which is what the calculator and grocery list use. Reuse an existing name exactly, or the recipe will not match anything.

A recipe may have an empty `perishables` list when it genuinely has no refrigerated ingredients, such as protein powder, water and ice. It simply never appears as a match.

## Built-in catalog maintenance

All built-in recipe content is in `data/recipes.json`, validated by `lib/recipe-schema.ts`. A recipe's ID, labels, ingredients and instructions live in one record. The GitHub Pages build, future native wrapper and validation command all use this same schema.

To add a recipe for every user, copy `examples/recipe-template.json`, fill it in, then run:

```sh
npm run recipes:add -- path/to/new-recipe.json
npm run recipes:check
npm test
```

The import command rejects duplicate IDs and unknown/invalid fields before writing, refuses concurrent imports, and replaces the catalog atomically. It does not execute recipe-file content, fetch external URLs or publish changes. Built-in catalog changes become available after rebuilding and deploying the web app or distributing an updated native bundle.

The catalog currently holds 309 recipes. Catalog limits include 500 built-in recipes, unique lowercase IDs, bounded text/list lengths, and finite positive ingredient quantities. The source page can be `null` for personal recipes. Keep built-in IDs stable so existing saved meal plans continue to resolve.
