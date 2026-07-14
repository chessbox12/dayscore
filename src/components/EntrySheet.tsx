/**
 * View / edit / delete a day's entry — one sheet, no extra screens.
 * Also used to log a past day that was missed.
 */
import { FormEvent, useEffect, useState } from "react";
import { MAX_NOTE_LENGTH } from "../lib/db";
import { formatHuman, ISODate } from "../lib/dates";
import { useApp } from "../state/store";
import { Button } from "./Button";
import { ScorePicker } from "./ScorePicker";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

interface Props {
  date: ISODate | null;
  onClose: () => void;
}

export function EntrySheet({ date, onClose }: Props) {
  const { entries, logDay, deleteDay, retryPersist } = useApp();
  const toast = useToast();
  const entry = date ? entries[date] : undefined;

  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (date) {
      setScore(entry?.score ?? null);
      setNote(entry?.note ?? "");
      setConfirmingDelete(false);
    }
    // Reset only when the sheet opens for a (new) date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!date) return null;

  const isEdit = entry !== undefined;

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (score === null) return;
    const result = logDay(date, score, note);
    if (!result.ok) {
      toast.show(result.error ?? "That didn't save. Try again.", "error");
      return;
    }
    if (result.saveWarning) {
      toast.show(result.saveWarning, "error", {
        label: "Retry",
        run: () => {
          const r = retryPersist();
          toast.show(r.ok ? "Saved." : r.error ?? "Still not saving.", r.ok ? "success" : "error");
        },
      });
    } else {
      toast.show(isEdit ? "Entry updated." : "Day logged.", "success");
    }
    onClose();
  };

  const handleDelete = () => {
    const res = deleteDay(date);
    if (!res.ok) {
      toast.show(res.error ?? "Couldn't delete that entry.", "error", {
        label: "Retry",
        run: () => {
          const r = retryPersist();
          toast.show(r.ok ? "Deleted." : r.error ?? "Still not saving.", r.ok ? "success" : "error");
        },
      });
      return;
    }
    toast.show("Entry deleted.", "info");
    onClose();
  };

  return (
    <Sheet open={date !== null} onClose={onClose} title={formatHuman(date)}>
      <form onSubmit={handleSave} className="space-y-5 pt-2">
        <ScorePicker compact value={score} onChange={setScore} />
        <div>
          <label htmlFor="entry-note" className="block text-[13px] font-medium text-ink-2 mb-1.5">
            Note <span className="text-ink-3 font-normal">(optional)</span>
          </label>
          <textarea
            id="entry-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={2}
            placeholder="Anything worth remembering?"
            className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 resize-none"
          />
          {note.length > MAX_NOTE_LENGTH - 80 && (
            <p className="text-[12px] text-ink-3 mt-1 text-right" aria-live="polite">
              {MAX_NOTE_LENGTH - note.length} characters left
            </p>
          )}
        </div>
        <div className="space-y-3">
          <Button type="submit" full disabled={score === null}>
            {isEdit ? "Save changes" : "Log this day"}
          </Button>
          {isEdit &&
            (confirmingDelete ? (
              <div className="flex gap-3" role="alert">
                <Button variant="danger" full onClick={handleDelete}>
                  Yes, delete it
                </Button>
                <Button variant="secondary" full onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <Button variant="ghost" full onClick={() => setConfirmingDelete(true)}>
                Delete this entry
              </Button>
            ))}
        </div>
      </form>
    </Sheet>
  );
}
