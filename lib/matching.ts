// Ingredient names are compared, never displayed, through this. Zero-width
// characters are ignored so one pasted invisible character cannot silently stop
// two identical names from matching; the schema strips most of them, but ZWNJ
// and ZWJ are preserved there because they carry meaning in real text.
export const normalizeIngredient = (name: string) =>
  name
    .replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, "")
    .trim()
    .toLocaleLowerCase("en-US");
