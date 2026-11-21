// supabase/functions/google-calendar/index.ts — keeps Google Calendar
// connected without hourly re-consent.
//
// The browser gets a one-time authorization code from Google (GIS code client,
// popup mode) and posts it here. This function exchanges it for tokens with
// the client secret, keeps the REFRESH token server-side only (encrypted, in
// public.google_calendar_tokens, RLS on with no browser access), and hands the
// browser short-lived ACCESS tokens on request. Scopes stay read-only.
//
// POST { action: "exchange", code }   → { access_token, expires_in, account }
// POST { action: "token" }            → { access_token, expires_in, account } | 401 { error: "reconnect" }
// POST { action: "status" }           → { connected, account }
// POST { action: "disconnect" }       → { ok: true }  (revoked with Google, row deleted)
//
// Secrets: GOOGLE_CLIENT_SECRET (set by the owner), GCAL_TOKEN_KEY (base64,
// 32 bytes, for AES-GCM). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are built in.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = "1071398827259-kt8fuuclq8riohieaeu4r58sk93484u9.apps.googleusercontent.com";
const ALLOWED_SCOPES = new Set([
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
]);
const ORIGINS = new Set(["https://www.anchorandflowapp.com", "https://anchorandflowapp.com", "http://localhost:5173", "http://localhost:4173"]);

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ORIGINS.has(origin) ? origin : "https://www.anchorandflowapp.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

// ── AES-GCM for the stored refresh token ─────────────────────────────────────
function b64(bytes: Uint8Array) { let s = ""; bytes.forEach((b) => s += String.fromCharCode(b)); return btoa(s); }
function unb64(s: string) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
let keyPromise: Promise<CryptoKey> | null = null;
function key() {
  if (!keyPromise) {
    const raw = Deno.env.get("GCAL_TOKEN_KEY");
    if (!raw) throw new Error("not_configured");
    keyPromise = crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  return keyPromise;
}
async function seal(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(text)));
  return b64(iv) + "." + b64(ct);
}
async function open(sealed: string) {
  const [iv, ct] = sealed.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ct));
  return new TextDecoder().decode(pt);
}

// ── Google ───────────────────────────────────────────────────────────────────
function secret() {
  const s = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!s) throw new Error("not_configured");
  return s;
}
async function googleToken(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: secret(), ...params }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function revoke(token: string) {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  } catch { /* best effort */ }
}
async function primaryAccount(accessToken: string) {
  try {
    const r = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=owner&maxResults=50", { headers: { Authorization: "Bearer " + accessToken } });
    const d = await r.json();
    const p = (d.items || []).find((c: { primary?: boolean }) => c.primary);
    return p ? String(p.id) : "";
  } catch { return ""; }
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method" }, 405, origin);

  // The caller must be a signed-in Anchor & Flow user; everything is scoped to them.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const user = userData && userData.user;
  if (!user) return json({ error: "unauthenticated" }, 401, origin);

  let body: { action?: string; code?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  try {
    if (body.action === "exchange") {
      if (!body.code) return json({ error: "missing_code" }, 400, origin);
      // GIS popup code flow: the redirect URI is the literal "postmessage".
      const t = await googleToken({ code: body.code, grant_type: "authorization_code", redirect_uri: "postmessage" });
      if (t.status !== 200 || !t.body.access_token) return json({ error: "exchange_failed", detail: t.body.error || null }, 400, origin);
      const granted = String(t.body.scope || "").split(/\s+/).filter(Boolean);
      if (granted.some((s) => !ALLOWED_SCOPES.has(s) && s !== "openid" && !s.endsWith("userinfo.email"))) {
        await revoke(t.body.access_token);
        return json({ error: "unexpected_scope" }, 400, origin);
      }
      if (!t.body.refresh_token) {
        // Google only issues a refresh token on a fresh consent: drop this grant so
        // the next Connect shows consent again and returns one.
        await revoke(t.body.access_token);
        return json({ error: "no_refresh_token" }, 409, origin);
      }
      const account = await primaryAccount(t.body.access_token);
      const old = await admin.from("google_calendar_tokens").select("refresh_token_enc").eq("user_id", user.id).maybeSingle();
      if (old.data && old.data.refresh_token_enc) { try { await revoke(await open(old.data.refresh_token_enc)); } catch { /* old key */ } }
      const up = await admin.from("google_calendar_tokens").upsert({
        user_id: user.id, account_email: account, refresh_token_enc: await seal(t.body.refresh_token),
        scope: granted.join(" "), updated_at: new Date().toISOString(),
      });
      if (up.error) return json({ error: "store_failed" }, 500, origin);
      return json({ access_token: t.body.access_token, expires_in: t.body.expires_in || 3600, account }, 200, origin);
    }

    const row = await admin.from("google_calendar_tokens").select("refresh_token_enc, account_email").eq("user_id", user.id).maybeSingle();
    const rec = row.data;

    if (body.action === "status") return json({ connected: !!rec, account: rec ? rec.account_email || "" : "" }, 200, origin);

    if (body.action === "token") {
      if (!rec) return json({ error: "reconnect" }, 401, origin);
      const t = await googleToken({ grant_type: "refresh_token", refresh_token: await open(rec.refresh_token_enc) });
      if (t.status !== 200 || !t.body.access_token) {
        if (t.body.error === "invalid_grant") { // revoked in Google, expired, or password change
          await admin.from("google_calendar_tokens").delete().eq("user_id", user.id);
          return json({ error: "reconnect" }, 401, origin);
        }
        return json({ error: "refresh_failed" }, 502, origin);
      }
      return json({ access_token: t.body.access_token, expires_in: t.body.expires_in || 3600, account: rec.account_email || "" }, 200, origin);
    }

    if (body.action === "disconnect") {
      if (rec) {
        try { await revoke(await open(rec.refresh_token_enc)); } catch { /* still delete */ }
        await admin.from("google_calendar_tokens").delete().eq("user_id", user.id);
      }
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "unknown_action" }, 400, origin);
  } catch (e) {
    if (e instanceof Error && e.message === "not_configured") return json({ error: "not_configured" }, 503, origin);
    return json({ error: "server_error" }, 500, origin);
  }
});
