/* Tap checkout — prices, the paid/not-paid decision, and a browser
 * that does not send an amount.
 *
 * The decision function is the one the webhook imports. A reimplementation
 * here would go green while the function that marks orders paid drifted.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const { playwright, launchOpts, APP, signInStub } = require("./_env.js");

const ROOT = path.join(__dirname, "..");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const ORDER = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const CHARGE = "chg_TS05A4120230736x9K22710693";

function order(over = {}) {
  return {
    id: ORDER, user_id: USER, plan_id: "plan_review",
    amount: 19900, currency: "SAR", status: "pending", mode: "test",
    ...over,
  };
}
function charge(over = {}) {
  return {
    id: CHARGE, object: "charge", live_mode: false, status: "CAPTURED",
    amount: 199, currency: "SAR",
    transaction: { created: "1698392202943" },
    reference: { gateway: "mada_x", payment: "4327" },
    metadata: { order_id: ORDER, user_id: USER, plan_id: "plan_review" },
    ...over,
  };
}

(async () => {
  const tap = await import(path.join(ROOT, "supabase/functions/_shared/tap.mjs"));

  console.log("\n— the server catalogue is the app catalogue, in riyals and halalas");
  const html = read("app/index.html");
  const expected = {
    plan_review: 199, plan_reviews5: 699, plan_letter: 149,
    plan_case: 349, plan_bundle: 549, plan_biz: 799,
  };
  for (const [id, sar] of Object.entries(expected)) {
    const found = html.match(new RegExp('name:\\s*"' + id + '"[\\s\\S]{0,320}?amt:\\s*(\\d+)'));
    ok(!!found && Number(found[1]) === sar, `${id} is ${sar} SAR in the app`);
    const plan = tap.planById(id);
    ok(!!plan && plan.sar === sar && plan.halalas === sar * 100,
       `${id} is ${sar} SAR and ${sar * 100} halalas on the server`);
  }
  ok(tap.planById("plan_lawyer") === null, "the lawyer tier is not for sale");
  ok(tap.planById("plan_draft") === null, "contract drafting is not for sale");
  ok(tap.planById("plan_case_lawyer") === null, "the case-file lawyer tier is not for sale");
  ok(tap.formatAmount(199, "SAR") === "199.00", "SAR hashes with two decimal places");
  ok(tap.formatAmount(1, "KWD") === "1.000", "KWD hashes with three decimal places");
  ok(tap.toMinor(199, "SAR") === 19900, "199 SAR is 19900 halalas in our table");
  ok(tap.toMinor("1.50", "SAR") === 150, "a riyal and a half is 150 halalas");

  console.log("\n— a charge is marked paid only when the fetched charge agrees");
  ok(tap.decideCharge(order(), charge(), "test").status === "paid",
     "a test CAPTURED charge whose amount matches is paid");
  ok(tap.decideCharge(order(), charge({ amount: 1 }), "test").reason === "amount_mismatch",
     "a smaller fetched amount is not paid, even when status is CAPTURED");
  ok(tap.decideCharge(order(), charge({ currency: "USD" }), "test").reason === "currency",
     "a non-SAR charge is not paid");
  ok(tap.decideCharge(order(), charge({ live_mode: true }), "test").reason === "mode_mismatch",
     "a live charge is ignored while the deployment is in test");
  ok(tap.decideCharge(order({ mode: "live" }), charge({ live_mode: true }), "live").status === "paid",
     "a live charge is paid only when the deployment is live");
  ok(tap.decideCharge(order(), charge({ status: "FAILED" }), "test").status === "failed",
     "a fetched FAILED charge does not mark the order paid");
  ok(tap.decideCharge(order(), charge({ status: "INITIATED" }), "test").reason === "not_settled",
     "an initiated charge is not granted");
  ok(tap.decideCharge(order({ status: "paid" }), charge({ status: "DECLINED" }), "test").reason === "already_paid",
     "a later failure does not un-pay an order");
  ok(tap.decideCharge(order({ status: "paid" }), charge({ status: "REFUNDED" }), "test").status === "refunded",
     "a refund moves a paid order to refunded");
  ok(tap.decideCharge(order(), charge({ metadata: { order_id: ORDER, user_id: "99999999-9999-4999-8999-999999999999", plan_id: "plan_review" } }),
     "test").reason === "user_mismatch",
     "a charge whose metadata names another user is not applied");

  console.log("\n— the hashstring is Tap's field order, and the redirect host is Tap's");
  const material = tap.chargeHashMaterial(charge());
  ok(material === "x_id" + CHARGE + "x_amount199.00x_currencySARx_gateway_referencemada_xx_payment_reference4327x_statusCAPTUREDx_created1698392202943",
     "the hashed string rounds SAR and keeps every label");
  const emptyGateway = tap.chargeHashMaterial(charge({ reference: { payment: "1" } }));
  ok(emptyGateway.includes("x_gateway_referencex_payment_reference1"),
     "a missing gateway reference is an empty value, not a dropped label");
  const mac = await tap.hmacHex("sk_test_example", material);
  const expect = crypto.createHmac("sha256", "sk_test_example").update(material).digest("hex");
  ok(mac === expect && mac.length === 64, "hashstring is HMAC-SHA256 of that string");
  ok(tap.safeCheckoutUrl("https://acceptance.sandbox.tap.company/gosell/v2/payment/tap_process.aspx?chg=abc") !== null,
     "a Tap sandbox checkout URL is allowed");
  ok(tap.safeCheckoutUrl("http://acceptance.sandbox.tap.company/pay") === null, "plain http is refused");
  ok(tap.safeCheckoutUrl("https://evil.example/tap.company") === null, "a foreign host is refused");
  ok(tap.safeCheckoutUrl("https://tap.company.evil.example/x") === null, "a lookalike suffix is refused");
  ok(tap.safeCheckoutUrl("https://user:pass@acceptance.sandbox.tap.company/x") === null, "credentials in the URL are refused");
  const stripped = tap.publicEvent({
    id: CHARGE, status: "CAPTURED", card: { first_six: "446404", last_four: "0007" },
    customer: { email: "a@b.co" },
  });
  ok(!("card" in stripped) && !("customer" in stripped) && stripped.status === "CAPTURED",
     "the stored event drops the card and the customer");

  console.log("\n— keys and mode have to name the same world");
  ok(tap.paymentMode(undefined) === "test", "an unset PAYMENT_MODE is test");
  ok(tap.paymentMode("LIVE") === "live", "live is explicit");
  ok(tap.paymentMode("production") === "invalid", "anything else is invalid, not a quiet test");
  ok(tap.modeAgrees("test", "sk_test_abc", "") === true, "a test secret with no public key is test");
  ok(tap.modeAgrees("test", "sk_live_abc", "") === false, "a live secret is refused while mode is test");
  ok(tap.modeAgrees("live", "sk_test_abc", "") === false, "a test secret is refused while mode is live");
  ok(tap.modeAgrees("live", "sk_live_abc", "") === true, "a live secret with no public key is allowed");
  ok(tap.modeAgrees("live", "sk_live_abc", "pk_live_abc") === true, "a live public key agrees with a live secret");
  ok(tap.modeAgrees("live", "sk_live_abc", "pk_test_abc") === false, "a test public key cannot ride along with a live secret");

  console.log("\n— the secret stays off the client, and the client does not set the price");
  const client = read("app/payments-tap.js");
  const create = read("supabase/functions/create-payment/index.ts");
  const hook = read("supabase/functions/tap-webhook/index.ts");
  const appFiles = ["app/index.html", "app/payments-tap.js", "app/auth.js", "supabase/config.example.js"];
  for (const f of appFiles) {
    ok(!/sk_(test|live)_[A-Za-z0-9]{8,}/.test(read(f)), `${f} has no Tap secret key`);
    ok(!/moyasar/i.test(read(f)), `${f} does not call Moyasar`);
  }
  ok(!/moyasar/i.test(create) && !/moyasar/i.test(hook), "the Edge Functions do not call Moyasar");
  ok(/api\.tap\.company/.test(create) && /api\.tap\.company/.test(hook), "both functions talk to api.tap.company");
  ok(/src_all/.test(create) && /amount: plan\.sar/.test(create), "the charge is a hosted page priced in riyals");
  const env = read(".env.example");
  ok(/^TAP_SECRET_KEY=\s*$/m.test(env), ".env.example leaves TAP_SECRET_KEY empty");
  ok(/^TAP_PUBLIC_KEY=\s*$/m.test(env), ".env.example leaves the public key empty");
  ok(/^TAP_WEBHOOK_SECRET=\s*$/m.test(env), ".env.example leaves the webhook secret empty");
  ok(!/MOYASAR_/.test(env), ".env.example has no Moyasar secret");
  ok(/PAYMENT_MODE=test/.test(env), ".env.example defaults PAYMENT_MODE to test");
  ok(!/body\.amount/.test(create), "create-payment never reads an amount from the body");
  ok(/planById\(body\.plan_id\)/.test(create), "create-payment prices from plan_id");
  ok(/not_configured/.test(create) && /not_configured/.test(hook), "both functions answer not_configured");
  ok(/hashstring/.test(hook) && /hmacHex\(/.test(hook), "the webhook checks Tap's hashstring");
  ok(/decideCharge\(/.test(hook), "the webhook uses the shared paid/not-paid decision");
  const PUB = "pk_live_f6UaSj8gmLvbTWANpu5Iz9MJEY1Bn";
  ok(html.includes('TAP_PUBLIC_KEY: "' + PUB + '"'), "the live public key is in the app config");
  ok(read("supabase/config.example.js").includes(PUB), "the example client config carries the same public key");
  ok(!/sk_(test|live)_[A-Za-z0-9]{8,}/.test(html + client), "the secret key is not next to the public key");
  ok(/function publicKey\(/.test(client) && /TAP_PUBLIC_KEY/.test(client), "the Tap module reads the public key");
  ok(/CREATE_PAYMENT_URL/.test(client) && !/sk_/.test(client), "the browser knows the function URL and no secret");
  ok(/plan_id: planId/.test(client) && !/amount:/.test(client), "the browser posts a plan id and no amount");
  ok(/chosen\.up/.test(client), "an upgrade difference is not charged");

  console.log("\n— in the browser, checkout is hidden until configured, then it posts a plan id");
  const { chromium } = playwright();
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage();
  const bodies = [];
  let leftForTap = false;
  const checkoutUrl = "https://acceptance.sandbox.tap.company/gosell/v2/payment/tap_process.aspx?chg=abc";
  await page.route("**/functions/v1/create-payment", async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const mode = bodies.length;
    if (mode === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_configured" }),
      });
      return;
    }
    if (mode === 2) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          order_id: ORDER, checkout_url: checkoutUrl,
          amount: 1, currency: "SAR", plan_id: body.plan_id, mode: "test",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        order_id: ORDER, checkout_url: checkoutUrl,
        amount: Math.round(bodyExpect.amt * 100), currency: "SAR",
        plan_id: body.plan_id, mode: "test",
      }),
    });
  });
  await page.route("https://acceptance.sandbox.tap.company/**", async (route) => {
    leftForTap = true;
    await route.abort();
  });
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof WodouhTap === "object");

  const hidden = await page.evaluate(() => {
    const el = document.getElementById("tapSlot");
    return !!el && getComputedStyle(el).display === "none";
  });
  const cfgPay = await page.evaluate(() => (window.WODOUH_CONFIG || {}).CREATE_PAYMENT_URL || "");
  if (cfgPay) {
    ok(cfgPay === await page.evaluate(() => WODOUH_CONFIG.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/create-payment"),
       "CREATE_PAYMENT_URL is this project's create-payment function and nothing else");
  } else {
    ok(hidden, "the account slot is hidden while CREATE_PAYMENT_URL is unset");
  }
  const seenKey = await page.evaluate(() => ({
    cfg: (window.WODOUH_CONFIG || {}).TAP_PUBLIC_KEY,
    mod: WodouhTap.publicKey()
  }));
  /* Compared against the value shipped in app/index.html rather than a
     literal here: the publishable key is public by design, but a second
     copy of a live-key-shaped string in a test file is what secret scanners
     are right to flag. */
  const shipped = (fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8")
    .match(/TAP_PUBLIC_KEY:\s*"(pk_live_[A-Za-z0-9]+)"/) || [])[1];
  ok(!!shipped && seenKey.cfg === shipped && seenKey.mod === seenKey.cfg,
     "the running page exposes the live public key and nothing else");

  const granted = await page.evaluate(() => {
    owned = { review: null, letter: null, case: null };
    const yes = grantPurchasedPlan("plan_bundle");
    return { yes, review: owned.review, letter: owned.letter, case: owned.case };
  });
  ok(granted.yes && granted.review === "plan_review" && granted.letter === "plan_letter" && granted.case === "plan_case",
     "a paid bundle unlocks the three products it names");
  ok(await page.evaluate(() => grantPurchasedPlan("plan_lawyer")) === false,
     "a lawyer plan id does not unlock anything");

  await page.evaluate(signInStub);
  const bodyExpect = await page.evaluate(() => {
    WODOUH_CONFIG.CREATE_PAYMENT_URL = WODOUH_CONFIG.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/create-payment";
    WodouhTap.mount();
    const plans = wodouhCatalogue();
    return { n: plans.length, id: plans[0].id, amt: plans[0].amt,
             ids: plans.map((p) => p.id),
             text: document.getElementById("tapSlot").textContent };
  });
  ok(bodyExpect.n === 6, `six sellable plans are offered (${bodyExpect.n})`);
  if (await page.evaluate(() => FREE_NOW)) {
    ok(/مجانية/.test(bodyExpect.text), "while FREE_NOW, the slot says the product is still free");
  } else {
    ok(!/مجانية/.test(bodyExpect.text), "with FREE_NOW off, the slot no longer says the product is free");
  }
  ok(!bodyExpect.ids.includes("plan_lawyer") && !bodyExpect.ids.includes("plan_draft"),
     "unsellable plans are not offered");

  const clickPlan = () => page.evaluate(() => {
    document.querySelector("#tapSlot .tap-plans button").click();
  });
  await clickPlan();
  await page.waitForFunction(() => /لن يُخصم/.test((document.getElementById("tapMsg") || {}).textContent || ""));
  const off = await page.evaluate(() => document.getElementById("tapMsg").textContent);
  ok(/لن يُخصم/.test(off), `a 503 not_configured tells the reader nothing was charged (${off})`);
  ok(!leftForTap, "a not_configured response does not navigate to Tap");

  await clickPlan();
  await page.waitForFunction(() => /لا يطابق/.test(document.getElementById("tapMsg").textContent));
  ok(!leftForTap, "a server amount that disagrees with the screen is not followed");

  const opened = page.waitForRequest((r) => r.url().startsWith("https://acceptance.sandbox.tap.company/"), { timeout: 10000 });
  await clickPlan();
  const checkout = await opened;
  ok(checkout.url().startsWith("https://acceptance.sandbox.tap.company/"),
     "a matching charge URL is opened on tap.company (" + checkout.url() + ")");

  ok(bodies.length === 3, `three checkout attempts were posted (${bodies.length})`);
  ok(bodies.every((b) => b && b.plan_id === bodyExpect.id && !("amount" in b) &&
       Object.keys(b).sort().join(",") === "lang,plan_id"),
     "every post is plan_id and lang, and never an amount");

  await browser.close();

  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nTap stays sandbox-ready, and the browser does not set the price");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
