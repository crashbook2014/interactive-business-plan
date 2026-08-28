/* Wodouh — build the public answer pages from the legal register.
 *
 * WHY THIS FILE EXISTS
 *
 * Search indexing takes weeks and cannot be hurried. The one thing that can be
 * done today is give search engines something worth indexing, and the best
 * thing this project owns is docs/legal-sources.md: claims about Saudi
 * employment, each re-checked against an official source, each dated. Almost
 * every competing page on this subject is unsourced summary.
 *
 * So the pages are GENERATED FROM THE REGISTER rather than written. A page
 * exists only because a verified row exists, says only what that row says, and
 * shows the row's own sources. There is no editorial layer in between where a
 * claim could soften, drift, or acquire an article number it never had.
 *
 * WHAT THIS SHARES, AND WHY
 *
 * verifiedRows() comes from tools/make-corpus.mjs. Two parsers over one file
 * would be two definitions of "verified", and the whole point of the strict
 * rule is that there is exactly one. What differs is the sources column: the
 * corpus drops it on purpose, these pages keep it on purpose, because the
 * citation is the entire reason the page is worth reading.
 *
 * ONE URL PER LANGUAGE. sitemap.xml explains why the existing pages declare no
 * hreflang — they serve both languages from one URL through a JS toggle, and
 * hreflang requires one URL per language. These pages are built the other way
 * round: /answers/<slug>/ is English, /answers/<slug>/ar/ is Arabic, and each
 * points at the other. That is a claim we can honour, so it is made.
 *
 * REGENERATE AND COMMIT. test/seo.test.js fails if the committed pages and the
 * register disagree, so they cannot drift apart quietly.
 *
 *   node tools/make-seo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { verifiedRows, plain } from "./make-corpus.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = join(root, "docs", "legal-sources.md");
const ORIGIN = "https://" + readFileSync(join(root, "CNAME"), "utf8").trim();

/* ------------------------------------------------------------- helpers */

const esc = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/* The "checked against" cell, as links. Everything that is not a markdown
   link is escaped text, so a stray angle bracket in the register cannot
   become markup on a public page. */
function sourceLinks(cell){
  const out = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(cell))){
    const href = m[2].trim();
    /* Only http(s). A relative or javascript: href in the register would be a
       mistake, and a mistake that reaches a reader as a link is worse. */
    if (!/^https?:\/\//i.test(href)) continue;
    out.push({ label: plain(m[1]), href });
  }
  return out;
}

/* The topic phrase: the claim's own opening, cut where the sentence turns from
   naming its subject to stating it. Derived, never written — a slug and a
   heading are presentation, and presentation that a human retypes is
   presentation that eventually disagrees with the claim underneath it. */
/* The track marker some claims open with. It says WHO the row applies to, not
   what the rule is, so it belongs in the claim (which is printed in full) and
   not in the heading derived from it. */
const TRACK = /^(?:non-saudi only|saudi only|لغير السعوديين وحدهم|للسعوديين وحدهم)[.:،]?\s*/i;
const TRAILING = /\s+(?:of|the|a|an|in|on|at|by|for|and|or|is|are|to|if|as|with|that|when|من|في|على|إلى|أو|و|أن|إذا)$/i;
function topicOf(claim, maxWords, whole){
  const body = claim.replace(TRACK, "");
  /* Normally the phrase stops where the sentence turns from naming its subject
     to stating it. `whole` keeps reading past that point, which is how two rows
     that open identically are told apart — see build(). */
  const cut = whole ? body : body.split(/[:,.—؛،]/)[0];
  let capped = cut.trim().split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ")
    .replace(/[،,:؛.—-]+$/, "");
  /* A phrase that ends on a function word reads as a sentence someone cut off,
     because it is one. Trim until it ends on a word that can end a phrase. */
  let prev;
  do { prev = capped; capped = capped.replace(TRAILING, ""); } while (capped !== prev);
  return capped;
}

/* The register writes its date in English. An Arabic page printing "31 July
   2026" is a page that was translated everywhere except the one line a reader
   checks first. The months are a closed set, so this is a lookup, and an
   unknown month fails the build rather than falling back to English. */
const MONTHS = {
  january: "يناير", february: "فبراير", march: "مارس", april: "أبريل",
  may: "مايو", june: "يونيو", july: "يوليو", august: "أغسطس",
  september: "سبتمبر", october: "أكتوبر", november: "نوفمبر", december: "ديسمبر"
};
function dateAr(date){
  const m = date.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const name = m && MONTHS[m[2].toLowerCase()];
  if (!name) throw new Error(`cannot render "${date}" in Arabic — see MONTHS in tools/make-seo.mjs`);
  return `${m[1]} ${name} ${m[3]}`;
}

function slugOf(claim, cite, seen){
  const kebab = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const base = [kebab(topicOf(claim, 6)) || "saudi-employment", cite && cite.slug]
    .filter(Boolean).join("-");
  const n = (seen[base] = (seen[base] || 0) + 1);
  return n === 1 ? base : `${base}-${n}`;
}

/* THE CITATION, IN BOTH LANGUAGES.
 *
 * Almost every article cell is a bare number, and a number needs no
 * translation: "Article 84" and "المادة 84" are the same citation. One cell is
 * not a number — the Implementing Regulations — and it is not the Labor Law
 * either, so calling it "Saudi Labor Law, Article 6" would cite the wrong
 * statute on a public page.
 *
 * Hence the map, and hence the throw. If the register ever adds another
 * non-numeric citation, this build FAILS rather than printing an English
 * source name inside an Arabic sentence, or guessing which statute it belongs
 * to. A citation nobody chose is exactly what this whole register exists to
 * prevent.
 */
const NON_NUMERIC = {
  "Implementing Regulations, art. 6": {
    slug: "implementing-regulations-art-6",
    shortEn: "art. 6 of the Implementing Regulations",
    shortAr: "المادة 6 من اللائحة التنفيذية",
    fullEn: "Labor Law Implementing Regulations, art. 6",
    fullAr: "اللائحة التنفيذية لنظام العمل، المادة 6"
  }
};

function citation(article){
  if (!article) return null;
  const m = article.match(/^(\d+)/);
  if (m) return {
    slug: `article-${m[1]}`,
    shortEn: `Article ${m[1]}`,             shortAr: `المادة ${m[1]}`,
    fullEn: `Saudi Labor Law, Article ${m[1]}`,
    fullAr: `نظام العمل السعودي، المادة ${m[1]}`
  };
  const hit = NON_NUMERIC[article];
  if (!hit) throw new Error(
    `the register cites "${article}", which is not a bare article number and ` +
    `has no Arabic rendering. Add one to NON_NUMERIC in tools/make-seo.mjs.`);
  return hit;
}

/* --------------------------------------------------------- the strings
 *
 * Every user-visible string that is NOT a claim lives here, in both languages,
 * so that adding a page can never add a sentence nobody reviewed. The
 * templates state no law: they name the article the row already names, or they
 * ask a neutral question. {topic} and {n} are the only substitutions.
 */
const S = {
  en: {
    dir: "ltr", lang: "en", other: "ar", otherLabel: "عربي", selfLabel: "EN",
    site: "Wodouh",
    q: (t, c) => c ? `${t} — what does ${c.shortEn} say?`
                   : `${t} — what are the rules in Saudi Arabia?`,
    title: (t, c) => c ? `${t} — ${c.fullEn} | Wodouh`
                       : `${t} — Saudi employment | Wodouh`,
    articleLabel: c => c.fullEn,
    noArticle: "No article number. The register records this claim without one, and Wodouh never adds a number the source does not carry.",
    checked: d => `Last re-checked ${d}.`,
    sources: "Checked against",
    toolTitle: "Check your own contract",
    toolBody: "Wodouh reads a Saudi employment contract and tells you what it means for you — in your browser, on your device.",
    toolCta: "Open Wodouh",
    disclaimer: "This is general legal information and its source — not legal advice on your situation. Wodouh is not a law firm. For a dispute, see a lawyer.",
    indexTitle: "Saudi employment law, answered and sourced | Wodouh",
    indexH1: "Saudi employment law, answered and sourced",
    indexLead: n => `${n} answers. Every one of them names the article it rests on, or says plainly that it has none, and links the official source it was checked against.`,
    indexDesc: n => `${n} plain answers on Saudi employment law, each checked against an official source and dated.`,
    how: "How we verify",
    home: "Wodouh", allAnswers: "All answers",
    privacy: "Privacy", terms: "Terms",
    metaDesc: t => `${t} — the rule, its source, and the date it was last checked.`
  },
  ar: {
    dir: "rtl", lang: "ar", other: "en", otherLabel: "EN", selfLabel: "عربي",
    site: "وضوح",
    q: (t, c) => c ? `${t} — ماذا تقول ${c.shortAr}؟`
                   : `${t} — ما القواعد في السعودية؟`,
    title: (t, c) => c ? `${t} — ${c.fullAr} | وضوح`
                       : `${t} — العمل في السعودية | وضوح`,
    articleLabel: c => c.fullAr,
    noArticle: "بلا رقم مادة. السجل يوثّق هذا الادعاء دون رقم، ووضوح لا يضيف رقمًا لا يحمله المصدر.",
    checked: d => `آخر إعادة تحقّق: ${d}.`,
    sources: "تم التحقق مقابل",
    toolTitle: "افحص عقدك أنت",
    toolBody: "وضوح يقرأ عقد العمل السعودي ويشرح لك ماذا يعني لك — داخل متصفحك، على جهازك.",
    toolCta: "افتح وضوح",
    disclaimer: "هذه معلومة قانونية عامة مع مصدرها — وليست استشارة قانونية في حالتك. وضوح ليس مكتب محاماة. وفي النزاع، راجع محاميًا.",
    indexTitle: "نظام العمل السعودي: إجابات موثّقة بمصادرها | وضوح",
    indexH1: "نظام العمل السعودي: إجابات موثّقة بمصادرها",
    indexLead: n => `${n} إجابة. كل واحدة تذكر المادة التي تستند إليها، أو تقول صراحةً إنها بلا مادة، وتضع رابط المصدر الرسمي الذي جرى التحقق مقابله.`,
    indexDesc: n => `${n} إجابة واضحة عن العمل في السعودية، كل واحدة محقّقة مقابل مصدر رسمي ومؤرّخة.`,
    how: "كيف نتحقّق",
    home: "وضوح", allAnswers: "كل الإجابات",
    privacy: "الخصوصية", terms: "الشروط",
    metaDesc: t => `${t} — الحكم، ومصدره، وتاريخ آخر تحقّق منه.`
  }
};

/* -------------------------------------------------------------- layout */

const BRAND = '<svg viewBox="0 0 64 64" stroke-width="5.5" stroke-linecap="round" aria-hidden="true"><circle cx="27.5" cy="27.5" r="17.5"/><path d="M19.5 28.5l6 6 11-12.5"/><path d="M41 41l11.5 11.5" stroke-width="6.5"/></svg>';

function page({ lang, path, altPath, title, desc, body, jsonld }){
  const t = S[lang];
  const alt = S[t.other];
  const canonical = ORIGIN + path;
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<!-- No third-party anything, and no script at all on these pages. -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none'; style-src 'self'; img-src 'self' data:;
  base-uri 'none'; form-action 'none'; frame-ancestors 'none'"/>
<link rel="stylesheet" href="/legal/legal.css"/>
<link rel="stylesheet" href="/answers/answers.css"/>
<link rel="canonical" href="${canonical}"/>
<link rel="alternate" hreflang="${t.lang}" href="${ORIGIN + path}"/>
<link rel="alternate" hreflang="${alt.lang}" href="${ORIGIN + altPath}"/>
<link rel="alternate" hreflang="x-default" href="${ORIGIN + (lang === "en" ? path : altPath)}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${ORIGIN}/assets/og-cover.png"/>
<meta property="og:locale" content="${t.lang === "ar" ? "ar_SA" : "en_US"}"/>
<meta name="twitter:card" content="summary_large_image"/>
${jsonld ? `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>` : ""}
</head>
<body>
<div class="wrap">

  <div class="top">
    <a class="brand" href="/">${BRAND}<b>${t.home}</b></a>
    <div class="langs">
      <span aria-current="true">${t.selfLabel}</span>
      <a href="${altPath}" hreflang="${alt.lang}" lang="${alt.lang}">${alt.selfLabel}</a>
    </div>
  </div>

${body}

  <footer>
    <a href="/answers/${lang === "ar" ? "ar/" : ""}">${t.allAnswers}</a>
    <a href="/how-we-verify/${lang === "ar" ? "ar/" : ""}">${t.how}</a>
    <a href="/privacy/">${t.privacy}</a>
    <a href="/terms/">${t.terms}</a>
  </footer>

</div>
</body>
</html>
`;
}

/* ------------------------------------------------------- an answer page */

function answerPage(row, lang, date){
  const t = S[lang];
  date = lang === "ar" ? dateAr(date) : date;
  const claim = lang === "ar" ? row.claim_ar : row.claim;
  const topic = row.topic[lang];
  const q = t.q(topic, row.cite);
  const path = `/answers/${row.slug}/${lang === "ar" ? "ar/" : ""}`;
  const altPath = `/answers/${row.slug}/${lang === "ar" ? "" : "ar/"}`;
  const links = sourceLinks(row.sourcesCell);

  const body = `  <h1>${esc(q)}</h1>
  <p class="updated">${esc(t.checked(date))}</p>

  <div class="key">
    <p>${esc(claim)}</p>
  </div>

  <p class="cite">${row.cite
    ? `<strong>${esc(t.articleLabel(row.cite))}</strong>`
    : esc(t.noArticle)}</p>

  <h2>${esc(t.sources)}</h2>
  <ul class="sources">
${links.map(l => `    <li><a href="${esc(l.href)}" rel="nofollow noopener">${esc(l.label)}</a></li>`).join("\n")}
  </ul>

  <div class="box tool">
    <h2>${esc(t.toolTitle)}</h2>
    <p>${esc(t.toolBody)}</p>
    <p><a class="cta" href="/app/">${esc(t.toolCta)}</a></p>
  </div>

  <p class="disclaimer">${esc(t.disclaimer)}</p>`;

  /* The structured answer is the SAME STRING the page renders. If the two ever
     diverge, the machine-readable copy is the one nobody proofreads. */
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: t.lang,
    mainEntity: [{
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: claim }
    }]
  };

  return { path, html: page({
    lang, path, altPath,
    title: t.title(topic, row.cite),
    desc: t.metaDesc(topic),
    body, jsonld
  }) };
}

/* --------------------------------------------------------- index pages */

function indexPage(rows, lang, date){
  const t = S[lang];
  date = lang === "ar" ? dateAr(date) : date;
  const path = `/answers/${lang === "ar" ? "ar/" : ""}`;
  const altPath = `/answers/${lang === "ar" ? "" : "ar/"}`;
  const items = rows.map(r => {
    const claim = lang === "ar" ? r.claim_ar : r.claim;
    return `    <li><a href="/answers/${r.slug}/${lang === "ar" ? "ar/" : ""}">${esc(t.q(r.topic[lang], r.cite))}</a></li>`;
  }).join("\n");

  const body = `  <h1>${esc(t.indexH1)}</h1>
  <p class="updated">${esc(t.checked(date))}</p>
  <div class="key"><p>${esc(t.indexLead(rows.length))}</p></div>
  <ul class="answer-list">
${items}
  </ul>
  <p class="disclaimer">${esc(t.disclaimer)}</p>`;

  return { path, html: page({
    lang, path, altPath,
    title: t.indexTitle, desc: t.indexDesc(rows.length), body,
    jsonld: null
  }) };
}

/* ------------------------------------------------------ how we verify */

const HOW = {
  en: (v, x, date) => `  <h1>How we verify</h1>
  <p class="updated">Register last reviewed ${date}.</p>
  <div class="key"><p>Wodouh states an article number only when that article
  appears as verified in our register. Everywhere else it names the law without
  a number. Invented precision manufactures exactly the authority a register is
  meant to earn honestly.</p></div>

  <h2>The rule</h2>
  <p>Every claim the product makes lives as a row in one file, with the article
  it rests on, its status, and the official sources it was checked against. The
  answer pages on this site are <strong>generated from that file</strong>. They
  are not written, and there is no editorial step in between where a claim could
  soften or gain a number it never had.</p>

  <h2>What is excluded, and why that matters more</h2>
  <p>Right now ${v} rows are verified and <strong>${x} are not</strong> — one is
  disputed between two readings of the 2025 amendment, one is verified as to its
  grounds but not its consequence. Neither has a page here, because the test is
  a clean tick and nothing else. A register that never excludes anything is a
  register nobody is actually applying.</p>

  <h2>Two kinds of statement, never blurred</h2>
  <p>Inside the app, a result that cites an article is marked as law. A result
  that comes from our own reading or weighting is marked as Wodouh methodology
  and says so in those words. The score is always methodology: no statute
  produces a number out of 100. The end-of-service figure is always law.</p>

  <h2>Corrections</h2>
  <p>If a row here is wrong, it is wrong in the register too, and fixing it
  there fixes it everywhere at once. Write to us and say which article.</p>

  <p class="disclaimer">${S.en.disclaimer}</p>`,
  ar: (v, x, date) => `  <h1>كيف نتحقّق</h1>
  <p class="updated">آخر مراجعة للسجل: ${date}.</p>
  <div class="key"><p>وضوح لا يذكر رقم مادة إلا إذا كانت هذه المادة موثّقة في
  سجلّنا. وفي غير ذلك يسمّي النظام دون رقم. فالدقّة المُختلَقة تصنع بالضبط تلك
  السلطة التي يُفترض بالسجل أن يكسبها بأمانة.</p></div>

  <h2>القاعدة</h2>
  <p>كل ادعاء يقوله المنتج موجود كصفٍّ في ملف واحد، ومعه المادة التي يستند
  إليها، وحالته، والمصادر الرسمية التي جرى التحقق مقابلها. وصفحات الإجابات في
  هذا الموقع <strong>مولّدة من ذلك الملف</strong>؛ لا تُكتب يدويًا، ولا توجد
  خطوة تحرير بينهما يمكن للادعاء أن يلين فيها أو يكتسب رقمًا لم يكن له.</p>

  <h2>ما المستبعَد، ولماذا هو الأهم</h2>
  <p>حاليًا ${v} صفًّا موثّقًا و<strong>${x} غير موثّقين</strong> — أحدهما محلّ
  خلاف بين قراءتين لتعديل 2025، والآخر موثّق من حيث الأسباب لا من حيث الأثر.
  ولا صفحة لأيٍّ منهما هنا، لأن المعيار علامة صحيحة نظيفة ولا شيء غيرها. والسجل
  الذي لا يستبعد شيئًا أبدًا هو سجل لا يطبّقه أحد فعلًا.</p>

  <h2>نوعان من العبارات، لا يختلطان</h2>
  <p>داخل التطبيق، النتيجة التي تستشهد بمادة تُعلَّم كنصٍّ نظامي. والنتيجة التي
  تأتي من قراءتنا أو ترجيحنا تُعلَّم كمنهجية وضوح وتقول ذلك بهذه الكلمات.
  الدرجة منهجية دائمًا: لا نصّ يُنتج رقمًا من 100. ومكافأة نهاية الخدمة نظامية
  دائمًا.</p>

  <h2>التصحيحات</h2>
  <p>إذا كان صفٌّ هنا خاطئًا فهو خاطئ في السجل أيضًا، وتصحيحه هناك يصححه في كل
  مكان دفعة واحدة. راسلنا وحدّد المادة.</p>

  <p class="disclaimer">${S.ar.disclaimer}</p>`
};

function howPage(lang, verified, excluded, date){
  const t = S[lang];
  date = lang === "ar" ? dateAr(date) : date;
  const path = `/how-we-verify/${lang === "ar" ? "ar/" : ""}`;
  const altPath = `/how-we-verify/${lang === "ar" ? "" : "ar/"}`;
  return { path, html: page({
    lang, path, altPath,
    title: lang === "ar" ? "كيف نتحقّق — وضوح" : "How we verify — Wodouh",
    desc: lang === "ar"
      ? `كيف يتحقق وضوح من كل ادعاء قانوني: سجل واحد، ${verified} صفًّا موثّقًا، و${excluded} مستبعدين.`
      : `How Wodouh verifies every legal claim: one register, ${verified} verified rows, ${excluded} excluded.`,
    body: HOW[lang](verified, excluded, date),
    jsonld: null
  }) };
}

/* ------------------------------------------------------------ sitemap */

const STATIC = [
  { loc: "/",         freq: "weekly",  pri: "1.0" },
  { loc: "/app/",     freq: "weekly",  pri: "0.9" },
  { loc: "/privacy/", freq: "monthly", pri: "0.4" },
  { loc: "/terms/",   freq: "monthly", pri: "0.3" },
  { loc: "/refund/",  freq: "monthly", pri: "0.3" }
];

function sitemap(pairs){
  /* pairs: [{ en, ar, pri }] — one entry per language, each declaring the
     other. Reciprocal or not at all: a one-way alternate is a claim search
     engines act on and we would not be honouring. */
  const url = (loc, freq, pri, alts) =>
`  <url>
    <loc>${ORIGIN + loc}</loc>${alts ? "\n" + alts : ""}
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>`;

  const alts = (en, ar) =>
`    <xhtml:link rel="alternate" hreflang="en" href="${ORIGIN + en}"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${ORIGIN + ar}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN + en}"/>`;

  const body = [
    ...STATIC.map(s => url(s.loc, s.freq, s.pri, null)),
    ...pairs.flatMap(p => [
      url(p.en, "monthly", p.pri, alts(p.en, p.ar)),
      url(p.ar, "monthly", p.pri, alts(p.en, p.ar))
    ])
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  GENERATED BY tools/make-seo.mjs. Edit the register, not this file.

  The first five URLs are the landing page, the app, and the three policies.
  The brand page and the founder console are deliberately absent, matching
  robots.txt. The policies are listed because a payment gateway's onboarding
  reviewer and a reader both need to find them, and because a policy nobody can
  reach is a policy nobody was given.

  hreflang, and where it is honest. Those five pages serve Arabic and English
  from a single URL with a JavaScript toggle, and hreflang requires one URL per
  language — so they declare none. The /answers/ and /how-we-verify/ pages are
  built the other way round, one URL per language, each pointing at the other.
  Those, and only those, carry alternates.

  These absolute URLs change with the domain; the domain is read from CNAME.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
}

/* --------------------------------------------------------------- build */

export function build(md){
  const { rows, excluded } = verifiedRows(md);
  const m = md.match(/Last reviewed:\s*\*\*([^*]+)\*\*/);
  if (!m) throw new Error("the register has no 'Last reviewed:' date");
  const date = m[1].trim();

  const seen = {};
  rows.forEach(r => {
    r.cite = citation(r.article);
    r.slug = slugOf(r.claim, r.cite, seen);
    r.topic = {};
  });

  /* TWO PAGES MUST NOT ASK THE SAME QUESTION. Articles 77 and 77(2) open with
     the same words — one is the indefinite contract, the other the fixed-term
     one — and truncating both at seven words produced two identical headings
     and two identical <title>s. So the heading grows, one word at a time, until
     it says something the other pages do not. Per language, because the two
     claims diverge at different points in Arabic than in English. */
  for (const lang of ["en", "ar"]){
    const used = new Set();
    for (const r of rows){
      const claim = lang === "ar" ? r.claim_ar : r.claim;
      let topic = topicOf(claim, 14);
      /* Articles 77 and 77(2) open with the same seven words and diverge only
         after the comma — one is the indefinite contract, the other the
         fixed-term one. So the phrase reads on, one word at a time, until it
         says something no other page says. */
      for (let w = 15; w <= 32 && used.has(S[lang].q(topic, r.cite)); w++){
        topic = topicOf(claim, w, true);
      }
      const q = S[lang].q(topic, r.cite);
      if (used.has(q)) throw new Error(`two rows ask the same question in ${lang}: "${q}"`);
      used.add(q);
      r.topic[lang] = topic;
    }
  }

  const files = [];
  for (const r of rows){
    files.push(answerPage(r, "en", date));
    files.push(answerPage(r, "ar", date));
  }
  files.push(indexPage(rows, "en", date), indexPage(rows, "ar", date));
  files.push(howPage("en", rows.length, excluded, date),
             howPage("ar", rows.length, excluded, date));

  const pairs = [
    ...rows.map(r => ({ en: `/answers/${r.slug}/`, ar: `/answers/${r.slug}/ar/`, pri: "0.7" })),
    { en: "/answers/", ar: "/answers/ar/", pri: "0.8" },
    { en: "/how-we-verify/", ar: "/how-we-verify/ar/", pri: "0.5" }
  ];

  return { rows, excluded, date, files, sitemap: sitemap(pairs) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)){
  const out = build(readFileSync(REGISTER, "utf8"));

  /* Removed first. A row renamed in the register must not leave its old page
     behind, answering a URL the register no longer stands behind. */
  for (const dir of ["answers", "how-we-verify"]){
    const p = join(root, dir);
    if (existsSync(p)) rmSync(p, { recursive: true });
  }

  for (const f of out.files){
    const dir = join(root, f.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), f.html);
  }
  writeFileSync(join(root, "answers", "answers.css"),
                readFileSync(join(root, "tools", "answers.css"), "utf8"));
  writeFileSync(join(root, "sitemap.xml"), out.sitemap);

  console.log(`seo: ${out.files.length} pages from ${out.rows.length} verified rows (${out.excluded} excluded), checked ${out.date}`);
  out.rows.forEach(r => console.log(`  /answers/${r.slug}/`));
}
