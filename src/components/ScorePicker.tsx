/**
 * The 1–10 score selector: two rows of five large tap targets. Behaves as a
 * radiogroup (roving tabindex, arrow keys); the selected score fills with its
 * heatmap colour so the choice is visually prominent before submission.
 */
import { KeyboardEvent, useRef } from "react";
import { SCORE_LABELS } from "../lib/score";

interface Props {
  value: number | null;
  onChange: (score: number) => void;
  compact?: boolean;
}

export function ScorePicker({ value, onChange, compact }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, score: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(10, score + 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, score - 1);
    if (e.key === "Home") next = 1;
    if (e.key === "End") next = 10;
    if (next !== null) {
      e.preventDefault();
      onChange(next);
      refs.current[next - 1]?.focus();
    }
  };

  const tabStop = value ?? 5; // one tab stop; arrows move within the group

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Score from 1 to 10"
        className={`grid grid-cols-5 ${compact ? "gap-1.5" : "gap-2"}`}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              ref={(el) => {
                refs.current[score - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${score} — ${SCORE_LABELS[score]}`}
              tabIndex={score === tabStop ? 0 : -1}
              onClick={() => onChange(score)}
              onKeyDown={(e) => onKey(e, score)}
              style={
                selected
                  ? { background: `var(--score-${score})`, color: `var(--score-ink-${score})` }
                  : undefined
              }
              className={`${compact ? "h-11" : "h-12 sm:h-14"} rounded-xl text-[17px] font-semibold tabular-nums select-none transition-[transform,background-color,border-color,color] duration-150 motion-reduce:transition-none ${
                selected
                  ? "scale-[1.06] shadow-md"
                  : "bg-surface border border-line text-ink-2 hover:border-ink-3 hover:text-ink active:scale-95"
              }`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={`text-center text-[14px] text-ink-2 ${compact ? "mt-2.5 min-h-5" : "mt-3.5 min-h-5"}`}>
        {value ? (
          <>
            <span className="font-semibold text-ink tabular-nums">{value}</span>
            {" — "}
            {SCORE_LABELS[value]}
          </>
        ) : (
          " "
        )}
      </p>
    </div>
  );
}
