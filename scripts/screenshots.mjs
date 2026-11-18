// Visual verification pass: signs in through the real OTP form (codes read from
// local Mailpit) and screenshots every screen at 390px and 1280px.
// Usage: supabase db reset && npm run dev, then: node scripts/screenshots.mjs
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAIL = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const rest = (path) =>
  fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }).then((r) => r.json());

const id = (k, n) => `00000000-0000-4000-${k}-${String(n).padStart(12, "0")}`;
const VIEWPORTS = [
  { w: 390, h: 844, mobile: true },
  { w: 1280, h: 860, mobile: false },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function otpFor(email, after) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((r) => r.json());
    const msg = res.messages?.find((m) => new Date(m.Created).getTime() >= after - 2000);
    if (msg) {
      const full = await fetch(`${MAIL}/api/v1/message/${msg.ID}`).then((r) => r.json());
      return full.Text.match(/\b(\d{6})\b/)[1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no OTP for ${email}`);
}

/** Signs in via the UI and returns storage state. Optionally screenshots the OTP step. */
async function login(email, shotOtp) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  const t0 = Date.now();
  await page.click("text=Send me a code");
  await page.waitForSelector("#code");
  const code = await otpFor(email, t0);
  if (shotOtp) {
    await page.keyboard.type(code.slice(0, 3));
    await shoot(page, "03-otp", 390);
  }
  await page.fill("#code", code);
  await page.click("text=Verify and continue");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function shoot(page, name, w) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900); // let the one-time route draw finish
  await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
  console.log("shot", name, w);
}

async function visit(state, shots) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 2, storageState: state });
    const page = await ctx.newPage();
    for (const [name, path, before] of shots) {
      await page.goto(`${BASE}${path}`);
      if (before) await before(page);
      await shoot(page, name, vp.w);
    }
    await ctx.close();
  }
}

const [t1] = await rest(`trips?id=eq.${id("9000", 1)}&select=share_token`);
const [t11] = await rest(`trips?id=eq.${id("9000", 11)}&select=share_token`);

// Logged out
await visit(undefined, [
  ["01-landing", "/"],
  ["02-signin", "/login"],
  ["09-share-logged-out", `/s/${t1.share_token}`],
  ["09-share-women-only-hidden", `/s/${t11.share_token}`],
  ["09-share-unavailable", "/s/00000000-0000-4000-8000-000000000000"],
]);

// Unknown domain -> request your college
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "someone@unlisted-college.ac.in");
  await page.click("text=Send me a code");
  await page.waitForSelector("#code");
  await shoot(page, "03-provisional-college", 390);
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "someone@gmail.com");
  await page.click("text=Send me a code");
  await page.waitForSelector("[role=alert]");
  await shoot(page, "03-webmail-refused", 390);
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "student.12345678@lpu.in");
  await page.click("text=Send me a code");
  await page.waitForSelector("#code");
  await shoot(page, "03-lpu-detected", 390);
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "not-an-email");
  await page.click("text=Send me a code");
  await page.waitForSelector("[role=alert]");
  await shoot(page, "03-email-error", 390);
  await ctx.close();
}

const aarav = await login("aarav@example.edu", true);
await visit(aarav, [
  ["04-discover", "/"],
  ["05-my-trips", "/trips"],
  ["06-matches", `/trips/${id("9000", 1)}`],
  ["07-post", "/post"],
  ["08-inbox-requests", "/inbox?tab=incoming"],
  ["08-inbox-chats", "/inbox?tab=chats"],
  ["10-chat-accepted", `/inbox/${id("a000", 1)}`],
  ["10-chat-pending", `/inbox/${id("a000", 3)}`],
  ["11-profile", "/profile"],
  ["09-share-same-college", `/s/${t1.share_token}`],
  ["07-post-errors", "/post", async (p) => {
    await p.fill("#date", "2020-01-01");
    await p.fill("#start", "20:00");
    await p.fill("#end", "18:00");
    await p.click("button:has-text('Post trip')");
    await p.waitForSelector("[role=alert]");
  }],
]);

// Post a trip through the form -> success moment
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, storageState: aarav });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/post`);
  await page.selectOption("#toHub", "Demo Airport");
  await page.click("text=Flight");
  await page.click("button:has-text('Post trip')");
  await page.waitForURL(/posted=1/);
  await shoot(page, "07-post-success", 1280);
  await ctx.close();
}

const kabir = await login("kabir@example.edu");
await visit(kabir, [
  ["06-matches-empty", `/trips/${id("9000", 20)}`],
  ["08-inbox-sent", "/inbox?tab=outgoing"],
  ["11-profile-travelled", "/profile"],
]);

const ananya = await login("ananya@example.edu");
await visit(ananya, [
  ["06-matches-women-only", `/trips/${id("9000", 11)}`],
  ["07-post-women-only", "/post"],
]);

// Provisional student: finishes sign-in and sees the "verifying your college" banner.
const provisional = await login("someone@unlisted-college.ac.in");
await visit(provisional, [["04-discover-provisional", "/"]]);

const kavya = await login("kavya@example.edu");
await visit(kavya, [["12-admin", "/admin"]]);

await browser.close();
