import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogSchema, recipeSchema } from "../lib/recipe-schema.ts";

const template = JSON.parse(
  await readFile(
    new URL("../examples/recipe-template.json", import.meta.url),
    "utf8",
  ),
);
test("recipe template is valid and supports personal sources without a page", () => {
  assert.equal(recipeSchema.parse(template).page, null);
});
test("schema rejects executable markup, invalid quantities, unknown fields and oversized lists", () => {
  for (const change of [
    { name: "<img src=x onerror=alert(1)>" },
    { id: "__proto__" },
    { ingredients: ["1/0 cup milk"] },
    { ingredients: ["999999999999999999999999g rice"] },
    { instructions: Array(61).fill("Mix.") },
    { perishables: ["Milk", "milk"] },
    { page: -1 },
    { execute: "alert(1)" },
  ])
    assert.equal(
      recipeSchema.safeParse({ ...template, ...change }).success,
      false,
      JSON.stringify(change),
    );
});
test("catalog rejects duplicate IDs", () => {
  assert.equal(
    catalogSchema.safeParse({ schemaVersion: 1, recipes: [template, template] })
      .success,
    false,
  );
});
