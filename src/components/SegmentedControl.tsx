import { useId } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string; // accessible group label
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: Props<T>) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full rounded-xl border border-line bg-surface p-1 gap-1"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            id={`${id}-${opt.value}`}
            role="radio"
            aria-checked={selected}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 h-10 rounded-lg text-[14px] font-medium transition-colors motion-reduce:transition-none ${
              selected ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink hover:bg-line/40"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
