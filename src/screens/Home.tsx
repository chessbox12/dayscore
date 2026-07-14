/**
 * The whole app on one screen: rate today, then the month as a quiet gradient
 * calendar. Tap any past day to view or edit it in the sheet.
 */
import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { CatAvatar } from "../components/CatAvatar";
import { EntrySheet } from "../components/EntrySheet";
import { Heatmap, HeatmapLegend } from "../components/Heatmap";
import { ChevronLeftIcon, ChevronRightIcon, GearIcon, RefreshIcon } from "../components/Icons";
import { ScorePicker } from "../components/ScorePicker";
import { addMonths, formatHuman, formatMonthTitle, ISODate, monthOf } from "../lib/dates";
import { Route } from "../lib/router";
import { roastFor } from "../lib/roasts";
import { SCORE_LABELS } from "../lib/score";
import { currentStreak, monthlyAverage } from "../lib/stats";
import { useApp } from "../state/store";
import { useToast } from "../components/Toast";

export function HomeScreen({ navigate }: { navigate: (r: Route) => void }) {
  const app = useApp();
  const toast = useToast();
  const { scores, entries, settings, today } = app;

  const current = monthOf(today);
  const [view, setView] = useState<{ y: number; m: number }>(current);
  const [pickedScore, setPickedScore] = useState<number | null>(null);
  const [sheetDate, setSheetDate] = useState<ISODate | null>(null);
  const [roastSpin, setRoastSpin] = useState(0);

  const todayEntry = entries[today];
  const isCurrentMonth = view.y === current.y && view.m === current.m;
  const month = useMemo(() => monthlyAverage(scores, view.y, view.m), [scores, view]);
  const streak = useMemo(() => currentStreak(scores, today), [scores, today]);

  const submit = () => {
    if (pickedScore === null) return;
    const result = app.logDay(today, pickedScore);
    if (!result.ok) {
      toast.show(result.error ?? "That didn't save. Try again.", "error");
      return;
    }
    if (result.saveWarning) {
      toast.show(result.saveWarning, "error", {
        label: "Retry",
        run: () => {
          const r = app.retryPersist();
          toast.show(r.ok ? "Saved." : r.error ?? "Still not saving.", r.ok ? "success" : "error");
        },
      });
    }
    setPickedScore(null);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CatAvatar size={64} />
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-ink-2">{formatHuman(today)}</p>
            <h1 className="text-[24px] font-semibold tracking-tight mt-0.5">
              {todayEntry ? "Today, rated." : "How was your day?"}
            </h1>
          </div>
        </div>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => navigate({ screen: "settings" })}
          className="w-11 h-11 -mr-2 -mt-1 inline-flex items-center justify-center rounded-xl text-ink-3 hover:text-ink hover:bg-line/40"
        >
          <GearIcon />
        </button>
      </header>

      {todayEntry ? (
        <section aria-label="Today's entry" className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-[24px] font-bold tabular-nums"
            style={{
              background: `var(--score-${todayEntry.score})`,
              color: `var(--score-ink-${todayEntry.score})`,
            }}
          >
            {todayEntry.score}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug" aria-live="polite">
              “{roastFor(today, todayEntry.score, roastSpin)}”
            </p>
            <p className="text-[13px] text-ink-3 mt-1">
              {todayEntry.score} — {SCORE_LABELS[todayEntry.score]}
              {todayEntry.note ? " · has note" : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="New roast"
            title="New roast"
            onClick={() => setRoastSpin((n) => n + 1)}
            className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl text-ink-3 hover:text-ink hover:bg-line/40"
          >
            <RefreshIcon size={16} />
          </button>
          <Button variant="ghost" className="h-10 px-3 text-[13px] shrink-0" onClick={() => setSheetDate(today)}>
            Edit
          </Button>
        </section>
      ) : (
        <section aria-label="Rate today" className="space-y-4">
          <ScorePicker value={pickedScore} onChange={setPickedScore} />
          <Button full disabled={pickedScore === null} onClick={submit}>
            Log my day
          </Button>
        </section>
      )}

      <section aria-label="Calendar" className="hairline-t pt-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight">{formatMonthTitle(view.y, view.m)}</h2>
          <div className="flex items-center">
            {!isCurrentMonth && (
              <Button variant="ghost" className="h-10 px-3 text-[13px]" onClick={() => setView(current)}>
                Today
              </Button>
            )}
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView(addMonths(view.y, view.m, -1))}
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-ink-2 hover:text-ink hover:bg-line/40"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView(addMonths(view.y, view.m, 1))}
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-ink-2 hover:text-ink hover:bg-line/40"
            >
              <ChevronRightIcon size={18} />
            </button>
          </div>
        </div>

        <Heatmap
          y={view.y}
          m={view.m}
          scores={scores}
          today={today}
          weekStartsOn={settings.weekStartsOn}
          onSelectDate={(d) => setSheetDate(d)}
          selectedDate={sheetDate}
        />

        <HeatmapLegend />

        <p className="text-[13px] text-ink-3" aria-live="polite">
          {month.count > 0
            ? `${month.count} ${month.count === 1 ? "day" : "days"} logged · average ${month.average!.toFixed(1)}`
            : "Nothing logged this month yet."}
          {streak >= 2 && isCurrentMonth ? ` · ${streak}-day streak` : ""}
        </p>
      </section>

      <EntrySheet date={sheetDate} onClose={() => setSheetDate(null)} />
    </div>
  );
}
