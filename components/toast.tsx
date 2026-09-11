"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export type Notice = { text: string; important: boolean } | null;

export function Toast({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss: () => void;
}) {
  const important = notice?.important ?? false;
  const text = notice?.text ?? "";
  useEffect(() => {
    // Routine confirmations fade on their own. Anything warning about losing
    // data stays until it is read and dismissed.
    if (!text || important) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [text, important, onDismiss]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {notice && (
        <div className="toast" data-important={important}>
          <p>{notice.text}</p>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss message"
            onClick={onDismiss}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
