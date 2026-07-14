/**
 * Monthly heatmap, kept deliberately plain: every day is a bare square and the
 * score is nothing but colour depth on one blue ramp (--score-1 … --score-10).
 * No numerals in cells — the exact score lives in the tooltip/aria-label and in
 * the sheet a tap opens. Today carries a thin accent ring; future days are
 * near-invisible. Arrow keys move between days (roving tabindex).
 */
import { KeyboardEvent, useMemo, useRef } from "react";
import {
  dayOfWeek,
  daysInMonth,
  formatHuman,
  ISODate,
  makeDate,
  WeekStart,
  weekdayLabels,
} from "../lib/dates";

interface Props {
  y: number;
  m: number;
  scores: Record<ISODate, number>;
  today: ISODate;
  weekStartsOn: WeekStart;
  onSelectDate: (date: ISODate) => void;
  selectedDate?: ISODate | null;
}

export function Heatmap({ y, m, scores, today, weekStartsOn, onSelectDate, selectedDate }: Props) {
  const refs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const { cells, leading } = useMemo(() => {
    const first = makeDate(y, m, 1);
    const lead = (dayOfWeek(first) - weekStartsOn + 7) % 7;
    const total = daysInMonth(y, m);
    return {
      leading: lead,
      cells: Array.from({ length: total }, (_, i) => makeDate(y, m, i + 1)),
    };
  }, [y, m, weekStartsOn]);

  const labels = useMemo(() => weekdayLabels(weekStartsOn), [weekStartsOn]);

  // Roving tabindex: today (if visible), else the selected day, else day 1.
  const tabStopDay = useMemo(() => {
    const todayInMonth = cells.includes(today) ? Number(today.slice(8)) : null;
    const selInMonth = selectedDate && cells.includes(selectedDate) ? Number(selectedDate.slice(8)) : null;
    return todayInMonth ?? selInMonth ?? 1;
  }, [cells, today, selectedDate]);

  const onKey = (e: KeyboardEvent, day: number) => {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    const delta = moves[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = day + delta;
    if (next >= 1 && next <= cells.length) refs.current.get(next)?.focus();
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-[3px] mb-2" aria-hidden="true">
        {labels.map((l) => (
          <div key={l} className="text-center text-[10px] font-medium text-ink-3">
            {l.slice(0, 1)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: leading }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden="true" />
        ))}
        {cells.map((date) => {
          const day = Number(date.slice(8));
          const score = scores[date];
          const isToday = date === today;
          const isFuture = date > today;
          const isSelected = selectedDate === date;
          const human = formatHuman(date);
          const label = isFuture
            ? `${human} — future date`
            : score !== undefined
              ? `${human} — scored ${score} out of 10`
              : `${human} — not logged yet`;
          return (
            <button
              key={date}
              ref={(el) => {
                if (el) refs.current.set(day, el);
                else refs.current.delete(day);
              }}
              type="button"
              disabled={isFuture}
              aria-label={label}
              aria-current={isToday ? "date" : undefined}
              title={isFuture ? undefined : score !== undefined ? `${human} — ${score}/10` : `${human} — not logged`}
              tabIndex={day === tabStopDay ? 0 : -1}
              onKeyDown={(e) => onKey(e, day)}
              onClick={() => onSelectDate(date)}
              style={score !== undefined ? { background: `var(--score-${score})` } : undefined}
              className={`aspect-square rounded-[5px] select-none ${
                score !== undefined
                  ? "enabled:hover:opacity-80"
                  : isFuture
                    ? "bg-line/35"
                    : "bg-line/70 enabled:hover:bg-line"
              } ${isToday ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : ""} ${
                isSelected && !isToday ? "ring-2 ring-ink-3 ring-offset-1 ring-offset-bg" : ""
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Legend: the whole scale as one gradient bar, 1 → 10. */
export function HeatmapLegend() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2.5 text-[11px] text-ink-3">
      <span className="tabular-nums">1</span>
      <div
        className="h-1.5 flex-1 rounded-full"
        style={{
          background:
            "linear-gradient(to right, var(--score-1), var(--score-4), var(--score-7), var(--score-10))",
        }}
      />
      <span className="tabular-nums">10</span>
    </div>
  );
}
