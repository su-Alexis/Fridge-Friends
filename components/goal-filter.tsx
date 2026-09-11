"use client";

import { Check } from "lucide-react";
import type { Recipe } from "@/lib/recipe-schema";

export type Goal = Recipe["goal"];
export type GoalFilter = Record<Goal, boolean>;

export const ALL_GOALS: GoalFilter = {
  Cutting: true,
  Bulking: true,
  Either: true,
};

// "Either" means no goal was designated: it depends on portion size.
export const GOAL_LABEL: Record<Goal, string> = {
  Cutting: "Cutting",
  Bulking: "Bulking",
  Either: "Depends on portion size",
};

export function GoalBadge({ goal }: { goal: Goal }) {
  return (
    <span className="goal-badge" data-goal={goal}>
      {GOAL_LABEL[goal]}
    </span>
  );
}

export function GoalFilterBar({
  value,
  counts,
  onChange,
}: {
  value: GoalFilter;
  counts: Record<Goal, number>;
  onChange: (next: GoalFilter) => void;
}) {
  const goals: Goal[] = ["Cutting", "Bulking", "Either"];
  const toggle = (goal: Goal) => onChange({ ...value, [goal]: !value[goal] });
  return (
    <fieldset className="goal-filter">
      <legend className="mini-label">Show recipes for</legend>
      <div className="goal-options">
        {goals.map((goal) => (
          <label key={goal} className="goal-option" data-goal={goal}>
            <input
              type="checkbox"
              checked={value[goal]}
              onChange={() => toggle(goal)}
            />
            <span className="goal-tick" aria-hidden="true">
              <Check size={12} strokeWidth={3} />
            </span>
            {GOAL_LABEL[goal]}
            <span className="goal-count">{counts[goal]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
