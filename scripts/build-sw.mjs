import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, posix, relative, sep } from "node:path";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const templatePath = fileURLToPath(new URL("./sw-template.js", import.meta.url));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return found.flat();
}

const files = (await walk(dist))
  .map((path) => relative(dist, path).split(sep).join(posix.sep))
  // .nojekyll is a GitHub Pages marker and sw.js must never cache itself.
  .filter((name) => name !== ".nojekyll" && name !== "sw.js")
  .sort();

if (!files.includes("index.html"))
  throw new Error("Run the site build before generating the service worker");

// Version the cache by the exact bytes being shipped, so every deployment
// installs a fresh cache and the activate handler deletes the previous one.
const digest = createHash("sha256");
for (const name of files) {
  digest.update(name);
  digest.update(await readFile(join(dist, name)));
}

const source = (await readFile(templatePath, "utf8"))
  .replace("__CACHE_NAME__", `fridge-friends-${digest.digest("hex").slice(0, 16)}`)
  // Quotes included: the placeholder is a valid string literal so the template
  // itself stays lintable, and is replaced by a real array literal here.
  .replace(
    '"__PRECACHE__"',
    JSON.stringify(
      files.map((name) => `./${name}`),
      null,
      2,
    ),
  );

await writeFile(join(dist, "sw.js"), source);
console.log(`Service worker precaches ${files.length} files.`);
