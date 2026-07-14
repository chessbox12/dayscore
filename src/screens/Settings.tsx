/** Settings: one flat page — appearance, week start, export, delete. */
import { useState } from "react";
import { Button } from "../components/Button";
import { ChevronLeftIcon, DownloadIcon, TrashIcon } from "../components/Icons";
import { SegmentedControl } from "../components/SegmentedControl";
import { useToast } from "../components/Toast";
import { buildExportCSV, buildExportJSON, downloadFile } from "../lib/export";
import { Route } from "../lib/router";
import { totalLogged } from "../lib/stats";
import { useApp } from "../state/store";

export function SettingsScreen({ navigate }: { navigate: (r: Route) => void }) {
  const app = useApp();
  const toast = useToast();
  const { entries, settings, scores } = app;
  const [confirming, setConfirming] = useState(false);
  const count = totalLogged(scores);

  const set = (patch: Parameters<typeof app.updateSettings>[0]) => {
    const res = app.updateSettings(patch);
    if (!res.ok) toast.show(res.error ?? "Couldn't save that setting.", "error");
  };

  const exportAs = (kind: "json" | "csv") => {
    const content = kind === "json" ? buildExportJSON(entries) : buildExportCSV(entries);
    const res = downloadFile(`dayscore-export.${kind}`, content, kind === "json" ? "application/json" : "text/csv");
    toast.show(res.ok ? "Export started." : res.error, res.ok ? "success" : "error");
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-1 -ml-2.5">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate({ screen: "home" })}
          className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-2 hover:text-ink hover:bg-line/40"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-[22px] font-semibold tracking-tight">Settings</h1>
      </header>

      <section>
        <h2 className="text-[13px] font-medium text-ink-3 mb-3">Theme</h2>
        <SegmentedControl
          label="Theme"
          value={settings.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </section>

      <section className="hairline-t pt-5">
        <h2 className="text-[13px] font-medium text-ink-3 mb-3">Week starts on</h2>
        <SegmentedControl
          label="First day of the week"
          value={String(settings.weekStartsOn) as "0" | "1"}
          onChange={(v) => set({ weekStartsOn: v === "0" ? 0 : 1 })}
          options={[
            { value: "1", label: "Monday" },
            { value: "0", label: "Sunday" },
          ]}
        />
      </section>

      <section className="hairline-t pt-5 space-y-3">
        <h2 className="text-[13px] font-medium text-ink-3">Export</h2>
        <div className="flex gap-3">
          <Button variant="secondary" className="h-11 flex-1" onClick={() => exportAs("json")} disabled={count === 0}>
            <DownloadIcon size={16} /> JSON
          </Button>
          <Button variant="secondary" className="h-11 flex-1" onClick={() => exportAs("csv")} disabled={count === 0}>
            <DownloadIcon size={16} /> CSV
          </Button>
        </div>
      </section>

      <section className="hairline-t pt-5 space-y-3">
        {confirming ? (
          <div role="alert" className="space-y-3">
            <p className="text-[14px] text-ink">
              This permanently deletes all {count} logged {count === 1 ? "day" : "days"} from this device. There's
              no undo.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  app.deleteAllData();
                  setConfirming(false);
                  toast.show("All data deleted.", "info");
                }}
              >
                Delete everything
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="h-11" onClick={() => setConfirming(true)} disabled={count === 0}>
            <TrashIcon size={16} /> Delete all data
          </Button>
        )}
      </section>

      <p className="hairline-t pt-5 text-[12px] text-ink-3">
        {count} {count === 1 ? "day" : "days"} logged · Your data stays in this browser — nothing is sent
        anywhere.
      </p>
    </div>
  );
}
