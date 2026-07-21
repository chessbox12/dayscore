/**
 * Chrome Web Store screenshots (1280×800 JPEG) into store-assets/.
 * Drives the system Chrome headlessly via puppeteer-core against a static
 * server for dist/, with a demo year of ratings seeded into an isolated
 * temp profile — nothing touches real browser data. Run `npm run build` first.
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
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

// Shots are captured at 4× and downscaled here by progressive halving with
// high-quality smoothing, then written as lossless PNG (plus a near-lossless
// JPEG fallback in case an upload form insists on .jpg).
const scaler = await browser.newPage();
await scaler.goto("about:blank");
async function downscale(b64png, w, h) {
  const out = await scaler.evaluate(
    async ({ b64, w, h }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await new Promise((res, rej) => ((img.onload = res), (img.onerror = rej)));
      let c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      let cw = img.width;
      let ch = img.height;
      while (cw / 2 >= w) {
        cw /= 2;
        ch /= 2;
        const next = document.createElement("canvas");
        next.width = cw;
        next.height = ch;
        const ctx = next.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(c, 0, 0, cw, ch);
        c = next;
      }
      return { png: c.toDataURL("image/png"), jpg: c.toDataURL("image/jpeg", 0.98) };
    },
    { b64: b64png, w, h }
  );
  const buf = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");
  return { png: buf(out.png), jpg: buf(out.jpg) };
}

async function shoot(name, { includeToday, dark = false, prepare, settleMs = 300, hi } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 4 });
  // Headless Chrome may default to dark; pin the scheme either way.
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: dark ? "dark" : "light" },
  ]);
  const seed = JSON.stringify(demoEntries(includeToday));
  await page.evaluateOnNewDocument(
    (data, best) => {
      localStorage.setItem("dayscore:entries:guest", data);
      if (best) localStorage.setItem("dayscore:runner:hi", String(best));
    },
    seed,
    hi ?? 0
  );
  await page.goto(url, { waitUntil: "networkidle0" });
  if (prepare) await prepare(page);
  await new Promise((r) => setTimeout(r, settleMs));
  const raw = await page.screenshot({ type: "png", encoding: "base64" });
  const { png, jpg } = await downscale(raw, 1280, 800);
  writeFileSync(join(OUT, `${name}.png`), png);
  writeFileSync(join(OUT, `${name}.jpg`), jpg);
  await page.close();
  console.log(`✓ ${OUT}/${name}.png (+ .jpg fallback)`);
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
await shoot("5-cat-run", {
  includeToday: true,
  settleMs: 0, // snap the exact frame the wait below finds
  hi: 1024, // the toolbar cat has seen things
  prepare: async (page) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await page.evaluate(() => document.querySelector('button[aria-label="Play Cat Run"]').click());
    // Game math runs in CSS px, so zooming only makes the dialog fill the frame.
    await page.evaluate(() => (document.body.style.zoom = "1.6"));
    await sleep(400);
    await page.keyboard.press("Space"); // start the run
    // Autopilot: jump the stacks, duck the low flyers, restart on a miss —
    // builds a believable score before the photo.
    await page.evaluate(() => {
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
      let duckHeld = false;
      window.__auto = setInterval(() => {
        if (document.body.innerText.includes("run it back")) key("keydown", "Space");
        const obs = [...document.querySelectorAll(".runner-obstacle")].map((el) => ({
          x: parseFloat(/translateX\(([-\d.]+)px\)/.exec(el.style.transform)?.[1] ?? "1e9"),
          bottom: parseFloat(el.style.bottom), // 28 ground · 52 duckable flyer · 74 sails over you
        }));
        const lowFlyer = obs.some((o) => o.bottom > 40 && o.bottom < 60 && o.x > 10 && o.x < 210);
        if (lowFlyer !== duckHeld) key(lowFlyer ? "keydown" : "keyup", "ArrowDown");
        duckHeld = lowFlyer;
        if (!duckHeld && obs.some((o) => o.bottom < 40 && o.x > 40 && o.x < 175)) key("keydown", "Space");
      }, 40);
    });
    await sleep(9000); // let the score build and flyers join the rotation
    // Photogenic moment: cat airborne with a 2–3-cell stack in frame.
    await page
      .waitForFunction(
        () => {
          const air = document.querySelector(".runner-pose")?.classList.contains("runner-air");
          return (
            air &&
            [...document.querySelectorAll(".runner-obstacle")].some((el) => {
              const x = parseFloat(/translateX\(([-\d.]+)px\)/.exec(el.style.transform)?.[1] ?? "1e9");
              return parseFloat(el.style.bottom) < 40 && el.offsetHeight > 42 && x > 100 && x < 220;
            })
          );
        },
        { polling: 30, timeout: 15000 }
      )
      .catch(() => {}); // no perfect frame? ship whatever the run looks like
    await page.evaluate(() => clearInterval(window.__auto));
  },
});

await browser.close();
server.close();
