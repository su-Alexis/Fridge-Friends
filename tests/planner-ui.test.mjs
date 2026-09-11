import assert from "node:assert/strict";
import test, { after, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"></div></body></html>',
  { url: "https://fridge.test", pretendToBeVisual: true },
);
for (const key of [
  "window",
  "document",
  "navigator",
  "Node",
  "NodeFilter",
  "Document",
  "DocumentFragment",
  "Text",
  "SVGElement",
  "HTMLCollection",
  "Option",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "HTMLFormElement",
  "HTMLButtonElement",
  "FormData",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "MutationObserver",
  "getComputedStyle",
]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({
  matches: true,
  addEventListener() {},
  removeEventListener() {},
});
window.scrollTo = () => {};
HTMLElement.prototype.scrollIntoView = () => {};
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
});
const { default: Home } = await vite.ssrLoadModule("/app/page.tsx");
const { STORAGE_KEY } = await vite.ssrLoadModule("/lib/planner-state.ts");
const { recipes: catalog } = await vite.ssrLoadModule("/lib/recipes.ts");
// The picker opens on the first catalog recipe; derive it rather than pinning
// a specific ID, so editing the catalog does not break this test.
const firstId = catalog[0].id;
// A refrigerated ingredient the catalog actually uses, for the matching check.
const sharedPerishable = catalog[0].perishables[0];
const { QuantityInput } = await vite.ssrLoadModule(
  "/components/quantity-input.tsx",
);
let root;
async function mount(Component = Home, props = {}) {
  root = createRoot(document.getElementById("app"));
  await act(async () => root.render(createElement(Component, props)));
}
async function unmount() {
  if (root) await act(async () => root.unmount());
  root = null;
}
afterEach(unmount);
after(async () => {
  await unmount();
  await vite.close();
  dom.window.close();
});
const click = (element) =>
  act(async () => {
    assert.ok(element);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const button = (text) =>
  [...document.querySelectorAll("button")].find(
    (element) => element.textContent.trim() === text,
  );
const ariaButton = (text) =>
  document.querySelector(`button[aria-label="${text}"]`);
async function edit(input, value) {
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(
      input.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    ).set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("shopping flow survives remount, resets checks after quantity edits, and confirms clearing", async () => {
  window.localStorage.clear();
  await mount();
  await click(button("Add to grocery list"));
  assert.equal(document.querySelectorAll(".planned-card").length, 1);
  const checkbox = document.querySelector(".check-item input");
  assert.ok(checkbox.getAttribute("aria-label"));
  await click(checkbox);
  assert.equal(checkbox.checked, true);
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(Object.keys(saved.checked).length, 1);
  await unmount();
  await mount();
  assert.equal(document.querySelector(".check-item input").checked, true);
  await click(ariaButton("Increase recipe batches"));
  await click(button("Update grocery list"));
  assert.equal(document.querySelector(".check-item input").checked, false);
  assert.equal(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).mealPlan[firstId],
    1.5,
  );
  await click(button("Clear list"));
  assert.ok(document.querySelector('[role="alertdialog"]'));
  await click(button("Keep list"));
  assert.equal(document.querySelectorAll(".planned-card").length, 1);
  await click(button("Clear list"));
  await click(
    document.querySelector(
      '[role="alertdialog"] [data-slot="alert-dialog-action"]',
    ),
  );
  assert.equal(document.querySelectorAll(".planned-card").length, 0);
  await unmount();
});

test("blocked storage keeps the current list usable and explains failed saving", async () => {
  window.localStorage.clear();
  await mount();
  const original = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = () => {
    throw new Error("Quota exceeded");
  };
  try {
    await click(button("Add to grocery list"));
    assert.equal(document.querySelectorAll(".planned-card").length, 1);
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /could not save/,
    );
  } finally {
    dom.window.Storage.prototype.setItem = original;
    await unmount();
  }
});

test("corrupt storage does not crash initial render", async () => {
  window.localStorage.setItem(STORAGE_KEY, "{");
  await mount();
  assert.match(
    document.querySelector('[role="alert"]').textContent,
    /could not be loaded/,
  );
  assert.ok(document.querySelector("#recipe-picker"));
  await unmount();
});

test("quantity edits allow clearing while typing and cancel with Escape", async () => {
  let committed = null;
  await mount(QuantityInput, {
    value: 1,
    onCommit: (n) => {
      committed = n;
    },
  });
  const input = document.querySelector("input");
  await edit(input, "");
  assert.equal(input.value, "");
  await edit(input, "12");
  await act(async () => input.blur());
  assert.equal(committed, 12);
  committed = null;
  await edit(input, "8");
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  await act(async () => input.blur());
  assert.equal(committed, null);
  assert.equal(input.value, "1");
  await unmount();
});

test("backup exports the saved planner and restores it into a cleared browser", async () => {
  window.localStorage.clear();
  await mount();
  await click(button("Add to grocery list"));
  const planned = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).mealPlan;
  assert.equal(Object.keys(planned).length, 1);

  // Capture what the download would have contained.
  // The component resolves URL from globalThis, not from the jsdom window.
  let exported = null;
  const realCreate = globalThis.URL.createObjectURL;
  globalThis.URL.createObjectURL = (blob) => {
    exported = blob;
    return "blob:captured";
  };
  globalThis.URL.revokeObjectURL = () => {};
  await click(button("Backup & restore"));
  await click(button("Download backup"));
  globalThis.URL.createObjectURL = realCreate;
  assert.equal(
    document.querySelector(".form-error")?.textContent ?? null,
    null,
    "export reported an error",
  );
  assert.ok(exported, "no backup blob was produced");
  const json = await exported.text();
  assert.deepEqual(JSON.parse(json).mealPlan, planned);
  await unmount();

  // A cleared browser, as after moving to a new hostname or wrapper origin.
  window.localStorage.clear();
  await mount();
  assert.equal(window.localStorage.getItem(STORAGE_KEY), null);
  await click(button("Backup & restore"));
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    value: [new File([json], "backup.json", { type: "application/json" })],
    configurable: true,
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  assert.match(
    document.querySelector(".backup-confirm").textContent,
    /Replace your saved data/,
  );
  await click(button("Replace saved data"));
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).mealPlan,
    planned,
  );
  await unmount();
});

test("restoring refuses a file that is not a valid backup", async () => {
  window.localStorage.clear();
  await mount();
  await click(button("Backup & restore"));
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    value: [
      new File(['{"version":1,"customRecipes":[{"id":"__proto__"}]}'], "bad.json", {
        type: "application/json",
      }),
    ],
    configurable: true,
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  assert.ok(document.querySelector(".form-error"), "no error was shown");
  assert.equal(document.querySelector(".backup-confirm"), null);
  await unmount();
});

test("custom recipe form validates text, persists, matches, edits, and deletes safely", async () => {
  window.localStorage.clear();
  await mount();
  await click(button("Add recipe"));
  const field = (name) => document.querySelector(`[name="${name}"]`);
  await edit(field("name"), "My yogurt bowl");
  await edit(field("style"), "Yogurt bowl");
  await edit(field("perishables"), sharedPerishable);
  await edit(field("ingredients"), "1 cup 0% Greek yogurt\n100g strawberries");
  await edit(field("instructions"), "<script>alert(1)</script>");
  const submit = () =>
    act(async () =>
      document
        .querySelector(".recipe-form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
  await submit();
  assert.match(document.querySelector(".form-error").textContent, /plain text/);
  assert.equal(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").customRecipes
      ?.length ?? 0,
    0,
  );
  await edit(field("instructions"), "Mix the ingredients in a bowl.");
  await submit();
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.match(
    document.querySelector(".selected-recipe h2").textContent,
    /My yogurt bowl/,
  );
  assert.ok(document.querySelectorAll(".match-card").length > 0);
  await click(button("Add to grocery list"));
  assert.match(
    document.querySelector(".planned-card").textContent,
    /My yogurt bowl/,
  );
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(saved.customRecipes.length, 1);
  assert.equal(saved.mealPlan[saved.customRecipes[0].id], 1);
  await unmount();
  await mount();
  assert.match(
    document.querySelector(".selected-recipe h2").textContent,
    /My yogurt bowl/,
  );
  await click(button("Edit recipe"));
  await edit(field("name"), "My updated bowl");
  await submit();
  assert.match(
    document.querySelector(".planned-card").textContent,
    /My updated bowl/,
  );
  await click(button("Delete recipe"));
  await click(
    document.querySelector(
      '[role="alertdialog"] [data-slot="alert-dialog-action"]',
    ),
  );
  assert.equal(document.querySelectorAll(".planned-card").length, 0);
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).customRecipes,
    [],
  );
});

test("goal filter hides recipes, moves the selection, and can be emptied", async () => {
  window.localStorage.clear();
  await mount();
  const option = (label) =>
    [...document.querySelectorAll(".goal-option")].find((el) =>
      el.textContent.includes(label),
    );
  const box = (label) => option(label).querySelector("input");
  const labels = ["Cutting", "Bulking", "Depends on portion size"];
  for (const label of labels)
    assert.equal(box(label).checked, true, "filters should start inclusive");

  // Every recipe on screen carries its goal label.
  assert.ok(document.querySelector(".goal-badge"), "no goal badge rendered");

  // Unticking the selected recipe's goal must not leave it on screen.
  const shownGoal = document
    .querySelector(".goal-badge")
    .textContent.trim();
  await click(box(shownGoal));
  assert.notEqual(
    document.querySelector(".goal-badge").textContent.trim(),
    shownGoal,
    "a hidden recipe stayed selected",
  );

  // Every filter off is allowed, and says so rather than showing nothing.
  for (const label of labels) if (box(label).checked) await click(box(label));
  assert.ok(
    document.querySelector(".empty-picker"),
    "no message when every goal is filtered out",
  );
  await unmount();
});

test("fridge finder lists recipes for the ingredients you tick", async () => {
  window.localStorage.clear();
  await mount();
  const items = [...document.querySelectorAll(".fridge-item")];
  assert.ok(items.length > 10, "ingredient picker did not render");
  // It seeds from the selected recipe, so results are present immediately.
  const seeded = document.querySelectorAll("#fridge-finder .match-card").length;
  assert.ok(seeded > 0, "no recipes for the seeded ingredients");

  await click(document.querySelector("#fridge-finder .finder-actions button"));
  assert.ok(
    document.querySelector("#fridge-finder .empty-matches"),
    "clearing the fridge should prompt for ingredients",
  );
  assert.equal(
    document.querySelectorAll("#fridge-finder .match-card").length,
    0,
  );

  // Ticking one ingredient brings recipes back.
  await click(items[0].querySelector("input"));
  assert.ok(
    document.querySelectorAll("#fridge-finder .match-card").length > 0,
    "ticking an ingredient produced no recipes",
  );
  await unmount();
});

test("macros show for the selected recipe and scale with the batch count", async () => {
  window.localStorage.clear();
  await mount();
  const tiles = () =>
    [...document.querySelectorAll(".macro-tile")].map((t) => ({
      label: t.querySelector(".macro-label").textContent.trim(),
      value: t.querySelector(".macro-value").textContent.trim(),
    }));
  const one = tiles();
  assert.ok(one.length >= 2, "no macro tiles rendered");
  assert.equal(one[0].label, "Calories");
  const calories = Number(one[0].value.replace(/,/g, ""));
  assert.ok(calories > 0, `unexpected calories: ${one[0].value}`);
  assert.match(
    document.querySelector(".macros h3").textContent,
    /for 1 batch/,
  );

  // Two batches doubles the figures.
  await click(ariaButton("Increase recipe batches"));
  await click(ariaButton("Increase recipe batches"));
  const two = tiles();
  assert.match(document.querySelector(".macros h3").textContent, /for 2 batches/);
  assert.equal(Number(two[0].value.replace(/,/g, "")), calories * 2);
  await unmount();
});

test("saving a recipe shows a visible notice about backing it up", async () => {
  window.localStorage.clear();
  await mount();
  await click(button("Add recipe"));
  const field = (name) => document.querySelector(`[name="${name}"]`);
  await edit(field("name"), "Toast test bowl");
  await edit(field("style"), "Bowl");
  await edit(field("perishables"), sharedPerishable);
  await edit(field("ingredients"), "1 cup rice");
  await edit(field("instructions"), "Cook it.");
  await act(async () =>
    document
      .querySelector(".recipe-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );

  const toast = document.querySelector(".toast");
  assert.ok(toast, "no visible notice after saving");
  const text = toast.textContent;
  assert.match(text, /Toast test bowl/);
  assert.match(text, /refresh|reopen/i, "does not say the recipe persists");
  assert.match(text, /clearing your browsing data/i, "does not warn about data loss");
  assert.match(text, /Backup/i, "does not point at Backup & restore");
  // Data-loss warnings must not vanish on their own.
  assert.equal(toast.getAttribute("data-important"), "true");
  assert.equal(
    document.querySelector(".toast-region").getAttribute("role"),
    "status",
    "notice is not announced to screen readers",
  );

  await click(document.querySelector(".toast-close"));
  assert.equal(document.querySelector(".toast"), null, "notice would not dismiss");
  await unmount();
});

test("typing in the search filters the picker on each keystroke", async () => {
  window.localStorage.clear();
  await mount();
  const input = document.querySelector(".recipe-search input");
  assert.ok(input, "no search field");
  assert.match(input.placeholder, /chicken/i, "placeholder gives no example");
  const shown = () => document.querySelector(".search-count").textContent;
  const all = shown();

  // Character by character, the count narrows as it goes.
  let previous = Infinity;
  for (const partial of ["b", "bu", "bur", "burr"]) {
    await edit(input, partial);
    const count = Number(shown().match(/\d+/)[0]);
    assert.ok(count <= previous, `"${partial}" widened the list`);
    previous = count;
  }
  assert.notEqual(shown(), all, "search did not filter anything");
  await edit(input, "");
  assert.equal(shown(), all, "clearing the search did not restore the list");
  await unmount();
});

test("search shows a results list you can pick from with the keyboard", async () => {
  window.localStorage.clear();
  await mount();
  const input = document.querySelector(".recipe-search input");
  const options = () => [...document.querySelectorAll('.search-results [role="option"]')];
  assert.equal(options().length, 0, "results showed before typing");

  await edit(input, "burr");
  await act(async () => input.dispatchEvent(new Event("focus", { bubbles: true })));
  assert.ok(options().length > 0, "no results list while typing");
  assert.equal(
    input.getAttribute("role"),
    "combobox",
    "search input is not exposed as a combobox",
  );
  assert.equal(input.getAttribute("aria-expanded"), "true");

  // The first option is highlighted, and arrow keys move the highlight.
  assert.equal(options()[0].getAttribute("aria-selected"), "true");
  const firstName = options()[0].textContent;
  const press = (key) =>
    act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      ),
    );
  await press("ArrowDown");
  assert.equal(options()[1].getAttribute("aria-selected"), "true");
  assert.notEqual(options()[1].textContent, firstName);

  // Enter picks the highlighted recipe and clears the search.
  const chosen = options()[1].querySelector(".search-result-name").textContent;
  await press("Enter");
  assert.match(document.querySelector(".selected-recipe h2").textContent, new RegExp(chosen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(input.value, "", "search did not clear after choosing");
  assert.equal(options().length, 0, "results stayed open after choosing");
  await unmount();
});

test("the finder has its own goal options, shared with the picker", async () => {
  window.localStorage.clear();
  await mount();
  const finderGoals = [...document.querySelectorAll(".finder-goals .goal-option")];
  assert.equal(finderGoals.length, 3, "finder is missing the goal options");
  assert.deepEqual(
    finderGoals.map((el) => el.textContent.replace(/\d+$/, "").trim()),
    ["Cutting", "Bulking", "Depends on portion size"],
  );

  assert.ok(
    document.querySelectorAll("#fridge-finder .match-card").length > 0,
    "no results to begin with",
  );

  // Unticking two goals in the finder leaves only the third in the results.
  for (const label of ["Bulking", "Depends on portion size"])
    await click(
      finderGoals
        .find((el) => el.textContent.includes(label))
        .querySelector("input"),
    );
  const badges = [...document.querySelectorAll("#fridge-finder .goal-badge")];
  assert.ok(badges.length > 0, "goal filter emptied the results");
  assert.ok(
    badges.every((b) => /cutting/i.test(b.textContent)),
    "a non-cutting recipe survived the filter",
  );

  // The picker's copy of the filter reflects the same state.
  assert.deepEqual(
    [...document.querySelectorAll(".picker-card .goal-option input")].map(
      (i) => i.checked,
    ),
    [true, false, false],
    "the two filters disagree",
  );
  await unmount();
});
