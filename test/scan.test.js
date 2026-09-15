/* The scan path, which existed on the server and had no client.
 *
 * upload/index.ts, the uploads table, the retention sweep and analyze's
 * resolveUpload() were all complete. Nothing in the app had ever called them:
 * there was no UPLOAD_URL, the file picker's accept list excluded every image
 * type, handleFile() rejected images again on the drop path, and a PDF with no
 * text layer dead-ended on "we could not read this" with two buttons, neither
 * of which sent anything. A photographed contract had nowhere to go.
 *
 * FOUR THINGS THIS PINS, because each was a separate way the path could be
 * wired and still be wrong:
 *
 * 1. THE BEARER. upload resolves the caller through /auth/v1/user before it
 *    accepts a byte, and resolveUpload() re-checks that the row belongs to the
 *    person asking. analyzeHeaders() sends only the anon key as a Bearer, so a call
 *    site added without authHeaders() returns 401 / not_your_upload. Asserted
 *    on both hops.
 * 2. THE CONSENT NAMES THE FILE. Every other AI path sends text the reader
 *    chose to paste. This sends the document, and the screen before it says so
 *    in those words.
 * 3. NO SCORE COMES BACK FROM A PHOTOGRAPH. Wodouh's own rules read no text
 *    there, so a number out of 100 would be invented. The review renders on
 *    its own, labelled as the AI's read.
 * 4. THE PAGE AND THE CALL SITE MOVE TOGETHER. test/claude-path.test.js holds
 *    that; this file holds the half it cannot see — that the offer is not
 *    shown when it cannot work.
 */
const { playwright, launchOpts, APP, signInStub, aiPage } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const PNG = () => new File([new Uint8Array([137, 80, 78, 71])], "contract.png", { type: "image/png" });

(async () => {
  const b = await chromium.launch(launchOpts());

  /* A page with both hops intercepted. Nothing reaches a real endpoint: this
     suite proves the CLIENT half, and says so rather than implying a live
     round trip was tested. */
  const wired = async (opts) => {
    opts = opts || {};
    const p = await aiPage(b, { viewport: { width: 390, height: 844 } });
    const seen = { upload: null, analyze: null };
    await p.route("**/functions/v1/upload", (r) => {
      const h = r.request().headers();
      seen.upload = {
        method: r.request().method(),
        auth: /^Bearer\s+\S+/.test(h.authorization || ""),
        type: (h["content-type"] || "").split(";")[0],
        /* The token must never travel anywhere it can be logged. */
        inUrl: /token|bearer/i.test(r.request().url()),
      };
      if (opts.uploadFail) return r.fulfill({ status: opts.uploadFail.status,
        contentType: "application/json", body: JSON.stringify(opts.uploadFail.body) });
      r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ upload: "11111111-2222-3333-4444-555555555555" }) });
    });
    await p.route("**/functions/v1/analyze", (r) => {
      seen.analyze = { auth: /^Bearer\s+\S+/.test(r.request().headers().authorization || ""),
                       body: JSON.parse(r.request().postData() || "{}") };
      r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ red_flags: [{ title: "Non-compete", why: "broad" }],
                               negotiation_points: [] }) });
    });
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    if (!opts.signedOut) await p.evaluate(signInStub);
    return { p, seen };
  };

  /* -------------------------------------- 1. a photograph reaches the offer */
  console.log("— a photographed contract is offered a way forward");
  {
    const { p } = await wired();
    const out = await p.evaluate(async () => {
      nat = "sa"; obDone = true;
      const f = new File([new Uint8Array([137, 80, 78, 71])], "contract.png", { type: "image/png" });
      await handleFile(f);
      await new Promise((r) => setTimeout(r, 2600));
      const btn = document.getElementById("nrScan");
      const notice = document.getElementById("offlineNotice");
      return { active: (document.querySelector(".screen.active") || {}).id,
               shown: !!btn && !btn.hidden, label: btn ? btn.textContent.trim() : "",
               held: !!pendingScan, reason: noreadReason,
               rejected: notice ? !notice.hidden : false };
    });
    ok(!out.rejected, "an image is no longer rejected as the wrong type");
    ok(out.active === "screen-noread", `it reaches the could-not-read screen (${out.active})`);
    ok(out.reason === "scan" && out.held, "the file is held, and the reason is a scan");
    ok(out.shown && out.label.length > 2, `and the offer is on screen ("${out.label}")`);
    await p.close();
  }

  /* --------------------------- 2. a font problem is NOT offered the upload */
  console.log("\n— but a file the upload could not help is not offered it");
  {
    const { p } = await wired();
    const out = await p.evaluate(async () => {
      nat = "sa"; obDone = true;
      /* Glyph soup: text operators ran, the output was not letters. Sending
         the file would waste an upload — re-exporting is what fixes it. */
      noreadReason = "glyphs"; pendingScan = null;
      renderNoread(); show("noread");
      const btn = document.getElementById("nrScan");
      return { shown: !!btn && !btn.hidden };
    });
    ok(!out.shown, "a font problem gets the re-export advice, not an upload");
    await p.close();
  }

  /* ------------------------------------------- 3. the send, hop by hop */
  console.log("\n— the send carries who is asking, and what the consent said");
  {
    const { p, seen } = await wired();
    const out = await p.evaluate(async () => {
      nat = "sa"; obDone = true;
      await handleFile(new File([new Uint8Array([137, 80, 78, 71])], "c.png", { type: "image/png" }));
      await new Promise((r) => setTimeout(r, 2600));
      offerScan();
      await new Promise((r) => setTimeout(r, 400));
      const dlg = document.getElementById("confirmDlg");
      const consent = dlg ? dlg.textContent : "";
      (dlg.querySelector("#dlgYes") || dlg.querySelectorAll("button")[1]).click();
      await new Promise((r) => setTimeout(r, 2000));
      const panel = document.getElementById("nrPanel");
      return { consent,
               panelShown: !!panel && !panel.hidden,
               panelText: panel ? panel.textContent : "",
               screenText: document.getElementById("screen-noread").textContent || "",
               stillHeld: !!pendingScan };
    });

    ok(!!seen.upload, "the file reaches the upload endpoint");
    ok(seen.upload && seen.upload.method === "POST" && seen.upload.type === "multipart/form-data",
       `as a multipart POST (${seen.upload && seen.upload.type})`);
    /* THE ONE THAT WOULD HAVE 401'd. */
    ok(seen.upload && seen.upload.auth, "carrying a Bearer token, which the function requires");
    ok(seen.upload && !seen.upload.inUrl, "and never in the URL, where it could be logged");

    ok(!!seen.analyze, "the review is then asked for");
    ok(seen.analyze && seen.analyze.body.kind === "contract_review",
       `as a contract review (${seen.analyze && seen.analyze.body.kind})`);
    ok(seen.analyze && typeof seen.analyze.body.upload === "string" && !seen.analyze.body.text,
       "by reference to the upload, with no text — there is none to send");
    ok(seen.analyze && seen.analyze.auth,
       "and with the Bearer, because resolveUpload re-checks who owns the row");

    ok(/الملف نفسه|file itself/i.test(out.consent),
       "the consent says the FILE goes, not text taken from it");
    ok(/Claude/i.test(out.consent), "and names who receives it");
    ok(out.panelShown && out.panelText.length > 20, "the review renders");
    /* A NUMBER HERE WOULD BE INVENTED. Wodouh's rules read no text. */
    ok(!/\/\s*100|من\s*100/.test(out.screenText),
       "and no score out of 100 comes back from a photograph");
    ok(!out.stillHeld, "the file is not kept once it has been sent");
    await p.close();
  }

  /* --------------------------------------- 3b. declining actually declines */
  console.log("\n— and saying no sends nothing");
  /* THE HALF A CONSENT IS FOR. The block above clicks yes, so it cannot see a
     missing consent check at all — deleting the gate left every assertion
     above passing. What a consent means is that NO stops it, and that is what
     is asserted here: the endpoint is watched and must never be reached. */
  {
    const { p, seen } = await wired();
    const out = await p.evaluate(async () => {
      nat = "sa"; obDone = true;
      await handleFile(new File([new Uint8Array([137, 80, 78, 71])], "c.png", { type: "image/png" }));
      await new Promise((r) => setTimeout(r, 2600));
      offerScan();
      await new Promise((r) => setTimeout(r, 400));
      const dlg = document.getElementById("confirmDlg");
      const shown = dlg && dlg.open === true;
      (dlg.querySelector("#dlgNo") || dlg.querySelectorAll("button")[0]).click();
      await new Promise((r) => setTimeout(r, 1200));
      return { shown, stillHeld: !!pendingScan };
    });
    ok(out.shown, "the consent is a real dialog the reader has to answer");
    ok(seen.upload === null, "declining sends nothing at all");
    ok(out.stillHeld, "and the file is still there, so they can change their mind");
    await p.close();
  }

  /* ------------------------------------ 4. refusals are the reader's, not ours */
  console.log("\n— the function's refusals reach the reader in their own terms");
  for (const [label, status, body, want] of [
    ["too large", 413, { error: "too_large" }, /أكبر|كبير|large/i],
    ["wrong type", 415, { error: "bad_type" }, /نوع|type|PDF/i],
    ["signed out", 401, { error: "sign_in_required" }, /الدخول|sign in/i],
  ]) {
    const { p } = await wired({ uploadFail: { status, body } });
    const msg = await p.evaluate(async () => {
      nat = "sa"; obDone = true;
      await handleFile(new File([new Uint8Array([137, 80, 78, 71])], "c.png", { type: "image/png" }));
      await new Promise((r) => setTimeout(r, 2600));
      offerScan();
      await new Promise((r) => setTimeout(r, 400));
      const dlg = document.getElementById("confirmDlg");
      (dlg.querySelector("#dlgYes") || dlg.querySelectorAll("button")[1]).click();
      await new Promise((r) => setTimeout(r, 1500));
      const n = document.getElementById("offlineNotice");
      return n && !n.hidden ? n.textContent : "";
    });
    ok(want.test(msg), `${label}: said in words the reader can act on ("${msg.slice(0, 44)}")`);
    await p.close();
  }

  /* ------------------------------- 5. it does not offer what it cannot do */
  console.log("\n— and it is never offered when it could not work");
  {
    const { p } = await wired({ signedOut: true });
    const out = await p.evaluate(() => {
      nat = "sa"; obDone = true; noreadReason = "scan";
      pendingScan = new File([new Uint8Array([1])], "x.png", { type: "image/png" });
      const signedOutHidden = (renderNoread(), document.getElementById("nrScan").hidden);
      /* And with no endpoint configured at all — the shipped-inert rule. */
      window.WODOUH_CONFIG = Object.assign({}, window.WODOUH_CONFIG, { UPLOAD_URL: "" });
      renderNoread();
      return { signedOutHidden, unconfiguredHidden: document.getElementById("nrScan").hidden,
               authOn: authOn() };
    });
    if (out.authOn) {
      ok(out.signedOutHidden, "signed out, no offer — it would only 401");
    } else {
      ok(true, "no auth configured in this build, so there is no signed-out case");
    }
    ok(out.unconfiguredHidden, "no endpoint, no offer");
    await p.close();
  }

  await b.close();
  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
    : "the scan path is wired, authenticated and honest about what it sends" +
      " — NOTE: both endpoints are intercepted here; no live upload was performed"));
  process.exit(FAIL.length ? 1 : 0);
})();
