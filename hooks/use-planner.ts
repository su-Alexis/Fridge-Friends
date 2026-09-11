"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  initialState,
  MAX_SAVED_LENGTH,
  parseSavedState,
  STORAGE_KEY,
  validateState,
  type PlannerState,
} from "@/lib/planner-state";
import { recipes as builtInRecipes } from "@/lib/recipes";

type Snapshot = { state: PlannerState; error: string | null };
const serverSnapshot: Snapshot = { state: initialState, error: null };
let snapshot = serverSnapshot;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function read() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    snapshot = {
      state: raw ? parseSavedState(raw) : initialState,
      error: null,
    };
  } catch {
    snapshot = {
      ...snapshot,
      error:
        "Saved data could not be loaded. Changes will remain in this window unless saving succeeds.",
    };
  }
  loaded = true;
}
function getSnapshot() {
  if (!loaded) read();
  return snapshot;
}
function onStorage(event: StorageEvent) {
  if (
    event.storageArea === window.localStorage &&
    (event.key === STORAGE_KEY || event.key === null)
  ) {
    read();
    emit();
  }
}
function subscribe(listener: () => void) {
  if (!listeners.size) {
    window.addEventListener("storage", onStorage);
    read();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}
function update(change: (state: PlannerState) => PlannerState) {
  const state = validateState(change(getSnapshot().state));
  const serialized = JSON.stringify(state);
  if (serialized.length > MAX_SAVED_LENGTH)
    throw new Error(
      "Your recipe collection is full. Shorten or remove a custom recipe before adding more.",
    );
  let error: string | null = null;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    error =
      "This browser could not save your changes. Keep this window open to retain your list.";
  }
  snapshot = { state, error };
  emit();
}

export function usePlanner() {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );
  const recipes = useMemo(
    () => [...builtInRecipes, ...current.state.customRecipes],
    [current.state.customRecipes],
  );
  return { ...current, recipes, update };
}
