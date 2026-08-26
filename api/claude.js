// /api/claude.js
// Hardened Anthropic proxy for Anchor & Flow.
//
// What changed vs. the old version:
//   1. Requires a valid Supabase JWT (Authorization: Bearer <token>)
//   2. Server-side model whitelist — client's model string is mapped, never trusted
//   3. max_tokens capped server-side
//   4. Request body size capped (blocks giant base64 abuse beyond grocery photos)
//   5. Best-effort per-HOUSEHOLD rate limit (in-memory; resets on cold start).
//      Keyed by householdId rather than the Supabase user id so multiple
//      people in the same household share one cap instead of each getting
//      their own — resolved via the same households/household_members
//      lookup api/stripe/entitlement.js uses (owner_id first, then
//      household_members), since the JWT itself only carries the user id,
//      not household_id. Falls back to the user id if no household row is
//      found yet (e.g. mid-onboarding, before a household exists) so the
//      limiter never silently no-ops instead of degrading to per-user.
//   6. Body is rebuilt from allowed fields only — never forwarded verbatim
//
// Env vars required (Vercel → Project Settings → Environment Variables):
//   ANTHROPIC_API_KEY     (already set)
//   SUPABASE_URL          e.g. https://sbgbyptkunvyxjfpzght.supabase.co
//   SUPABASE_ANON_KEY     the same anon key the client uses
//   SUPABASE_SERVICE_KEY  server-only service-role key (same var name the
//                         api/stripe/*.js endpoints already use) — needed to
//                         read households/household_members regardless of RLS
//
// CLIENT CHANGE REQUIRED: every fetch("/api/claude") must now send
//   headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken }
// where accessToken is the user's Supabase session token (the same one
// you already attach to Supabase REST calls). See askClaude() helper note.

// Fixed server-side system prompt. Any system prompt the client sends is
// ignored (and logged) so this endpoint can't be turned into an
// unconstrained proxy for the Anthropic key by supplying an arbitrary
// system prompt from the browser.
const FIXED_SYSTEM_PROMPT =
  "You are a helpful household assistant for Anchor & Flow. Help families " +
  "with planning, organization, and home management. Do not discuss " +
  "unrelated topics.";

const MODEL_MAP = {
  // client-requested model -> actual model we run
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "haiku": "claude-haiku-4-5",
  "sonnet": "claude-sonnet-4-6",
};
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_CAP = 1500;
const MAX_BODY_BYTES = 6 * 1024 * 1024; // allows one grocery photo (base64), blocks bulk abuse
const RATE_LIMIT = 20;                  // requests per household
const RATE_WINDOW_MS = 60 * 60 * 1000;  // per hour

// In-memory rate limiter. Per-instance only (serverless), so it's
// best-effort — but it stops casual abuse and runaway client loops. Keyed by
// householdId (see resolveHouseholdId below), falling back to the Supabase
// user id when no household has been resolved yet.
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const entry = hits.get(key) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count++;
  hits.set(key, entry);
  if (hits.size > 5000) hits.clear(); // memory guard
  return entry.count > RATE_LIMIT;
}

async function verifySupabaseToken(token) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null; // misconfig — treated as auth failure
  try {
    const r = await fetch(url + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: anonKey },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

// Resolves a Supabase user id to their household id, same lookup order as
// api/stripe/entitlement.js's resolveHouseholdId: owned household first
// (households.owner_id), then membership (household_members.user_id). Uses
// the service-role key via plain REST calls (not the @supabase/supabase-js
// client the stripe endpoints use) to keep this file dependency-free, same
// as its existing verifySupabaseToken. Returns null on any misconfig,
// lookup failure, or "no household yet" — callers fall back to the user id.
async function resolveHouseholdId(userId) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };
  try {
    const ownedR = await fetch(
      url + "/rest/v1/households?owner_id=eq." + encodeURIComponent(userId) + "&select=id&limit=1",
      { headers }
    );
    if (ownedR.ok) {
      const owned = await ownedR.json();
      if (Array.isArray(owned) && owned.length) return owned[0].id;
    }
    const memR = await fetch(
      url + "/rest/v1/household_members?user_id=eq." + encodeURIComponent(userId) + "&select=household_id&limit=1",
      { headers }
    );
    if (memR.ok) {
      const mem = await memR.json();
      if (Array.isArray(mem) && mem.length) return mem[0].household_id;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  // ── 1. Auth ────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Sign in required" });
  }
  const user = await verifySupabaseToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  // ── 2. Rate limit — per household, not per user ────────────────────────
  const householdId = await resolveHouseholdId(user.id);
  const rateLimitKey = householdId || user.id;
  if (rateLimited(rateLimitKey)) {
    return res.status(429).json({ error: "This household has reached its AI request limit for the hour — try again a little later." });
  }

  // ── 3. Validate + rebuild body (never forward verbatim) ───────────────
  const body = req.body || {};
  const approxSize = JSON.stringify(body).length;
  if (approxSize > MAX_BODY_BYTES) {
    return res.status(413).json({ error: "Request too large" });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: "messages required" });
  }

  if (typeof body.system === "string" && body.system.length > 0) {
    console.warn("Claude proxy: ignoring client-supplied system prompt for user", user.id);
  }

  const safeBody = {
    model: MODEL_MAP[body.model] || DEFAULT_MODEL,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP),
    messages: body.messages,
    system: FIXED_SYSTEM_PROMPT,
  };

  // ── 4. Forward ────────────────────────────────────────────────────────
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(safeBody),
    });

    const data = await response.json();
    if (!response.ok) {
      // Don't leak Anthropic error internals to the browser
      console.error("Anthropic error", response.status, data && data.error && data.error.type);
      return res.status(response.status).json({ error: "AI request failed" });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    return res.status(500).json({ error: "Proxy request failed" });
  }
}
