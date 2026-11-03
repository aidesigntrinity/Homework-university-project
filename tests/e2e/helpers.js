// Shared helpers for the browser tests. Needs Playwright (PLAYWRIGHT env var can point at its folder).
const path = require("path"), fs = require("fs"), { spawn } = require("child_process");
const PW = process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright";
const { chromium } = require(PW);
const HTTP_SERVER = process.env.HTTP_SERVER || "/opt/node22/lib/node_modules/http-server/bin/http-server";

// Copies the site to a temp folder with a test config (accounts pointing at the local fake, or switched off).
function makeSite(dir, config) {
  const src = path.join(__dirname, "../../docs");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(src, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "config.js"), "window.DUEBOARD_NO_SW = true;\nwindow.DUEBOARD_CONFIG = " + JSON.stringify(config || {}) + ";\n");
  return dir;
}
async function serve(dir, port) {
  const srv = spawn("node", [HTTP_SERVER, dir, "-p", String(port), "-c-1", "--silent"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 900));
  return srv;
}
function harness(browser) {
  const errors = [];
  let n = 0;
  const ok = (m) => console.log("ok " + ++n + " - " + m);
  async function page(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 860 }, serviceWorkers: "block", acceptDownloads: true }, opts || {}));
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|WebSocket|realtime/i.test(m.text())) errors.push("console: " + m.text()); });
    return { ctx, p };
  }
  return { errors, ok, page };
}
// Waits for a condition; on timeout, says what was on screen.
// A check that throws (say, an element that isn't there yet) counts as "not yet" rather than failing at once.
async function until(p, fn, arg, ms) {
  const safe = "(() => { try { return (" + fn.toString() + ")(" + JSON.stringify(arg === undefined ? null : arg) + "); } catch (e) { return false; } })()";
  try { return await p.waitForFunction(safe, null, { timeout: ms || 8000, polling: 100 }); }
  catch (e) {
    const seen = await p.evaluate(() => { const n = document.querySelector("dialog[open]") || document.querySelector("main") || document.body; return location.hash + " | " + n.innerText.replace(/\s+/g, " ").slice(0, 600); }).catch(() => "?");
    throw new Error((/Timeout/.test(e.message) ? "Timed out waiting for " : "Failed (" + e.message.split("\n")[0] + ") waiting for ") + String(fn).slice(0, 160) + "\nOn screen: " + seen);
  }
}
const text = async (p, sel) => ((await p.textContent(sel)) || "").replace(/\s+/g, " ").trim();
const ymd = (ms) => { const x = new Date(ms); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
async function addTask(p, o) {
  await p.keyboard.press("n");
  await p.waitForSelector("#e-title");
  await p.fill("#e-title", o.title);
  if (o.subject) await p.fill("#e-subject", o.subject);
  if (o.date) await p.fill("#e-date", o.date);
  if (o.time) await p.fill("#e-time", o.time);
  if (o.priority) await p.click(`#editor .seg button:has-text("${o.priority}")`);
  if (o.est) await p.fill("#e-est", String(o.est));
  for (const s of o.steps || []) { await p.fill("#e-sub-add", s); await p.press("#e-sub-add", "Enter"); }
  if (o.recur) { await p.click("#editor summary"); await p.selectOption("#e-recur", o.recur); }
  await p.click("#e-save");
  await p.waitForSelector("#editor", { state: "detached" });
}
async function dismissToasts(p) { await p.evaluate(() => document.querySelectorAll(".toast").forEach((t) => t.remove())); }
const rowOf = (title) => `.task:has(.t-title:text-is("${title}"))`;
module.exports = { chromium, makeSite, serve, harness, until, text, ymd, addTask, dismissToasts, rowOf };
