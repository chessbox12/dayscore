import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink font-semibold enabled:hover:opacity-90 enabled:active:scale-[0.985] disabled:opacity-40",
  secondary:
    "bg-surface text-ink border border-line font-medium enabled:hover:border-ink-3 enabled:active:scale-[0.985] disabled:opacity-40",
  ghost: "text-ink-2 font-medium enabled:hover:text-ink enabled:hover:bg-line/40 disabled:opacity-40",
  danger:
    "bg-transparent text-danger border border-danger/40 font-medium enabled:hover:bg-danger/10 enabled:active:scale-[0.985] disabled:opacity-40",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", full, className = "", type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`h-12 px-5 rounded-xl text-[15px] inline-flex items-center justify-center gap-2 select-none transition-[transform,opacity,background-color,border-color] motion-reduce:transition-none ${styles[variant]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
});
