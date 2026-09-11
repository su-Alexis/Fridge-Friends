"use client";

import { useState, type ComponentProps } from "react";
import { normalizeQuantity } from "@/lib/ingredients";

export function QuantityInput({
  value,
  onCommit,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange"> & {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== "") {
      const number = Number(draft);
      if (Number.isFinite(number)) onCommit(normalizeQuantity(number));
    }
    setDraft(null);
  };
  return (
    <input
      {...props}
      type="number"
      inputMode="decimal"
      min="0.5"
      max="24"
      step="0.5"
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(null);
        }
      }}
    />
  );
}
