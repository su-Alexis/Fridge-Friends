import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { catalogSchema, recipeSchema } from "../lib/recipe-schema.ts";

const catalogPath = fileURLToPath(
  new URL("../data/recipes.json", import.meta.url),
);
const mode = process.argv[2];
const inputPath = process.argv[3];
const readJson = async (path) => {
  if ((await stat(path)).size > 1_000_000)
    throw new Error("Recipe files must be smaller than 1 MB");
  const data = await readFile(path);
  if (data.byteLength > 1_000_000)
    throw new Error("Recipe files must be smaller than 1 MB");
  return JSON.parse(data.toString("utf8"));
};

try {
  const catalog = catalogSchema.parse(await readJson(catalogPath));
  if (mode === "check" && !inputPath) {
    console.log(
      `Validated ${catalog.recipes.length} recipes. IDs are unique; all required fields and limits pass.`,
    );
  } else if (mode === "add" && inputPath && process.argv.length === 4) {
    const recipe = recipeSchema.parse(await readJson(inputPath));
    const updated = catalogSchema.parse({
      ...catalog,
      recipes: [...catalog.recipes, recipe],
    });
    // Exclusive lock prevents two imports from overwriting each other.
    const lock = `${catalogPath}.lock`;
    await writeFile(lock, "Recipe import in progress\n", { flag: "wx" });
    const temporary = `${catalogPath}.${process.pid}.tmp`;
    try {
      const current = catalogSchema.parse(await readJson(catalogPath));
      if (JSON.stringify(current) !== JSON.stringify(catalog))
        throw new Error("Catalog changed during import; run the command again");
      await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, {
        flag: "wx",
      });
      await rename(temporary, catalogPath);
    } finally {
      await unlink(temporary).catch(() => {});
      await unlink(lock);
    }
    console.log(
      `Added ${recipe.name}. The catalog now contains ${updated.recipes.length} recipes.`,
    );
  } else
    throw new Error(
      "Usage: npm run recipes:check OR npm run recipes:add -- path/to/recipe.json",
    );
} catch (error) {
  if (error?.issues)
    for (const issue of error.issues)
      console.error(`${issue.path.join(".") || "recipe"}: ${issue.message}`);
  else
    console.error(
      error instanceof Error ? error.message : "Unable to read recipe file",
    );
  process.exitCode = 1;
}
