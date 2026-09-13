/* The business workspace, checked as the reader's own data.
 *
 * WHAT IT WAS. `renderBiz()` painted `#screen-biz` from a hardcoded `BIZ`
 * literal: an invented company («شركة أفق للتقنية»), four invented contracts,
 * two invented outgoing templates, four invented team seats, and a "Trial —
 * 14 days left" chip for a trial that does not exist. It read no storage and
 * no backend, and carried `pw_demo` as its disclaimer — the honest label for a
 * mockup, and no substitute for the thing.
 *
 * Two of its sections could not be made real and were not faked harder. Team
 * seats need a multi-tenant backend that does not exist — every RLS policy in
 * all ten migrations is `auth.uid() = user_id`, single-subject — and could not
 * be enforced regardless while entitlement lives in localStorage. Reading an
 * outgoing template from the counterparty's side needs the rule set inverted:
 * every rule in `RULES` is written for the person signing. Both are on the
 * roadmap now, which `test/future.test.js` forces to badge as coming.
 *
 * WHAT THE OLD TESTS COULD SEE. `test/surfaces.test.js` asserted the three
 * sections had children and the screen had no `undefined` or `NaN` — true of a
 * fixture by construction. Nothing checked that a single number on the screen
 * corresponded to anything. That is what this file does.
 */
const fs = require("node:fs");
const path = require("node:path");
const { playwright, launchOpts, APP, signInStub } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const R = (...p) => path.join(__dirname, "..", ...p);
const LANGS = ["ar", "en"];

/* ---------------------------- the sync cannot drift from the schema again */
console.log("— what the sync sends fits the table it sends to");
/* THE BUG THIS REPLACES. pushLocal wrote to `contracts` + `contract_analyses`,
   and `public.contracts` has no doc_kind column — so the document kind that
   shape() had already prepared was dropped on the way out, and every synced
   row came back as a score with no idea what it scored. That is also why
   nothing ever read any of it back: there was nothing to render.

   Both sides are parsed from the repo rather than listed here, so the columns
   move the bar rather than needing this file edited to agree with them. */
const auth = fs.readFileSync(R("app", "auth.js"), "utf8");
const initSql = fs.readFileSync(R("supabase", "migrations", "0001_init.sql"), "utf8");

const tableBlock = (sql, name) =>
  (sql.match(new RegExp("create table (?:if not exists )?public\\." + name + "\\s*\\(([\\s\\S]*?)\\n\\);")) || [])[1] || "";
const columnsOf = (block) => block.split("\n")
  .map((l) => (l.trim().match(/^([a-z_]+)\s+[a-z]/) || [])[1])
  .filter(Boolean);

const analysesCols = columnsOf(tableBlock(initSql, "analyses"));
ok(analysesCols.length >= 6,
   `the analyses table was parsed (${analysesCols.join(", ") || "none"})`);

/* What pushLocal actually posts, lifted out of the shipped file. */
const pushBlock = (auth.match(/api\("\/rest\/v1\/analyses"[\s\S]*?\}\)\);/) || [""])[0];
ok(pushBlock.length > 80, "pushLocal posts to /rest/v1/analyses");
/* THE ROW OBJECT, not the request options. The first version of this swept
   every `key:` in the block and reported `method` and `body` as columns that do
   not exist on the table — it was reading fetch's arguments and calling them
   schema. Sliced to what is actually mapped into the insert. */
const rowObj = (pushBlock.match(/return \{([\s\S]*?)\};/) || [])[1] || "";
ok(rowObj.length > 40, "and the row it builds was found");
const sent = [...rowObj.matchAll(/([a-z_]+):/g)].map((m) => m[1]);
ok(sent.length >= 4, `and the columns it sends were parsed (${sent.join(", ") || "none"})`);
const unknown = sent.filter((c) => !analysesCols.includes(c));
ok(unknown.length === 0,
   `every column it sends exists on the table${unknown.length ? " — not on analyses: " + unknown.join(", ") : ""}`);
/* doc_kind by name: losing it is the exact defect being fixed, and it would
   otherwise be invisible — the insert still succeeds without it. */
ok(sent.includes("doc_kind"),
   "and the document kind is among them, which is what the old path dropped");

/* The read must ask for no more than the list renders. */
const pull = (auth.match(/\/rest\/v1\/analyses\?select=([a-z_,]+)/) || [])[1] || "";
ok(pull.length > 10, `pullLocal selects named columns (${pull || "none"})`);
const asked = pull.split(",");
ok(asked.every((c) => analysesCols.includes(c)),
   "each of which exists on the table");
ok(!asked.includes("rule_ids") && !asked.includes("verdict_key"),
   "and it asks for nothing the screen does not render");

(async () => {
  const b = await chromium.launch(launchOpts());

  const open = async (p, l, rows) => p.evaluate(([lang_, seed]) => {
    lang = lang_; applyLang(); nat = "sa"; obDone = true;
    myContracts = seed;
    renderBiz(); show("biz");
    return (document.querySelector(".screen.active") || {}).id;
  }, [l, rows]);

  for (const l of LANGS) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");

    /* ------------------------------- 0. it is behind the gate, and must be */
    /* THE WORKSPACE HOLDS THE READER'S OWN CONTRACTS NOW, so it belongs behind
       sign-in — and it is, because AUTH_FREE is an allowlist and this screen
       was never on it. Asserted rather than assumed, because it is the kind of
       thing a later "why is this screen unreachable in testing" fix removes.

       IT ALSO CAUGHT THIS FILE. Every assertion below reads #screen-biz's DOM,
       which renderBiz() fills whether or not the screen is showing — so the
       first version of this suite passed while every show("biz") was quietly
       redirecting to sign-in. A test that never asks which screen it is on
       cannot tell a working screen from an unreachable one. */
    const gated = await p.evaluate(() => {
      nat = "sa"; obDone = true; myContracts = [];
      renderBiz(); show("biz");
      return { active: (document.querySelector(".screen.active") || {}).id,
               authOn: authOn() };
    });
    if (gated.authOn) {
      ok(gated.active === "screen-signin",
         `${l}: signed out, the workspace sends you to sign in (${gated.active})`);
    } else {
      ok(true, `${l}: this build has no auth configured, so there is no gate to check`);
    }
    await p.evaluate(signInStub);

    /* ------------------------------------------ 1. the rows are the reader's */
    console.log(`\n— ${l}: the workspace shows the reader's own contracts`);
    const SEED = [
      { doc: "doc_emp",  score: 82, at: Date.UTC(2026, 7, 3),  signed: false },
      { doc: "doc_rent", score: 44, at: Date.UTC(2026, 6, 19), signed: true },
      { doc: "doc_free", score: 58, at: Date.UTC(2026, 5, 2),  signed: false },
    ];
    const landed = await open(p, l, SEED);
    ok(landed === "screen-biz",
       `${l}: signed in, the workspace is what opens (${landed})`);
    const got = await p.evaluate(() => ({
      scores: [...document.querySelectorAll("#bizContracts .brow .sc")]
        .map((e) => e.textContent.trim()),
      titles: [...document.querySelectorAll("#bizContracts .brow .tx b")]
        .map((e) => e.textContent.trim()),
      stats: [...document.querySelectorAll("#bizStats .st b")].map((e) => e.textContent.trim()),
      name: (document.getElementById("bizName") || {}).textContent || "",
      text: (document.getElementById("screen-biz") || {}).textContent || "",
      emptyShown: (() => {
        const e = document.getElementById("bizEmpty");
        return !!e && getComputedStyle(e).display !== "none";
      })(),
    }));
    const ar2en = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

    ok(got.scores.length === SEED.length,
       `${l}: one row per saved contract (${got.scores.length} of ${SEED.length})`);
    /* COMPARED TO THE SEED, not to a number typed below. The whole failure
       being fixed is a screen showing figures that came from nowhere. */
    ok(got.scores.map(ar2en).join(",") === SEED.map((c) => String(c.score)).join(","),
       `${l}: every score is the reader's own (${got.scores.join(", ")})`);
    ok(got.titles.length === SEED.length && got.titles.every((x) => x.length > 1),
       `${l}: every row names its document kind (${got.titles.join(", ")})`);

    /* ------------------------------------------------- 2. the stats agree */
    const n = SEED.length;
    const avg = Math.round(SEED.reduce((a, c) => a + c.score, 0) / n);
    /* 60 is scoreBand()'s own fair/good boundary. The fixture used 70, which
       belongs to no vocabulary in the app and cut the "good" band in half. */
    const need = SEED.filter((c) => c.score < 60).length;
    ok(got.stats.map(ar2en).join(",") === [n, avg, need].join(","),
       `${l}: the stats are computed from those rows (${got.stats.join(", ")} vs ${[n, avg, need].join(", ")})`);

    /* --------------------------------------- 3. nothing invented survives */
    ok(!/أفق|Ufuq/.test(got.text), `${l}: no invented company name`);
    ok(!/مقاعد|seats?\b/i.test(got.text), `${l}: no team seats`);
    ok(!/تجربة —|Trial —/.test(got.text), `${l}: no trial chip`);
    ok(!/undefined|NaN/.test(got.text), `${l}: no undefined or NaN`);
    ok(got.name.trim().length > 2 && !/أفق|Ufuq/.test(got.name),
       `${l}: the heading is the workspace, not a company ("${got.name.trim()}")`);
    ok(!got.emptyShown, `${l}: the empty state is hidden while there are rows`);

    /* ------------------------------------------------- 4. and when empty */
    console.log(`\n— ${l}: and when there is nothing in it yet`);
    await open(p, l, []);
    const none = await p.evaluate(() => ({
      rows: document.querySelectorAll("#bizContracts .brow").length,
      stats: [...document.querySelectorAll("#bizStats .st b")].map((e) => e.textContent.trim()),
      text: (document.getElementById("screen-biz") || {}).textContent || "",
      emptyShown: (() => {
        const e = document.getElementById("bizEmpty");
        return !!e && getComputedStyle(e).display !== "none" && e.textContent.trim().length > 5;
      })(),
    }));
    ok(none.rows === 0, `${l}: no rows (${none.rows})`);
    ok(none.emptyShown, `${l}: the empty state is shown and says something`);
    /* The case the fixture made unreachable: an empty list divided by zero. */
    ok(!/undefined|NaN/.test(none.text), `${l}: and still no NaN on an empty workspace`);
    ok(none.stats.map(ar2en).join(",") === "0,0,0",
       `${l}: the stats read zero rather than nothing (${none.stats.join(", ")})`);

    await p.close();
  }

  await b.close();
  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
    : "the workspace shows the reader's own contracts, and says so honestly when there are none"));
  process.exit(FAIL.length ? 1 : 0);
})();
