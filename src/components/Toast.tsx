/**
 * Toasts: transient confirmations and errors. Errors can carry a retry action.
 * Announced politely to screen readers via the aria-live region.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show: (text: string, kind?: Toast["kind"], action?: Toast["action"]) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (text: string, kind: Toast["kind"] = "info", action?: Toast["action"]) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, text, kind, action }]);
      // Errors with actions stay longer so users can react.
      const ttl = kind === "error" ? (action ? 10000 : 6000) : 3500;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="fixed left-1/2 -translate-x-1/2 bottom-[calc(24px+env(safe-area-inset-bottom))] md:bottom-8 z-[60] flex flex-col items-center gap-2 w-[calc(100%-40px)] max-w-sm pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-[14px] animate-pop-in ${
              t.kind === "error"
                ? "bg-danger text-white"
                : "bg-ink text-bg"
            }`}
          >
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
                className="font-semibold underline underline-offset-2 shrink-0"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100 text-[18px] leading-none px-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
