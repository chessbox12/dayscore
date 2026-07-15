/**
 * Chrome Web Store screenshots (1280×800 JPEG) into store-assets/.
 * Drives the system Chrome headlessly via puppeteer-core against a static
 * server for dist/, with a demo year of ratings seeded into an isolated
 * temp profile — nothing touches real browser data. Run `npm run build` first.
 */
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "/dayscore/";
const OUT = "store-assets";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  const path = req.url.split("?")[0];
  const file = path.startsWith(BASE) ? path.slice(BASE.length) || "index.html" : null;
  try {
    const data = await readFile(join("dist", file));
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}${BASE}`;

/** Deterministic demo data: most days logged, scores 3–10, today fixed low
    so the roast on display has some bite. */
function demoEntries(includeToday) {
  const pad = (n) => String(n).padStart(2, "0");
  const today = new Date();
  const entries = [];
  for (let dt = new Date(today.getFullYear(), 0, 1); dt <= today; dt.setDate(dt.getDate() + 1)) {
    const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const isToday = dt.toDateString() === today.toDateString();
    if (isToday && !includeToday) continue;
    let h = 5381;
    for (const c of date) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    if (!isToday && h % 100 < 12) continue; // leave ~12% of days unlogged
    entries.push({
      id: `demo-${date}`,
      userId: "guest",
      date,
      score: isToday ? 3 : 3 + (h % 8),
      createdAt: "2026-01-01T12:00:00.000Z",
      updatedAt: "2026-01-01T12:00:00.000Z",
    });
  }
  return entries;
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

async function shoot(name, { includeToday, dark = false, prepare } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  // Headless Chrome may default to dark; pin the scheme either way.
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: dark ? "dark" : "light" },
  ]);
  const seed = JSON.stringify(demoEntries(includeToday));
  await page.evaluateOnNewDocument((data) => {
    localStorage.setItem("dayscore:entries:guest", data);
  }, seed);
  await page.goto(url, { waitUntil: "networkidle0" });
  if (prepare) await prepare(page);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: "jpeg", quality: 92 });
  await page.close();
  console.log(`✓ ${OUT}/${name}.jpg`);
}

await shoot("1-rate-your-day", { includeToday: false });
await shoot("2-roast", { includeToday: true });
await shoot("3-year-heatmap", {
  includeToday: true,
  prepare: async (page) => {
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => b.textContent === "Year")?.click();
    });
    await page.evaluate(() => {
      document.body.style.zoom = "0.8";
      document.querySelector('section[aria-label="Calendar"]')?.scrollIntoView({ block: "start" });
    });
  },
});
await shoot("4-dark-mode", { includeToday: true, dark: true });

await browser.close();
server.close();
