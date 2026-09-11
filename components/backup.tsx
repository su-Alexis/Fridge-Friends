"use client";

import { useRef, useState } from "react";
import { Download, HardDrive, Upload } from "lucide-react";
import { usePlanner } from "@/hooks/use-planner";
import { MAX_SAVED_LENGTH, type PlannerState } from "@/lib/planner-state";
import {
  backupFilename,
  describeBackup,
  parseBackup,
  serializeBackup,
} from "@/lib/backup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BackupDialog({
  onStatus,
}: {
  onStatus: (message: string) => void;
}) {
  const { state, update } = usePlanner();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PlannerState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setError("");
    setPending(null);
    // Clear the input so choosing the same file twice still fires onChange.
    if (fileInput.current) fileInput.current.value = "";
  }

  function exportBackup() {
    setError("");
    try {
      const blob = new Blob([serializeBackup(state)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Release the object URL once the download has had time to start.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onStatus(`Backup downloaded: ${describeBackup(state)}.`);
    } catch {
      setError("This browser could not start the download.");
    }
  }

  async function chooseFile(file: File) {
    reset();
    if (file.size > MAX_SAVED_LENGTH) {
      setError("That file is too large to be a Fridge Friends backup.");
      return;
    }
    try {
      setPending(parseBackup(await file.text()));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `That file could not be restored. ${cause.message}`
          : "That file is not a Fridge Friends backup.",
      );
    }
  }

  function confirmImport() {
    if (!pending) return;
    try {
      update(() => pending);
      onStatus(`Backup restored: ${describeBackup(pending)}.`);
      reset();
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to restore that backup.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className="clear-list">
          <HardDrive size={16} />
          Backup
        </button>
      </DialogTrigger>
      <DialogContent className="recipe-editor">
        <DialogHeader>
          <DialogTitle>Backup and restore</DialogTitle>
          <DialogDescription>
            Recipes and lists are saved only in this browser. Export a file
            before switching devices, browsers, or web addresses.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="backup-panel">
          <section>
            <strong>Export</strong>
            <p className="field-help">Saved now: {describeBackup(state)}.</p>
            <button className="add-list" onClick={exportBackup}>
              <Download size={16} />
              Download backup
            </button>
          </section>
          <section>
            <strong>Restore</strong>
            <p className="field-help">
              Choose a backup file. This replaces everything saved in this
              browser, so export first if you want to keep it.
            </p>
            <label className="clear-list file-label">
              <Upload size={16} />
              Choose backup file
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void chooseFile(file);
                }}
              />
            </label>
            {pending && (
              <div className="backup-confirm">
                <p>Replace your saved data with {describeBackup(pending)}?</p>
                <div className="form-actions">
                  <button type="button" className="clear-list" onClick={reset}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="add-list"
                    onClick={confirmImport}
                  >
                    Replace saved data
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
