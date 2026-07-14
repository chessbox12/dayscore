// Runs before the bundle. External (not inline) because the Chrome-extension
// CSP forbids inline scripts; the website uses the same file.
(function () {
  try {
    if (location.protocol === "chrome-extension:") {
      document.documentElement.classList.add("ext");
    }
    // Apply theme before first paint to avoid a flash of the wrong mode.
    var raw = localStorage.getItem("dayscore:settings");
    var theme = raw ? JSON.parse(raw).theme : "system";
    var dark =
      theme === "dark" ||
      (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {
    /* fall back to light */
  }
})();
