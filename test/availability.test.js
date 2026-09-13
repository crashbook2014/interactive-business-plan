/* What the product says it does, against what it can actually do.
 *
 * THE RULE, and it is derived rather than listed: a capability the codebase
 * does not have may not be claimed in the present tense, and a capability the
 * roadmap calls planned may not be claimed anywhere else as shipped.
 *
 * WHAT WENT WRONG. Four strings promised that Wodouh notifies people —
 * `tr_sub`, the tease that invites a reader to track a contract in the first
 * place, plus `tl_note`, `tl_empty`, and the landing page's `f3p`. All four
 * said «ننبّهك قبلها بوقت كافٍ» / "we nudge you well before each one", in the
 * present tense.
 *
 * There is no notification capability in this repository at all: no
 * Notification, no PushManager, nothing in app/sw.js. What exists is an .ics
 * file carrying two VALARMs, at fourteen days and one day, which the READER'S
 * OWN calendar fires — and only after they have exported it. Meanwhile
 * «تنبيهات ذكية» / "Smart contract alerts" sits on the roadmap as planned, and
 * test/future.test.js requires every roadmap card to be badged as coming. One
 * screen called the feature unbuilt while another promised it was running.
 *
 * A fake switch made the same claim without words. `.tl-note .dot-on` was a
 * 30x18 pill with an inset knob — a toggle drawn in the ON position, not
 * interactive, at the top of the timeline screen beside that sentence.
 *
 * No test referenced any of those four strings or that class, which is exactly
 * why it survived.
 */
const fs = require("node:fs");
const path = require("node:path");

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const R = (...p) => path.join(__dirname, "..", ...p);
const app = fs.readFileSync(R("app", "index.html"), "utf8");
const sw = fs.existsSync(R("app", "sw.js")) ? fs.readFileSync(R("app", "sw.js"), "utf8") : "";
const landingSrc = fs.readFileSync(R("assets", "landing.js"), "utf8");

/* Same slice trick test/copy-keys.test.js and test/landing-claims.test.js use:
   evaluate the dictionary so the assertions read real strings rather than
   whatever a regex made of them. */
function copyOf(src, label){
  const start = src.indexOf("const T = {");
  const end = src.indexOf("\n};", start);
  ok(start >= 0 && end > start, `${label}: the copy dictionary is where this suite expects it`);
  if (start < 0 || end <= start) return {};
  // eslint-disable-next-line no-new-func
  return new Function("return " + src.slice(start + "const T = ".length, end + 2))();
}
const A = copyOf(app, "app");
const L = copyOf(landingSrc, "landing");
const LANGS = ["ar", "en"];

/* --------------------------------------------------- 1. what can it do */
console.log("— the capability, before any claim about it");

/* ASKED, NOT ASSUMED. The day someone actually builds notifications this count
   rises and section 2 relaxes on its own, rather than freezing today's answer
   into a rule nobody remembers to revisit. */
const NOTIFY_API = /\bNotification\b|\bPushManager\b|showNotification|Notification\.requestPermission/g;
/* COMMENTS STRIPPED FIRST, and this is not fussiness. The first run of this
   file reported two notification APIs and cheerfully announced that the rule
   below "has retired itself" — the two hits were the comment in app/index.html
   that says "there is no Notification call, no PushManager". The sentence
   documenting the absence of the capability was read as the capability, and
   switched off the assertion it exists to justify. A guard that a comment can
   disable is not a guard.

   Block and HTML comments only: a naive // sweep eats the double slash in
   every https:// URL in the file. */
const code = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");
const notifyHits = [...(code(app) + "\n" + code(sw)).matchAll(NOTIFY_API)].length;
console.log(`  note   notification APIs found in app/index.html + app/sw.js: ${notifyHits}`);

/* The mechanism that DOES do the alerting, so the copy below has something
   true to point at. Counted, because everything after this is conditional on
   it and a condition that stops matching prints ok forever. */
const alarms = [...app.matchAll(/TRIGGER:-P(\d+)D/g)].map((m) => Number(m[1])).sort((a, b) => b - a);
ok(alarms.length >= 2,
   `the .ics carries its own alarms (${alarms.map((d) => d + "d").join(", ") || "none"})`);

/* --------------------------------- 2. no promise the product cannot keep */
console.log("\n— nothing promises an alert Wodouh has no way to send");

/* Both languages. The first shape this check could have taken — English verbs
   only — would have passed an Arabic-only regression on an Arabic-first app,
   which is the single most likely way this comes back. */
const PROMISE = /ننبهك|ننبّهك|نذكّرك|نذكرك|سننبهك|we'?ll nudge|we nudge|we'?ll remind|we remind|we'?ll warn|we warn/i;
/* The calendar is the escape hatch, because it is the truth: a sentence may
   say an alert is coming as long as it says what sends it. */
const MECHANISM = /تقويم|calendar/i;

const strings = (v, at) =>
  typeof v === "string" ? [[at, v]]
  : Array.isArray(v) ? v.flatMap((x, i) => strings(x, `${at}[${i}]`))
  : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => strings(x, `${at}.${k}`))
  : [];
const everything = [
  ...Object.entries(A).flatMap(([k, v]) => strings(v, `app:${k}`)),
  ...Object.entries(L).flatMap(([k, v]) => strings(v, `landing:${k}`)),
];
ok(everything.length > 1000,
   `every string in both dictionaries was collected (${everything.length})`);

if (notifyHits === 0) {
  const bare = everything.filter(([at, s]) => {
    /* The roadmap screen's whole job is describing what is not built yet, and
       test/future.test.js already forces every one of those cards to carry a
       "coming" badge. Exempt by key prefix, not by wording. */
    if (/^app:fu_/.test(at)) return false;
    return PROMISE.test(s) && !MECHANISM.test(s);
  });
  ok(bare.length === 0,
     `no string promises Wodouh alerts you without naming the calendar${
       bare.length ? " — " + bare.map(([at, s]) => `${at}: "${s.trim().slice(0, 70)}"`).join(" | ") : ""}`);
} else {
  ok(true, `notifications exist now (${notifyHits} references) — this rule has retired itself`);
}

/* ------------------------------- 3. the two pages describe one feature */
console.log("\n— the app and the landing page describe the same reminder");

/* Two separate copy dictionaries describing one feature is exactly the drift
   test/landing-claims.test.js exists for. Asserted on the CLAIMS — mechanism
   and intervals — so either can be rewritten and neither can quietly become
   the broader one. */
const pair = [["the app's tr_sub", A.tr_sub], ["the landing page's f3p", L.f3p]];
for (const [name, v] of pair) {
  ok(!!v && !!v.ar && !!v.en, `${name} is present in both languages`);
  for (const l of LANGS) {
    const s = (v || {})[l] || "";
    ok(MECHANISM.test(s), `${name} (${l}) names the calendar, not a service we run`);
  }
}
/* THE INTERVALS COME FROM THE .ICS, not from a number typed in this file. If
   someone retunes the alarms to 7 and 1, this fails until the copy agrees —
   which is the only version of this check that stays true. */
const AR_DIGIT = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
const WORDS = { 14: /أسبوعين|two weeks|fourteen/i, 1: /بيوم|a day|one day/i };
for (const [name, v] of pair) {
  for (const l of LANGS) {
    const s = AR_DIGIT((v || {})[l] || "");
    for (const d of alarms) {
      const re = WORDS[d];
      if (!re) continue;
      ok(re.test(s) || new RegExp(`\\b${d}\\b`).test(s),
         `${name} (${l}) names the ${d}-day alarm the .ics actually sets`);
    }
  }
}

/* --------------------------------------- 4. no control that is not a control */
console.log("\n— nothing on the timeline is drawn as a switch that is switched on");

/* MEASURED AS A SHAPE, not matched as a class name. The offender was
   `.tl-note .dot-on`; renaming it would sail past a name check while drawing
   exactly the same lie. A toggle is a wide pill carrying an inset disc, so
   that is what this looks for: any adornment in the note that is markedly
   wider than it is tall and has a ::after with its own background. */
const css = fs.readFileSync(R("app", "app.css"), "utf8");
const noteRules = [...css.matchAll(/\.tl-note[^{}]*\{([^{}]*)\}/g)];
ok(noteRules.length > 0, `the timeline note has styling to inspect (${noteRules.length} rules)`);
const switchy = noteRules.filter(([whole, body]) => {
  const w = /width:\s*([\d.]+)px/.exec(body), h = /height:\s*([\d.]+)px/.exec(body);
  if (!w || !h) return false;
  const wide = Number(w[1]) > Number(h[1]) * 1.4;
  const pill = /border-radius:\s*9+px|border-radius:\s*999px/.test(body);
  /* The knob: a ::after rule on the same selector carrying a background. */
  const sel = whole.slice(0, whole.indexOf("{")).trim();
  const knob = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "::after\\s*\\{[^{}]*background")
    .test(css);
  return wide && pill && knob;
});
ok(switchy.length === 0,
   `no adornment is shaped like a toggle${switchy.length ? " — " + switchy.map(([w]) => w.slice(0, 40)).join(", ") : ""}`);

console.log("\n" + (FAIL.length
  ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
  : "the product promises no alert it cannot send, and draws no switch it cannot flip"));
process.exit(FAIL.length ? 1 : 0);
