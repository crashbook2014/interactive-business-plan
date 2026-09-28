/* Moyasar checkout — prices, the paid/not-paid decision, and a browser
 * that does not send an amount.
 *
 * The decision function is the one the webhook imports. A reimplementation
 * here would go green while the function that marks orders paid drifted.
 */
const fs = require("node:fs");
const path = require("node:path");
const { playwright, launchOpts, APP, signInStub } = require("./_env.js");

const ROOT = path.join(__dirname, "..");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const ORDER = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function order(over = {}) {
  return {
    id: ORDER, user_id: USER, plan_id: "plan_review",
    amount: 19900, currency: "SAR", status: "pending", mode: "test",
    ...over,
  };
}
function payment(over = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    amount: 19900, currency: "SAR", status: "paid",
    metadata: { order_id: ORDER, user_id: USER, plan_id: "plan_review" },
    ...over,
  };
}

(async () => {
  const moy = await import(path.join(ROOT, "supabase/functions/_shared/moyasar.mjs"));

  console.log("\n— the server catalogue is the app catalogue, in halalas");
  const html = read("app/index.html");
  const expected = {
    plan_review: 199, plan_reviews5: 699, plan_letter: 149,
    plan_case: 349, plan_bundle: 549, plan_biz: 799,
  };
  for (const [id, sar] of Object.entries(expected)) {
    const found = html.match(new RegExp('name:\\s*"' + id + '"[\\s\\S]{0,320}?amt:\\s*(\\d+)'));
    ok(!!found && Number(found[1]) === sar, `${id} is ${sar} SAR in the app`);
    const plan = moy.planById(id);
    ok(!!plan && plan.sar === sar && plan.halalas === sar * 100,
       `${id} is ${sar * 100} halalas on the server`);
  }
  ok(moy.planById("plan_lawyer") === null, "the lawyer tier is not for sale");
  ok(moy.planById("plan_draft") === null, "contract drafting is not for sale");
  ok(moy.planById("plan_case_lawyer") === null, "the case-file lawyer tier is not for sale");
  ok(moy.planById("plan_review").halalas === 19900, "199 SAR is 19900 halalas, not 199");

  console.log("\n— a payment is marked paid only when the fetched payment agrees");
  ok(moy.decidePayment(order(), payment(), "payment_paid", "test", false).status === "paid",
     "a test payment_paid whose fetched amount matches is paid");
  ok(moy.decidePayment(order(), payment({ amount: 100 }), "payment_paid", "test", false).reason === "amount_mismatch",
     "a smaller fetched amount is not paid, even on payment_paid");
  ok(moy.decidePayment(order(), payment({ currency: "USD" }), "payment_paid", "test", false).reason === "currency",
     "a non-SAR payment is not paid");
  ok(moy.decidePayment(order(), payment(), "payment_paid", "test", true).reason === "mode_mismatch",
     "a live event is ignored while the deployment is in test");
  ok(moy.decidePayment(order({ mode: "live" }), payment(), "payment_paid", "live", true).status === "paid",
     "a live event is paid only when the deployment is live");
  ok(moy.decidePayment(order(), payment({ status: "failed" }), "payment_paid", "test", false).reason === "status_mismatch",
     "payment_paid with a fetched status of failed does not mark the order paid");
  ok(moy.decidePayment(order(), payment({ status: "authorized" }), "payment_paid", "test", false).action === "retry",
     "an authorized-but-not-captured payment is retried, not granted");
  ok(moy.decidePayment(order(), payment({ status: "failed" }), "payment_faild", "test", false).status === "failed",
     "Moyasar's payment_faild spelling is accepted");
  ok(moy.decidePayment(order({ status: "paid" }), payment({ status: "failed" }), "payment_faild", "test", false).reason === "already_paid",
     "a later failure does not un-pay an order");
  ok(moy.decidePayment(order({ status: "paid" }), payment({ status: "refunded" }), "payment_refunded", "test", false).status === "refunded",
     "a refund moves a paid order to refunded");
  ok(moy.decidePayment(order(), payment({ metadata: { order_id: ORDER, user_id: "99999999-9999-4999-8999-999999999999", plan_id: "plan_review" } }),
     "payment_paid", "test", false).reason === "user_mismatch",
     "a payment whose metadata names another user is not applied");

  console.log("\n— the webhook secret is an equality check, and the redirect host is Moyasar's");
  ok(moy.tokensMatch("same-secret", "same-secret"), "a matching secret_token passes");
  ok(!moy.tokensMatch("same-secret", "same-secreT"), "a near miss fails");
  ok(!moy.tokensMatch("short", "same-secret"), "a different length fails");
  ok(!moy.tokensMatch("", "same-secret"), "an empty token fails");
  ok(moy.safeCheckoutUrl("https://checkout.moyasar.com/invoices/abc") !== null, "a Moyasar invoice URL is allowed");
  ok(moy.safeCheckoutUrl("http://checkout.moyasar.com/invoices/abc") !== null, "Moyasar's own http sandbox host is allowed");
  ok(moy.safeCheckoutUrl("https://evil.example/checkout.moyasar.com") === null, "a foreign host is refused");
  ok(moy.safeCheckoutUrl("https://moyasar.com.evil.example/x") === null, "a lookalike suffix is refused");
  ok(moy.safeCheckoutUrl("https://user:pass@checkout.moyasar.com/x") === null, "credentials in the URL are refused");
  const stripped = moy.publicEvent({ id: "1", secret_token: "super-secret", type: "payment_paid" });
  ok(!("secret_token" in stripped) && stripped.type === "payment_paid", "the stored event drops secret_token");

  console.log("\n— keys and mode have to name the same world");
  ok(moy.paymentMode(undefined) === "test", "an unset PAYMENT_MODE is test");
  ok(moy.paymentMode("LIVE") === "live", "live is explicit");
  ok(moy.paymentMode("production") === "invalid", "anything else is invalid, not a quiet test");
  ok(moy.modeAgrees("test", "sk_test_abc", "") === true, "a test secret with no publishable key is test");
  ok(moy.modeAgrees("test", "sk_live_abc", "") === false, "a live secret is refused while mode is test");
  ok(moy.modeAgrees("live", "sk_test_abc", "") === false, "a test secret is refused while mode is live");
  ok(moy.modeAgrees("live", "sk_live_abc", "pk_test_abc") === false, "a test publishable key cannot ride along with a live secret");

  console.log("\n— the secret stays off the client, and the client does not set the price");
  const client = read("app/payments-moyasar.js");
  const create = read("supabase/functions/create-payment/index.ts");
  const hook = read("supabase/functions/moyasar-webhook/index.ts");
  const appFiles = ["app/index.html", "app/payments-moyasar.js", "app/auth.js", "supabase/config.example.js"];
  for (const f of appFiles) {
    ok(!/sk_(test|live)_[A-Za-z0-9]{8,}/.test(read(f)), `${f} has no Moyasar secret key`);
  }
  const env = read(".env.example");
  ok(/^MOYASAR_SECRET_KEY=\s*$/m.test(env), ".env.example leaves MOYASAR_SECRET_KEY empty");
  ok(/^MOYASAR_PUBLISHABLE_KEY=\s*$/m.test(env), ".env.example leaves the publishable key empty");
  ok(/^MOYASAR_WEBHOOK_SECRET=\s*$/m.test(env), ".env.example leaves the webhook secret empty");
  ok(/PAYMENT_MODE=test/.test(env), ".env.example defaults PAYMENT_MODE to test");
  ok(!/body\.amount/.test(create), "create-payment never reads an amount from the body");
  ok(/planById\(body\.plan_id\)/.test(create), "create-payment prices from plan_id");
  ok(/not_configured/.test(create) && /not_configured/.test(hook), "both functions answer not_configured");
  ok(/tokensMatch\(/.test(hook) && /secret_token/.test(hook), "the webhook compares secret_token");
  ok(/decidePayment\(/.test(hook), "the webhook uses the shared paid/not-paid decision");
  ok(/CREATE_PAYMENT_URL/.test(client) && !/sk_/.test(client), "the browser knows the function URL and no secret");
  ok(/plan_id: planId/.test(client) && !/amount:/.test(client), "the browser posts a plan id and no amount");
  ok(/chosen\.up/.test(client), "an upgrade difference is not invoiced");

  console.log("\n— in the browser, checkout is hidden until configured, then it posts a plan id");
  const { chromium } = playwright();
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage();
  const bodies = [];
  let leftForMoyasar = false;
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
          order_id: ORDER, checkout_url: "https://checkout.moyasar.com/invoices/abc",
          amount: 1, currency: "SAR", plan_id: body.plan_id, mode: "test",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        order_id: ORDER, checkout_url: "https://checkout.moyasar.com/invoices/abc",
        amount: Math.round(bodyExpect.amt * 100), currency: "SAR",
        plan_id: body.plan_id, mode: "test",
      }),
    });
  });
  await page.route("https://checkout.moyasar.com/**", async (route) => {
    leftForMoyasar = true;
    await route.abort();
  });
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => typeof WodouhMoyasar === "object");

  const hidden = await page.evaluate(() => {
    const el = document.getElementById("moyasarSlot");
    return !!el && getComputedStyle(el).display === "none";
  });
  ok(hidden, "the account slot is hidden while CREATE_PAYMENT_URL is unset");

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
    WodouhMoyasar.mount();
    const plans = wodouhCatalogue();
    return { n: plans.length, id: plans[0].id, amt: plans[0].amt,
             ids: plans.map((p) => p.id),
             text: document.getElementById("moyasarSlot").textContent };
  });
  ok(bodyExpect.n === 6, `six sellable plans are offered (${bodyExpect.n})`);
  ok(/مجانية/.test(bodyExpect.text), "while FREE_NOW, the slot says the product is still free");
  ok(!bodyExpect.ids.includes("plan_lawyer") && !bodyExpect.ids.includes("plan_draft"),
     "unsellable plans are not offered");

  const clickPlan = () => page.evaluate(() => {
    document.querySelector("#moyasarSlot .moyasar-plans button").click();
  });
  await clickPlan();
  await page.waitForFunction(() => /لن يُخصم/.test((document.getElementById("moyasarMsg") || {}).textContent || ""));
  const off = await page.evaluate(() => document.getElementById("moyasarMsg").textContent);
  ok(/لن يُخصم/.test(off), `a 503 not_configured tells the reader nothing was charged (${off})`);
  ok(!leftForMoyasar, "a not_configured response does not navigate to Moyasar");

  await clickPlan();
  await page.waitForFunction(() => /لا يطابق/.test(document.getElementById("moyasarMsg").textContent));
  ok(!leftForMoyasar, "a server amount that disagrees with the screen is not followed");

  const opened = page.waitForRequest((r) => r.url().startsWith("https://checkout.moyasar.com/"), { timeout: 10000 });
  await clickPlan();
  const checkout = await opened;
  ok(checkout.url().startsWith("https://checkout.moyasar.com/"),
     "a matching invoice URL is opened on moyasar.com (" + checkout.url() + ")");

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
  console.log("\nMoyasar stays sandbox-ready, and the browser does not set the price");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
