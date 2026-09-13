/* Ask Wodouh — the screen, at the width nothing ever tested it at.
 *
 * TWO DEFECTS, neither of them CSS, which is where the search naturally goes
 * for a bug reported as desktop-only.
 *
 * 1. RESUMING AFTER SIGN-IN OPENED A BLANK ASSISTANT. "assist" is deliberately
 *    not in AUTH_FREE — the screen spends a metered allowance — so pressing it
 *    signed-out sends the reader to sign in, and resumeAfterAuth() brought
 *    them back with show("assist"). show() has no render hook for that screen,
 *    so they landed on it with 0 messages, 0 capability chips, an empty quota
 *    line and no placeholder. Including as_not_lawyer, the "I'm an AI, not a
 *    lawyer" line, which is the one message there that is not decoration.
 *    That is precisely the first-time reader's path, and desktop is where
 *    first-time readers land — which is why it read as desktop-only.
 *
 * 2. THE SCREEN CALLED ASK WODOUH DID NOT ASK WODOUH. ask() called answer(),
 *    a local keyword table, and made no network request at any width, while a
 *    graded, consent-gated, citation-tiered AI ask sat on a different screen
 *    wired to the configured endpoint.
 *
 * WHY NOTHING CAUGHT EITHER. Every assistant assertion in this suite runs at
 * 390 or 430px; test/desktop.test.js never mentions the assistant; and
 * test/ask.test.js — the file whose name suggests it covers this — tests
 * #screen-ask, a different screen. This file runs at 1440 for that reason.
 */
const { playwright, launchOpts, APP, signInStub } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* Desktop first, and a phone width after it, so a fix aimed at one cannot
   quietly cost the other. */
const WIDTHS = [[1440, 900, "desktop"], [390, 844, "phone"]];

(async () => {
  const b = await chromium.launch(launchOpts());

  for (const [w, h, label] of WIDTHS) {
    /* ------------------------------- 1. it is gated, and comes back whole */
    console.log(`\n— ${label} (${w}px): signing in returns to a working assistant`);
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on("pageerror", (e) => FAIL.push(`${label}: pageerror: ` + e.message));
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");

    const gated = await p.evaluate(() => {
      nat = "sa"; obDone = true; openAssist("home");
      return { active: (document.querySelector(".screen.active") || {}).id, authOn: authOn() };
    });
    if (gated.authOn) {
      ok(gated.active === "screen-signin",
         `${label}: signed out it asks for sign-in first, because it spends an allowance (${gated.active})`);
    } else {
      ok(true, `${label}: no auth configured in this build, so there is no gate to check`);
    }

    await p.evaluate(signInStub);
    /* THE PATH THAT WAS BROKEN. Not openAssist() — the resume that follows a
       successful sign-in, which is what a first-time reader actually walks. */
    const back = await p.evaluate(() => {
      nat = "sa"; obDone = true;
      pendingNav = { kind: "screen", payload: "assist" };
      resumeAfterAuth();
      const chatBox = document.getElementById("chat");
      return {
        active: (document.querySelector(".screen.active") || {}).id,
        msgs: chatBox.querySelectorAll(".msg").length,
        caps: document.querySelectorAll("#caps button").length,
        quota: (document.getElementById("quota").textContent || "").trim(),
        placeholder: document.getElementById("askInput").placeholder || "",
        text: chatBox.textContent || "",
      };
    });
    ok(back.active === "screen-assist", `${label}: it lands on the assistant (${back.active})`);
    ok(back.msgs >= 2, `${label}: the conversation is there, not an empty box (${back.msgs} messages)`);
    ok(back.caps > 0, `${label}: the suggestions are rendered (${back.caps})`);
    ok(back.quota.length > 2, `${label}: the allowance is stated ("${back.quota.slice(0, 30)}")`);
    ok(back.placeholder.length > 2, `${label}: the input knows what to ask for`);
    /* The disclaimer is the reason this assertion is not just about polish. */
    ok(/لست محاميًا|not a lawyer/i.test(back.text),
       `${label}: and the "I am not a lawyer" line is on screen`);

    /* ---------------------------------- 2. the control is usable, not just present */
    const ctl = await p.evaluate(() => {
      const i = document.getElementById("askInput"), s = document.getElementById("askSend");
      const r = (e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
      const hitAt = (e) => {
        const b = e.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!top && (top === e || e.contains(top));
      };
      return { input: r(i), send: r(s), inputHit: hitAt(i), sendHit: hitAt(s),
               disabled: i.disabled || s.disabled };
    });
    ok(ctl.input.w > 80 && ctl.input.h >= 40,
       `${label}: the input has real size (${ctl.input.w}x${ctl.input.h})`);
    ok(ctl.send.w >= 44 && ctl.send.h >= 44,
       `${label}: the send button meets the touch minimum (${ctl.send.w}x${ctl.send.h})`);
    /* Hit-tested, not merely measured. A box with size that something else
       covers is the failure a size assertion cannot see — and an overlay was
       the first thing suspected here. */
    ok(ctl.inputHit && ctl.sendHit,
       `${label}: and nothing is covering either of them (input ${ctl.inputHit}, send ${ctl.sendHit})`);
    ok(!ctl.disabled, `${label}: neither is disabled on arrival`);

    await p.close();
  }

  /* ------------------------------------- 3. it actually asks, and tiers it */
  console.log("\n— the screen called Ask Wodouh asks Wodouh");
  const tierCase = async (tier, cites) => {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    let req = null;
    await p.route("**/functions/v1/analyze", (r) => {
      req = { method: r.request().method(), body: JSON.parse(r.request().postData() || "{}") };
      r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ tier, answer: "ANSWER-BODY", cites, reason: "citation" }) });
    });
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    await p.evaluate(signInStub);
    const out = await p.evaluate(async () => {
      nat = "sa"; obDone = true; openAssist("home");
      const before = askLeft();
      /* Through the form, the way a reader sends it — not by calling ask()
         directly, which would skip the submit handler entirely. */
      document.getElementById("askInput").value = "هل يحق لهم فصلي بدون إشعار؟";
      document.getElementById("askSend").click();
      await new Promise((r) => setTimeout(r, 1400));
      const bots = [...document.querySelectorAll("#chat .msg.bot")];
      const last = bots[bots.length - 1];
      return { text: last.textContent || "",
               refs: [...last.querySelectorAll(".ref")].map((x) => x.textContent),
               spent: before - askLeft() };
    });
    await p.close();
    return { req, ...out };
  };

  const v = await tierCase("verified", [{ article: "Saudi Labor Law — Article 77" }]);
  ok(!!v.req && v.req.method === "POST" && v.req.body.kind === "ask",
     `a question reaches the endpoint as a POST (${v.req && v.req.body.kind})`);
  ok(!/ANSWER-BODY/.test(String(v.req && JSON.stringify(v.req.body))),
     "and the request carries the question, not a fabricated answer");
  ok(/ANSWER-BODY/.test(v.text), "the model's answer reaches the bubble");
  ok(/تحققنا منه|we verified/i.test(v.text), "labelled as verified, in the app's own words");
  ok(v.refs.length === 1 && /Article 77/.test(v.refs[0]),
     `and its article is shown (${v.refs.join(", ") || "none"})`);
  /* SPENT ON THE ATTEMPT. A cap that only counts successes is a cap a retry
     loop walks straight through. */
  ok(v.spent === 1, `one question costs one from the persisted allowance (${v.spent})`);

  const u = await tierCase("unverified", []);
  /* THE WARNING, NOT THE LABEL. The first version of this matched
     /ما تحققنا|not verified/, which the tier label «⚠ معلومة عامة — ما تحققنا
     منها» satisfies on its own — so deleting ask_unv_b, the sentence that
     actually tells a reader not to decide on this, changed nothing and the
     assertion still printed ok. The label names the tier; the warning is the
     part that does the work, and it is the part asserted. */
  ok(/ما تحققنا|not verified/i.test(u.text),
     "an unverified answer carries the tier label");
  ok(/قرارًا نهائيًا|final decision/i.test(u.text),
     "and the warning that says not to decide on it");
  ok(u.refs.length === 0, "and carries no article it cannot back");

  const r = await tierCase("refused", []);
  ok(!/ANSWER-BODY/.test(r.text),
     "a refusal withholds the answer body entirely rather than trimming it");
  ok(r.text.trim().length > 20, "and explains why");

  /* ------------------------------- 4. a failure is not charged for */
  console.log("\n— a request that produced no answer costs nothing");
  /* THE OTHER HALF OF A GUARANTEE THIS SCREEN HAS ALWAYS MADE. The offline
     engine never charged for a question it could not place — asserted in
     test/surfaces.test.js — and wiring the model in broke it: the allowance
     was spent before the request and kept when the request failed. Spending up
     front is right (a cap that only counts successes is walked through by a
     retry loop); keeping it when the reader got nothing is not.
     A refusal still costs, and that is deliberate: a refusal is a real answer
     the model produced. */
  const failCase = async (fulfil) => {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.route("**/functions/v1/analyze", fulfil);
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    await p.evaluate(signInStub);
    const out = await p.evaluate(async () => {
      nat = "sa"; obDone = true; openAssist("home");
      const before = askLeft();
      document.getElementById("askInput").value = "سؤال";
      document.getElementById("askSend").click();
      await new Promise((r) => setTimeout(r, 1600));
      const bots = [...document.querySelectorAll("#chat .msg.bot")];
      return { spent: before - askLeft(), text: bots[bots.length - 1].textContent || "" };
    });
    await p.close();
    return out;
  };

  const dead = await failCase((r) => r.abort());
  ok(dead.spent === 0, `a network failure is refunded (${dead.spent} spent)`);
  ok(dead.text.trim().length > 10, "and the reader is told, rather than left with a spinner");

  const busy = await failCase((r) => r.fulfill({ status: 429, contentType: "application/json", body: "{}" }));
  ok(busy.spent === 0, `a rate-limited request is refunded (${busy.spent} spent)`);

  const refused2 = await failCase((r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ tier: "refused", answer: "", reason: "citation" }) }));
  ok(refused2.spent === 1,
     `but a refusal still costs, because the model did answer (${refused2.spent} spent)`);

  await b.close();
  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
    : "Ask Wodouh opens whole after sign-in, reaches the model, and labels what comes back"));
  process.exit(FAIL.length ? 1 : 0);
})();
