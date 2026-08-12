/* The link-preview card.
 *
 * Run once, commit the output:  node tools/make-og.mjs
 *
 * WHY IT MATTERS MORE HERE THAN USUAL
 *
 * Wodouh's realistic distribution is one person sending it to a colleague in
 * the same company — a WhatsApp forward, not a search result. Without an
 * og:image that forward renders as a bare grey URL, which is the difference
 * between "look at this" and a link nobody taps.
 *
 * Same approach as tools/make-icons.mjs: one source of truth, rendered by the
 * browser the previews are for, output committed so nothing needs this script
 * to build or deploy.
 *
 * 1200×630 is the size every platform crops from.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets");

const SAND = "#F7F1E6";
const TEAL = "#1E6E64";
const INK  = "#12332F";
const INK2 = "#5B6B67";

/* The fonts are in the repo, so the card uses the real brand faces rather than
   whatever the rendering machine happens to have. */
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<style>
  @font-face{font-family:'Noto Naskh Arabic';src:url('file://${ROOT}/assets/fonts/noto-naskh-arabic-var.woff2') format('woff2');font-weight:400 700}
  @font-face{font-family:'Nunito';src:url('file://${ROOT}/assets/fonts/nunito-var.woff2') format('woff2');font-weight:200 1000}
  *{margin:0;padding:0;box-sizing:border-box}
  /* space-between rather than centred: the mark, the message and the wordmark
     each own a band. Centred everything let the wordmark drift into the
     subtitle, which is the kind of thing you only see by looking at the PNG. */
  body{width:1200px;height:630px;background:${SAND};font-family:'Noto Naskh Arabic',serif;
       display:flex;flex-direction:column;justify-content:space-between;
       padding:66px 96px 60px;position:relative;overflow:hidden}
  .mark{width:84px;height:84px}
  h1{font-size:62px;line-height:1.4;color:${TEAL};font-weight:700;max-width:940px}
  p{font-size:29px;line-height:1.65;color:${INK2};margin-top:22px;max-width:860px}
  .foot{display:flex;align-items:baseline;gap:13px}
  .foot .ar{font-size:32px;color:${INK};font-weight:700}
  .foot .en{font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;letter-spacing:.14em;
            color:${TEAL};text-transform:uppercase}
  .rule{position:absolute;inset-inline-end:0;top:0;width:14px;height:100%;background:${TEAL}}
</style></head><body>
  <div class="rule"></div>
  <svg class="mark" viewBox="0 0 64 64" fill="none">
    <circle cx="27.5" cy="27.5" r="17.5" stroke="${TEAL}" stroke-width="6"/>
    <path d="M19.5 28.5l6 6 11-12.5" stroke="${TEAL}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M41 41l11.5 11.5" stroke="${TEAL}" stroke-width="7" stroke-linecap="round"/>
  </svg>
  <div>
    <h1>اقرأ عقدك بوضوح<br>قبل ما توقّع.</h1>
    <p>تقييم فوري لعقد العمل، وتقدير مستحقاتك إذا انتهى — مع مصدر كل رقم.</p>
  </div>
  <div class="foot"><span class="ar">وضوح</span><span class="en">Wodouh</span></div>
</body></html>`;

const b = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
);
const page = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
mkdirSync(OUT, { recursive: true });
const png = await page.screenshot();
writeFileSync(join(OUT, "og-cover.png"), png);
console.log(`  assets/og-cover.png  1200×630  ${png.length} bytes`);
await b.close();
