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
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).mealPlan[
      "strawberry-cheesecake"
    ],
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
  await click(button("Backup"));
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
  await click(button("Backup"));
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
  await click(button("Backup"));
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
  await edit(field("perishables"), "0% Greek yogurt");
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
