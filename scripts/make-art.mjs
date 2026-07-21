/**
 * Marketing/packaging art via headless system Chrome:
 *   extension/icons/icon{16,48,128}.png  — toolbar + store icons
 *   store-assets/small-promo-tile.jpg    — 440×280 Web Store promo tile
 *
 * Quality pipeline: rasterize the SVG at 4–8× on a canvas, then downscale by
 * progressive halving with imageSmoothingQuality "high" — far cleaner edges
 * than a one-shot resize. Tiny sizes also get a bolder stroke so the outline
 * reads instead of dissolving.
 */
import { writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { cat } from "./cat-art.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Light-theme score ramp from src/index.css, for the promo tile's legend row.
const RAMP = ["#dce9f7", "#c9ddf1", "#b4d0ea", "#9cc1e2", "#82b0d9", "#679dce", "#4c88c0", "#356fae", "#235898", "#16406f"];

const iconSvg = (sw) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#eef0f5"/>
  <g transform="translate(14 14) scale(0.5)">${cat(sw)}</g>
</svg>`;

const promoSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280">
  <rect width="440" height="280" fill="#f6f7f9"/>
  <g transform="translate(30 52) scale(0.88)">${cat()}</g>
  <text x="210" y="128" font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    font-size="42" font-weight="700" letter-spacing="-1" fill="#1c2430">DayScore</text>
  ${RAMP.map((c, i) => `<rect x="${212 + i * 18.5}" y="146" width="15" height="15" rx="4.5" fill="${c}"/>`).join("")}
  <text x="212" y="196" font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    font-size="16" font-weight="500" fill="#55606e">Rate your day. Watch the year.</text>
</svg>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();

/** Rasterize `svg` at w×h after supersampling `scale`× (a power of two). */
async function render(svg, w, h, scale, mime, quality) {
  const dataUrl = await page.evaluate(
    async ({ svg, w, h, scale, mime, quality }) => {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await new Promise((res, rej) => ((img.onload = res), (img.onerror = rej)));
      let canvas = document.createElement("canvas");
      let cw = w * scale;
      let ch = h * scale;
      canvas.width = cw;
      canvas.height = ch;
      let ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, cw, ch);
      while (cw > w) {
        cw /= 2;
        ch /= 2;
        const next = document.createElement("canvas");
        next.width = cw;
        next.height = ch;
        const nctx = next.getContext("2d");
        nctx.imageSmoothingEnabled = true;
        nctx.imageSmoothingQuality = "high";
        nctx.drawImage(canvas, 0, 0, cw, ch);
        canvas = next;
      }
      return canvas.toDataURL(mime, quality);
    },
    { svg, w, h, scale, mime, quality }
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

await page.goto("about:blank");

// Icons: bolder outline as the canvas shrinks.
for (const [s, sw, scale] of [
  [128, 7, 8],
  [48, 8.5, 8],
  [16, 11, 8],
]) {
  writeFileSync(`extension/icons/icon${s}.png`, await render(iconSvg(sw), s, s, scale, "image/png"));
  console.log(`✓ extension/icons/icon${s}.png (${s}×${s}, stroke ${sw}, ${scale}× supersampled)`);
}

writeFileSync("store-assets/small-promo-tile.jpg", await render(promoSvg(), 440, 280, 4, "image/jpeg", 0.95));
console.log("✓ store-assets/small-promo-tile.jpg (440×280, 4× supersampled)");

const marqueeSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 560">
  <rect width="1400" height="560" fill="#f6f7f9"/>
  <g transform="translate(115 85) scale(1.95)">${cat()}</g>
  <text x="565" y="268" font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    font-size="98" font-weight="700" letter-spacing="-3" fill="#1c2430">DayScore</text>
  ${RAMP.map((c, i) => `<rect x="${572 + i * 45}" y="306" width="35" height="35" rx="10" fill="${c}"/>`).join("")}
  <text x="572" y="424" font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    font-size="31" font-weight="500" fill="#55606e">Rate your day in five seconds. Watch the year take shape.</text>
</svg>`;

writeFileSync("store-assets/marquee-promo-tile.png", await render(marqueeSvg(), 1400, 560, 2, "image/png"));
writeFileSync("store-assets/marquee-promo-tile.jpg", await render(marqueeSvg(), 1400, 560, 2, "image/jpeg", 0.95));
console.log("✓ store-assets/marquee-promo-tile.png/.jpg (1400×560, 2× supersampled)");

await browser.close();
