/* Generate the home-screen icons from the brand mark.
 *
 * Run once, commit the output:  node tools/make-icons.mjs
 *
 * WHY A SCRIPT RATHER THAN CHECKED-IN ART
 *
 * There is exactly one source of truth for the mark — brand/assets/app-icon.svg
 * — and five raster sizes derived from it. Drawing those by hand means five
 * files that drift from the brand the first time the mark changes. This
 * regenerates all of them from that one file.
 *
 * WHY PLAYWRIGHT
 *
 * There is no rasteriser on this machine, and adding one as a dependency to an
 * app whose entire point is having no dependencies would be absurd. Playwright
 * is already here for the test suites, and headless Chromium renders SVG
 * exactly as the browsers the icons are for will. The PNGs are committed, so
 * nobody needs this script to build or deploy — only to change the mark.
 *
 * THE MASKABLE ONE IS NOT THE SAME PICTURE
 *
 * Android and Chrome crop a maskable icon to whatever shape the launcher
 * prefers, guaranteeing only the inner 80% circle. So the maskable variant
 * bleeds the teal to every edge and shrinks the mark into that safe zone. Using
 * the standard icon as maskable is how apps end up with their logo clipped.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "app", "icons");

const TEAL = "#1E6E64";
const SAND = "#F7F1E6";

/* The mark itself, without the rounded plate — the plate differs between the
   standard and maskable variants, so it is drawn per variant below. */
const MARK = `
  <g transform="translate(6.5 6.5) scale(0.797)">
    <circle cx="27.5" cy="27.5" r="17.5" stroke="${SAND}" stroke-width="6"/>
    <path d="M19.5 28.5l6 6 11-12.5" stroke="${SAND}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M41 41l11.5 11.5" stroke="${SAND}" stroke-width="7" stroke-linecap="round"/>
  </g>`;

/* Standard: the mark on its rounded plate, edge to edge, as the brand file
   draws it. Used where the platform does not crop. */
const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="14.5" fill="${TEAL}"/>${MARK}</svg>`;

/* Apple: iOS applies its own corner radius and does not honour transparency,
   so the plate is a plain square. Rounding it here would show a dark ring
   inside Apple's mask. */
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" fill="${TEAL}"/>${MARK}</svg>`;

/* Maskable: teal to every edge, mark scaled to 60% and centred, so any crop
   from a circle to a squircle still contains the whole lens. */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" fill="${TEAL}"/>
  <g transform="translate(12.8 12.8) scale(0.6)">
    <rect width="64" height="64" fill="none"/>${MARK}
  </g></svg>`;

/* `bleed` is what the page behind the SVG is painted with. The standard icon
   carries its own rounded plate, so the corners outside it must come out
   transparent — painting the page teal was the first attempt and it silently
   filled the corners back in, producing a plain square that looked right in
   isolation and wrong on a launcher. */
const JOBS = [
  { file: "icon-192.png",          size: 192, svg: standard, bleed: false },
  { file: "icon-512.png",          size: 512, svg: standard, bleed: false },
  { file: "icon-maskable-512.png", size: 512, svg: maskable, bleed: true },
  { file: "apple-touch-icon.png",  size: 180, svg: apple,    bleed: true },
  /* iOS shows this one in the app switcher and some share sheets. */
  { file: "apple-touch-icon-152.png", size: 152, svg: apple, bleed: true },
];

const b = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
);
mkdirSync(OUT, { recursive: true });

for (const job of JOBS) {
  const page = await b.newPage({
    viewport: { width: job.size, height: job.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:${job.bleed ? TEAL : "transparent"}}
      svg{display:block;width:${job.size}px;height:${job.size}px}</style>${job.svg}`
  );
  const png = await page.screenshot({ omitBackground: !job.bleed });
  writeFileSync(join(OUT, job.file), png);
  await page.close();
  console.log(`  ${job.file}  ${job.size}×${job.size}  ${png.length} bytes`);
}

await b.close();

/* The SVG goes out too: Chrome prefers it at any size, and it is a fraction of
   the bytes. The PNGs exist for Safari, which does not accept it. */
writeFileSync(join(OUT, "icon.svg"), readFileSync(join(ROOT, "brand/assets/app-icon.svg")));
console.log("  icon.svg   copied from the brand file");
