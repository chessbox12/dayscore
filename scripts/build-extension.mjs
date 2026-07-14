// Assembles the Chrome extension after `vite build --outDir dist-extension`:
// drops in the manifest + icons, then zips the result for the Web Store.
import { cpSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

const out = "dist-extension";
cpSync("extension/manifest.json", `${out}/manifest.json`);
cpSync("extension/icons", `${out}/icons`, { recursive: true });

rmSync("dayscore-extension.zip", { force: true });
execSync(`cd ${out} && zip -qr ../dayscore-extension.zip .`, { stdio: "inherit" });
console.log("✓ dayscore-extension.zip — or load dist-extension/ unpacked at chrome://extensions");
