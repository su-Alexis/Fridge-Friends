import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";

const output = new URL("../dist/", import.meta.url);
const html = await readFile(new URL("index.html", output), "utf8");

test("static production document blocks inline scripts, connections and form posts", () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const policy = doc.querySelector(
    'meta[http-equiv="Content-Security-Policy"]',
  ).content;
  assert.match(policy, /script-src 'self';/);
  assert.match(policy, /connect-src 'none';/);
  assert.match(policy, /form-action 'none';/);
  assert.match(policy, /base-uri 'none';/);
  // The service worker needs worker-src; everything else stays forbidden.
  assert.match(policy, /worker-src 'self'/);
  assert.match(policy, /default-src 'none';/);
  assert.match(policy, /object-src 'none';/);
  assert.doesNotMatch(policy, /unsafe-eval|nonce-|https:|ws:/);
  assert.equal(
    doc.querySelector('meta[name="referrer"]').content,
    "no-referrer",
  );
  assert.match(
    doc.querySelector('meta[name="viewport"]').content,
    /viewport-fit=cover/,
  );
  assert.match(doc.title, /Fridge Friends/);
  assert.ok(doc.querySelectorAll("script").length);
  for (const script of doc.querySelectorAll("script")) {
    assert.equal(script.type, "module");
    assert.ok(script.getAttribute("src").startsWith("./"));
    assert.equal(script.textContent.trim(), "");
  }
  dom.window.close();
});

test("all entry assets and manifest paths resolve at root and repository URLs", async () => {
  for (const mount of ["/", "/recipe-app/"]) {
    const page = new URL(mount, "https://example.github.io");
    const dom = new JSDOM(html, { url: page.href });
    const doc = dom.window.document;
    const links = [...doc.querySelectorAll("[src],link[href]")];
    for (const element of links) {
      const path = element.getAttribute("src") ?? element.getAttribute("href");
      const url = new URL(path, page);
      assert.equal(url.origin, page.origin);
      assert.ok(url.pathname.startsWith(mount));
      await access(new URL(url.pathname.slice(mount.length), output));
    }
    const manifestUrl = new URL(doc.querySelector('link[rel="manifest"]').href);
    const manifest = JSON.parse(
      await readFile(new URL("manifest.webmanifest", output), "utf8"),
    );
    for (const field of ["id", "start_url", "scope"]) {
      assert.equal(new URL(manifest[field], manifestUrl).pathname, mount);
    }
    for (const icon of manifest.icons) {
      const url = new URL(icon.src, manifestUrl);
      assert.ok(url.pathname.startsWith(mount));
      await access(new URL(url.pathname.slice(mount.length), output));
    }
    dom.window.close();
  }
});

test("deployable output contains only intended static files", async () => {
  const rootEntries = (await readdir(output)).sort();
  assert.deepEqual(rootEntries, [
    ".nojekyll",
    "assets",
    "favicon.svg",
    "icons",
    "index.html",
    "manifest.webmanifest",
    "sw.js",
  ]);
  const assets = await readdir(new URL("assets/", output));
  assert.ok(assets.some((name) => /^recipe-spread-.*\.webp$/.test(name)));
  for (const asset of assets) assert.match(asset, /\.(js|css|png|webp)$/);
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of [
    "next",
    "vinext",
    "wrangler",
    "drizzle-orm",
    "react-server-dom-webpack",
    "@cloudflare/vite-plugin",
  ]) {
    assert.equal(dependencies[name], undefined, name);
  }
  assert.ok(fileURLToPath(output).endsWith("/dist/"));
});

test("service worker precaches only real local files and no other origin", async () => {
  const worker = await readFile(new URL("sw.js", output), "utf8");
  const [, cacheName] = worker.match(/const CACHE_NAME = "([^"]+)"/);
  assert.match(cacheName, /^fridge-friends-[0-9a-f]{16}$/);
  assert.doesNotMatch(worker, /__CACHE_NAME__|__PRECACHE__/);

  const precache = JSON.parse(worker.match(/const PRECACHE = (\[[^;]*\]);/)[1]);
  assert.ok(precache.includes("./index.html"));
  assert.ok(precache.some((path) => /^\.\/assets\/.*\.js$/.test(path)));
  assert.ok(!precache.includes("./sw.js"));
  for (const path of precache) {
    assert.ok(path.startsWith("./"), path);
    assert.equal(new URL(path, "https://example.github.io/app/").origin, "https://example.github.io");
    await access(new URL(path.slice(2), output));
  }
  // Every deployable file except the Pages marker is available offline.
  const base = fileURLToPath(output);
  const shipped = (await readdir(output, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map(
      (entry) =>
        `./${relative(base, join(entry.parentPath, entry.name)).split(sep).join("/")}`,
    )
    .filter((name) => name !== "./.nojekyll" && name !== "./sw.js");
  assert.deepEqual([...precache].sort(), shipped.sort());
});
