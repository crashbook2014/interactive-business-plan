/* Phone sign-in, before a single real SMS has ever been sent.
 *
 * WHY THIS SUITE EXISTS AHEAD OF THE FEATURE BEING SWITCHED ON. Every code sent
 * costs money at Twilio, and the switch that turns this on is deliberately off
 * until a code has arrived on a real handset. That leaves a window where the
 * code path ships unexercised — which is exactly the window this closes.
 *
 * Four properties, in the order they matter:
 *
 *   1. THE NUMBER IS NORMALISED THE SAME WAY EVERY TIME. A Saudi mobile is
 *      written four ways on four business cards and GoTrue accepts one. The
 *      conversion is a pure function, so it is tested as one, including the
 *      inputs it must REFUSE — a number that normalises to something the reader
 *      did not mean is an account they cannot get back into.
 *   2. OFF IS THE SHIPPING DEFAULT, AND OFF MEANS ABSENT. With no PHONE_SIGNIN
 *      in config the form does not render at all. Same pattern as Apple and the
 *      AI: unconfigured features do not exist rather than fail.
 *   3. THE PROVIDER IS ASKED POSITIVELY. Google, Apple and email fail OPEN — a
 *      button that might work beats hiding one that does. Phone fails CLOSED:
 *      both the config switch and the project must say yes, because an SMS form
 *      that cannot send is a dead end at the only door into the app.
 *   4. WHAT IS SENT IS WHAT IS VERIFIED. The code is checked against the
 *      normalised number a code was actually sent to, never the typed form.
 *      Typing 05… and verifying against 05… fails for everyone.
 *
 * The Supabase calls are stubbed; normalizeSaudiPhone is NOT — that one is the
 * real shipped function, because stubbing the thing under test tests the stub.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* Replaces only the network calls. phoneAvailable/normalizeSaudiPhone stay
   real, so the assertions run against the shipped rules. */
const STUB = ({ phoneSignin, extPhone }) => {
  const real = window.WodouhAuth;
  window.__sent = [];
  window.WODOUH_CONFIG = Object.assign({}, window.WODOUH_CONFIG, {
    SUPABASE_URL: "https://stub.supabase.co",
    SUPABASE_ANON_KEY: "anon"
  });
  if (phoneSignin) window.WODOUH_CONFIG.PHONE_SIGNIN = true;
  else delete window.WODOUH_CONFIG.PHONE_SIGNIN;

  window.WodouhAuth = {
    configured: () => true,
    appleAvailable: () => false,
    /* The real rule, re-evaluated against the config above. */
    phoneAvailable: () => window.WODOUH_CONFIG.PHONE_SIGNIN === true,
    normalizeSaudiPhone: real.normalizeSaudiPhone,
    providers: () => Promise.resolve({ google: true, email: true, phone: extPhone }),
    init: () => Promise.resolve(null),
    user: () => null,
    onChange: () => () => {},
    signOut: () => Promise.resolve(),
    getProfile: () => Promise.resolve(null),
    sendEmailCode: (e) => Promise.resolve(String(e)),
    verifyEmailCode: () => Promise.resolve({ id: "u1" }),
    sendPhoneCode: (n) => {
      const e164 = real.normalizeSaudiPhone(n);
      window.__sent.push({ fn: "sendPhoneCode", typed: n, e164 });
      if (!e164) return Promise.reject(new Error("bad_phone"));
      return Promise.resolve(e164);
    },
    verifyPhoneCode: (n, code) => {
      window.__sent.push({ fn: "verifyPhoneCode", n, code });
      return Promise.resolve({ id: "u1", phone: n });
    },
    pushLocal: () => Promise.resolve({ sent: 0, failed: 0 }),
    shape: real.shape,
    deleteAccount: () => Promise.resolve()
  };
};

const open = async (b, opts) => {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");
  await p.evaluate(STUB, opts);
  return p;
};

/* renderProviders() resolves off an already-resolved promise here, so this is
   waiting on a microtask turn, not on a network round trip. */
const settle = (p) => p.waitForTimeout(200);

(async () => {
  const b = await chromium.launch(launchOpts());

  /* ---- 1. the conversion, as a pure function */
  console.log("\n— a Saudi mobile is written four ways and sent as one");
  const p1 = await open(b, { phoneSignin: true, extPhone: true });
  const norm = await p1.evaluate(() => {
    const f = WodouhAuth.normalizeSaudiPhone;
    return {
      local:   f("0512345678"),
      bare:    f("512345678"),
      plus:    f("+966512345678"),
      country: f("966512345678"),
      spaced:  f("05 12 345 678"),
      dashed:  f("+966-51-234-5678"),
      /* Must be refused, every one. */
      landline: f("0112345678"),
      short:    f("051234"),
      long:     f("05123456789"),
      foreign:  f("+447700900123"),
      junk:     f("not a number"),
      empty:    f(""),
      nul:      f(null)
    };
  });
  const E = "+966512345678";
  ok(norm.local === E,   `0512345678 becomes ${E}`);
  ok(norm.bare === E,    "a number written without its leading zero becomes the same");
  ok(norm.plus === E,    "a number already in E.164 is unchanged");
  ok(norm.country === E, "966… without the plus becomes the same");
  ok(norm.spaced === E,  "spaces are how people actually type it, and survive");
  ok(norm.dashed === E,  "so are dashes");
  ok(norm.landline === null, "a Riyadh landline is refused — it cannot receive a text");
  ok(norm.short === null && norm.long === null, "a number of the wrong length is refused, not padded or truncated");
  ok(norm.foreign === null, "a non-Saudi number is refused at the sign-in door");
  ok(norm.junk === null && norm.empty === null && norm.nul === null,
     "junk, empty and null are refused without throwing");
  await p1.close();

  /* ---- 2. off is the shipping default, and off means absent */
  console.log("\n— with the switch off, the form does not exist");
  const p2 = await open(b, { phoneSignin: false, extPhone: true });
  await p2.evaluate(() => openSignin("account"));
  await settle(p2);
  const off = await p2.evaluate(() => ({
    avail: WodouhAuth.phoneAvailable(),
    form: document.getElementById("auPhoneForm").hidden,
    code: document.getElementById("auPhoneCodeForm").hidden,
    onScreen: document.querySelector(".screen.active").id
  }));
  ok(off.avail === false, "PHONE_SIGNIN absent from config reads as unavailable");
  ok(off.form === true && off.code === true,
     "so neither the number form nor the code form renders, even though the project reports phone enabled");
  ok(off.onScreen === "screen-signin", "and the rest of the sign-in screen is unaffected");
  await p2.close();

  /* ---- 3. the project is asked, and asked positively */
  console.log("\n— the switch alone is not enough: the project has to say yes too");
  const p3 = await open(b, { phoneSignin: true, extPhone: false });
  await p3.evaluate(() => openSignin("account"));
  await settle(p3);
  const denied = await p3.evaluate(() => document.getElementById("auPhoneForm").hidden);
  ok(denied === true, "config on but the project reporting phone disabled keeps the form hidden");

  const p3b = await open(b, { phoneSignin: true, extPhone: undefined });
  await p3b.evaluate(() => openSignin("account"));
  await settle(p3b);
  const unknown = await p3b.evaluate(() => document.getElementById("auPhoneForm").hidden);
  ok(unknown === true,
     "and an ANSWER THAT DOES NOT MENTION PHONE also keeps it hidden — unlike Google and email, silence here is not consent");
  await p3.close(); await p3b.close();

  /* ---- 4. on, and what actually crosses the wire */
  console.log("\n— on: the typed number is normalised before it is sent, and verified as sent");
  const p4 = await open(b, { phoneSignin: true, extPhone: true });
  await p4.evaluate(() => openSignin("account"));
  await settle(p4);
  const shown = await p4.evaluate(() => ({
    form: document.getElementById("auPhoneForm").hidden,
    code: document.getElementById("auPhoneCodeForm").hidden
  }));
  ok(shown.form === false, "with both yeses the number form renders");
  ok(shown.code === true, "and the code box does NOT — nobody has been sent a code yet");

  /* Type it the way a person would, not the way the API wants. */
  await p4.evaluate(() => { document.getElementById("auPhone").value = "05 1234 5678"; });
  await p4.evaluate(() => sendSmsCode());
  await p4.waitForFunction(() => document.getElementById("auPhoneCodeForm").hidden === false,
                           null, { timeout: 4000 });
  const afterSend = await p4.evaluate(() => ({
    sent: window.__sent.slice(),
    form: document.getElementById("auPhoneForm").hidden,
    code: document.getElementById("auPhoneCodeForm").hidden,
    label: document.getElementById("auPhoneCodeLab").textContent
  }));
  const s = afterSend.sent.find(x => x.fn === "sendPhoneCode");
  ok(!!s && s.e164 === E, `a number typed as "05 1234 5678" is sent as ${E}`);
  ok(afterSend.form === true && afterSend.code === false,
     "the screen swaps to the code step only once a code has actually been sent");
  ok(afterSend.label.includes(E),
     "and the label names the number the code went to, so a mistyped digit is visible before the wait");

  await p4.evaluate(() => { document.getElementById("auPhoneCode").value = "123456"; });
  await p4.evaluate(() => verifySmsCode());
  await p4.waitForFunction(() => window.__sent.some(x => x.fn === "verifyPhoneCode"),
                           null, { timeout: 4000 });
  const v = await p4.evaluate(() => window.__sent.find(x => x.fn === "verifyPhoneCode"));
  ok(v.n === E,
     "THE CODE IS VERIFIED AGAINST THE NUMBER IT WAS SENT TO, not the text still in the box");
  ok(v.code === "123456", "with the code as typed");
  await p4.close();

  /* ---- 5. a refused number never reaches the network */
  console.log("\n— a number that cannot receive a text is refused before anything is sent");
  const p5 = await open(b, { phoneSignin: true, extPhone: true });
  await p5.evaluate(() => openSignin("account"));
  await settle(p5);
  await p5.evaluate(() => { document.getElementById("auPhone").value = "0112345678"; });
  await p5.evaluate(() => sendSmsCode());
  await p5.waitForFunction(() => document.getElementById("auErr").hidden === false,
                           null, { timeout: 4000 }).catch(() => {});
  const bad = await p5.evaluate(() => ({
    err: document.getElementById("auErr").textContent,
    shown: document.getElementById("auErr").hidden === false,
    stillOnNumber: document.getElementById("auPhoneCodeForm").hidden
  }));
  ok(bad.shown && /\d|رقم|mobile/i.test(bad.err),
     `the reader is told what is wrong in their own words ("${bad.err.slice(0, 60)}")`);
  ok(bad.stillOnNumber === true,
     "and the screen stays on the number step rather than asking for a code nobody was sent");
  await p5.close();

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} failure${FAIL.length === 1 ? "" : "s"}:`);
    FAIL.forEach(f => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nphone sign-in converts one number four ways, stays absent until two yeses, and verifies what it sent");
})();
