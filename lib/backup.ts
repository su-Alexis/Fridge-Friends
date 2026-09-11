import { parseSavedState, type PlannerState } from "./planner-state";

// The backup file IS the storage format. An imported file therefore passes
// through exactly the same strict validator that already guards localStorage:
// no second format, no second parser, no new trust boundary.
export function serializeBackup(state: PlannerState): string {
  return JSON.stringify(state);
}

export function parseBackup(raw: string): PlannerState {
  return parseSavedState(raw);
}

export function backupFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `fridge-friends-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}.json`;
}

export function describeBackup(state: PlannerState): string {
  const saved = state.customRecipes.length;
  const planned = Object.keys(state.mealPlan).length;
  return `${saved} personal ${saved === 1 ? "recipe" : "recipes"} and ${planned} planned ${planned === 1 ? "recipe" : "recipes"}`;
}
