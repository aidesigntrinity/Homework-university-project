// A local stand-in for the parts of Supabase that Due Board uses (Auth + PostgREST), for tests only.
// Data calls run the project's real SQL (RLS policies, push_items, delete_my_account) on a local Postgres,
// as the "authenticated" role with the caller's JWT claims, the way PostgREST does.
const http = require("http"), crypto = require("crypto"), { Pool } = require("pg");
const PORT = +process.env.PORT || 54321, SECRET = "test-secret-test-secret-test-secret-123";
const AUTOCONFIRM = process.env.AUTOCONFIRM === "1";
const pool = new Pool({ host: "127.0.0.1", port: 54329, user: "postgres", database: "dueboard" });
const outbox = [];   // emails "sent"
let failNext = 0;    // test hook: make the next N data requests fail with a 500

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600, session_id: crypto.randomUUID() });
  return body + "." + crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}
function verify(token) {
  const p = (token || "").split(".");
  if (p.length !== 3) return null;
  const sig = crypto.createHmac("sha256", SECRET).update(p[0] + "." + p[1]).digest("base64url");
  if (sig !== p[2]) return null;
  const claims = JSON.parse(Buffer.from(p[1], "base64url").toString());
  return claims.exp * 1000 > Date.now() ? claims : null;
}
const hashPw = (pw) => crypto.createHash("sha256").update("salt:" + pw).digest("hex");
const refresh = {};   // refresh token -> user id
function userJson(u) {
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.email_confirmed_at, confirmed_at: u.email_confirmed_at,
    user_metadata: u.raw_user_meta_data || {}, app_metadata: { provider: "email", providers: ["email"] }, identities: [{ id: u.id, provider: "email" }], created_at: u.created_at, updated_at: u.updated_at };
}
function session(u) {
  const rt = crypto.randomBytes(16).toString("hex"); refresh[rt] = u.id;
  return { access_token: jwt(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: rt, user: userJson(u) };
}
async function userBy(where, v) { const r = await pool.query("select * from auth.users where " + where + " = $1", [v]); return r.rows[0] || null; }
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" }, cors(), headers || {}));
  res.end(body === undefined ? "" : JSON.stringify(body));
}
function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, accept-profile, content-profile, range, x-retry-count", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "Access-Control-Expose-Headers": "content-range, x-supabase-api-version", "Access-Control-Max-Age": process.env.CORS_MAX_AGE || "5" }; }
const authErr = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg, message: msg });
function mail(type, email, token, redirect) {
  const link = "http://localhost:" + PORT + "/auth/v1/verify?token=" + token + "&type=" + type + "&redirect_to=" + encodeURIComponent(redirect || "");
  outbox.push({ type, email, link, at: Date.now() });
}
async function asUser(claims, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await c.query("set local role authenticated");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}

async function handle(req, res, body) {
  const url = new URL(req.url, "http://x"), path = url.pathname;
  if (req.method === "OPTIONS") { res.writeHead(204, cors()); return res.end(); }
  // ---- test hooks ----
  if (path === "/__test/outbox") return send(res, 200, outbox);
  if (path === "/__test/fail") { failNext = url.searchParams.has("n") ? +url.searchParams.get("n") : 1; return send(res, 200, { ok: 1 }); }
  if (path === "/__test/reset") { outbox.length = 0; await pool.query("truncate public.items; delete from auth.users"); return send(res, 200, { ok: 1 }); }
  if (path === "/__test/items") { const r = await pool.query("select i.kind, i.id, i.data, i.mod, u.email from public.items i join auth.users u on u.id = i.user_id order by i.updated_at"); return send(res, 200, r.rows); }
  if (path === "/__test/sql" && req.method === "POST") { const r = await pool.query(body.sql, body.params || []); return send(res, 200, r.rows); }
  // ---- auth ----
  if (path === "/auth/v1/settings") return send(res, 200, { external: { email: true, google: false }, disable_signup: false, mailer_autoconfirm: AUTOCONFIRM });
  if (path === "/auth/v1/signup" && req.method === "POST") {
    const email = String(body.email || "").toLowerCase(), pw = String(body.password || "");
    if (pw.length < 8) return authErr(res, 422, "weak_password", "Password should be at least 8 characters.");
    const ex = await userBy("email", email);
    if (ex && ex.email_confirmed_at) return send(res, 200, Object.assign(userJson(ex), { identities: [] }));   // no account enumeration
    const name = (body.data && body.data.name) || "", token = crypto.randomBytes(12).toString("hex");
    const u = ex || (await pool.query("insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at, confirmation_token) values ($1,$2,$3,$4,$5) returning *",
      [email, hashPw(pw), { name }, AUTOCONFIRM ? new Date() : null, token])).rows[0];
    if (AUTOCONFIRM) return send(res, 200, session(u));
    if (ex) await pool.query("update auth.users set confirmation_token = $2 where id = $1", [u.id, token]);
    mail("signup", email, token, url.searchParams.get("redirect_to"));
    return send(res, 200, userJson(u));
  }
  if (path === "/auth/v1/token" && req.method === "POST") {
    const gt = url.searchParams.get("grant_type");
    if (gt === "password") {
      const u = await userBy("email", String(body.email || "").toLowerCase());
      if (!u || u.encrypted_password !== hashPw(String(body.password || ""))) return authErr(res, 400, "invalid_credentials", "Invalid login credentials");
      if (!u.email_confirmed_at) return authErr(res, 400, "email_not_confirmed", "Email not confirmed");
      return send(res, 200, session(u));
    }
    if (gt === "refresh_token") {
      const id = refresh[body.refresh_token]; if (!id) return authErr(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      const u = await userBy("id", id); if (!u) return authErr(res, 400, "user_not_found", "User not found");
      return send(res, 200, session(u));
    }
    return authErr(res, 400, "unsupported_grant_type", "unsupported");
  }
  if (path === "/auth/v1/verify" && req.method === "GET") {
    const token = url.searchParams.get("token"), type = url.searchParams.get("type"), to = url.searchParams.get("redirect_to") || "/";
    const col = type === "recovery" ? "recovery_token" : "confirmation_token";
    const u = await userBy(col, token);
    if (!u) { res.writeHead(303, { Location: to + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired" }); return res.end(); }
    await pool.query("update auth.users set " + col + " = null, email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1", [u.id]);
    const s = session(await userBy("id", u.id));
    res.writeHead(303, { Location: to + "#access_token=" + s.access_token + "&expires_at=" + s.expires_at + "&expires_in=3600&refresh_token=" + s.refresh_token + "&token_type=bearer&type=" + type });
    return res.end();
  }
  if (path === "/auth/v1/recover" && req.method === "POST") {
    const u = await userBy("email", String(body.email || "").toLowerCase());
    if (u) { const t = crypto.randomBytes(12).toString("hex"); await pool.query("update auth.users set recovery_token = $2 where id = $1", [u.id, t]); mail("recovery", u.email, t, url.searchParams.get("redirect_to")); }
    return send(res, 200, {});
  }
  if (path === "/auth/v1/otp" && req.method === "POST") {
    const u = await userBy("email", String(body.email || "").toLowerCase());
    if (!u) return authErr(res, 422, "otp_disabled", "Signups not allowed for otp");
    const t = crypto.randomBytes(12).toString("hex"); await pool.query("update auth.users set confirmation_token = $2 where id = $1", [u.id, t]);
    mail("magiclink", u.email, t, url.searchParams.get("redirect_to")); return send(res, 200, {});
  }
  if (path === "/auth/v1/resend" && req.method === "POST") {
    const u = await userBy("email", String(body.email || "").toLowerCase());
    if (u && !u.email_confirmed_at) { const t = crypto.randomBytes(12).toString("hex"); await pool.query("update auth.users set confirmation_token = $2 where id = $1", [u.id, t]); mail("signup", u.email, t, url.searchParams.get("redirect_to")); }
    return send(res, 200, {});
  }
  const claims = verify(((req.headers.authorization || "").match(/^Bearer (.+)$/) || [])[1]);
  if (path === "/auth/v1/user") {
    if (!claims) return authErr(res, 401, "bad_jwt", "invalid JWT");
    let u = await userBy("id", claims.sub);
    if (!u) return authErr(res, 404, "user_not_found", "User not found");
    if (req.method === "PUT") {
      if (body.password) { if (body.password.length < 8) return authErr(res, 422, "weak_password", "Password should be at least 8 characters."); if (hashPw(body.password) === u.encrypted_password) return authErr(res, 422, "same_password", "New password should be different from the old password."); await pool.query("update auth.users set encrypted_password = $2 where id = $1", [u.id, hashPw(body.password)]); }
      if (body.data) await pool.query("update auth.users set raw_user_meta_data = raw_user_meta_data || $2 where id = $1", [u.id, body.data]);
      if (body.email) { const t = crypto.randomBytes(12).toString("hex"); await pool.query("update auth.users set email_change = $2, email_change_token = $3 where id = $1", [u.id, body.email, t]); mail("email_change", body.email, t, url.searchParams.get("redirect_to")); }
      u = await userBy("id", claims.sub);
    }
    return send(res, 200, userJson(u));
  }
  if (path === "/auth/v1/logout") return send(res, 204);
  // ---- data (PostgREST-style) ----
  if (path.indexOf("/rest/v1/") === 0) {
    if (failNext > 0) { failNext--; return send(res, 500, { code: "XX000", message: "test failure" }); }
    if (!claims) return send(res, 401, { code: "PGRST301", message: "JWT expired" });
    try {
      if (path === "/rest/v1/items" && req.method === "GET") {
        const gt = (url.searchParams.get("updated_at") || "gt.1970-01-01T00:00:00Z").replace(/^gt\./, "");
        const limit = Math.min(1000, +url.searchParams.get("limit") || 1000);
        const rows = await asUser(claims, (c) => c.query("select kind, id, data, mod, updated_at from public.items where updated_at > $1 order by updated_at asc limit $2", [gt, limit]));
        return send(res, 200, rows.rows.map((r) => Object.assign(r, { mod: Number(r.mod), updated_at: r.updated_at.toISOString() })));
      }
      if (path === "/rest/v1/rpc/push_items") {
        const rows = await asUser(claims, (c) => c.query("select * from public.push_items($1::jsonb)", [JSON.stringify(body.items)]));
        return send(res, 200, rows.rows.map((r) => ({ user_id: r.user_id, kind: r.kind, id: r.id, data: r.data, mod: Number(r.mod), updated_at: r.updated_at.toISOString() })));
      }
      if (path === "/rest/v1/rpc/delete_my_account") { await asUser(claims, (c) => c.query("select public.delete_my_account()")); return send(res, 204); }
    } catch (e) { return send(res, 400, { code: e.code, message: e.message }); }
    return send(res, 404, { message: "not found" });
  }
  send(res, 404, { message: "not found" });
}
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => { raw += d; });
  const t0 = Date.now();
  if (process.env.LOG) res.on("finish", () => console.log(res.statusCode, req.method, req.url.slice(0, 70), Date.now() - t0 + "ms"));
  req.on("end", () => { let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { body = {}; } if (process.env.LOG) console.log("<-", req.method, req.url.slice(0, 70)); handle(req, res, body).catch((e) => { console.error(e); send(res, 500, { message: String(e.message) }); }); });
});
// No Realtime here: refuse websocket upgrades outright so failed attempts don't hold browser connections open.
server.on("upgrade", (req, socket) => { socket.end("HTTP/1.1 501 Not Implemented\r\nConnection: close\r\n\r\n"); socket.destroy(); });
server.listen(PORT, () => console.log("fake supabase on " + PORT));
