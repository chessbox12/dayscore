import { useEffect, useRef } from "react";
import { ToastProvider, useToast } from "./components/Toast";
import { useRoute } from "./lib/router";
import { HomeScreen } from "./screens/Home";
import { SettingsScreen } from "./screens/Settings";
import { AppProvider, useApp } from "./state/store";

function Shell() {
  const app = useApp();
  const [route, navigate] = useRoute();
  const toast = useToast();

  // Surface data-recovery notices once, loudly enough to be seen.
  const noticeShown = useRef<string | null>(null);
  useEffect(() => {
    if (app.dataNotice && noticeShown.current !== app.dataNotice) {
      noticeShown.current = app.dataNotice;
      toast.show(app.dataNotice, "error");
    }
  }, [app.dataNotice, toast]);

  return (
    <main className="max-w-md mx-auto px-5 sm:px-6 pt-[max(env(safe-area-inset-top),24px)] md:pt-12 pb-[calc(40px+env(safe-area-inset-bottom))]">
      {route.screen === "settings" ? (
        <SettingsScreen navigate={navigate} />
      ) : (
        <HomeScreen navigate={navigate} />
      )}
    </main>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
}
