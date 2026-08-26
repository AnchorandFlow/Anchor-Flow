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
//   7. System prompt whitelist — the client's system prompt is forwarded
//      unchanged only if it matches one of the app's own known feature
//      prompts (SYSTEM_PROMPT_WHITELIST below); anything else falls back to
//      FIXED_SYSTEM_PROMPT and is logged as rejected. This is what lets
//      Compass, meal generation, and the daily notifications keep their own
//      tuned prompts without this endpoint accepting truly arbitrary ones.
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

// Fixed server-side system prompt — the fallback used whenever the client's
// system prompt isn't recognized (see SYSTEM_PROMPT_WHITELIST below).
const FIXED_SYSTEM_PROMPT =
  "You are a helpful household assistant for Anchor & Flow. Help families " +
  "with planning, organization, and home management. Do not discuss " +
  "unrelated topics.";

// ── System prompt whitelist ──────────────────────────────────────────────
// Every real system prompt src/App.jsx, src/components/ExhaleSection.jsx,
// and src/compass/compassEngine.js (via src/compass/compassPrompts.js) send
// to this endpoint, extracted directly from those files (not from memory) —
// see the per-entry comments for the exact call site. A client-sent system
// prompt is forwarded to Anthropic UNCHANGED only if it matches one of
// these; anything else — including no match at all — falls back to
// FIXED_SYSTEM_PROMPT and is logged as rejected. This still can't be turned
// into a fully unconstrained proxy (every entry pins the prompt to a known
// app feature), while letting each feature's real, tuned prompt through.
//
// Two match kinds:
//   "exact"  — the whole system string must equal `value` verbatim. Used
//              wherever the real prompt has no runtime interpolation.
//   "prefix" — the system string must start with `value`. Used wherever the
//              real prompt is built by concatenating dynamic content (day
//              names, diet info, category lists, etc.) after a fixed
//              opening — `value` is that fixed opening.
// `stripDate: true` means: first strip a leading `Today is <Weekday>,
// <Month> <D>, <Year>. ` prefix IF it matches DATE_PREFIX_RE (a tight
// regex — only letters/digits/the fixed punctuation, so nothing else can be
// smuggled into that slot) before applying the prefix check. Two real
// prompts (App.jsx's proactive-insights and Compass-chat) build their
// system string as `` `Today is ${new Date().toLocaleDateString(...)}. You
// are Compass...` `` — a plain `startsWith` can never match those since the
// date changes every day, so the date portion is validated by regex first
// instead of being accepted as arbitrary prefix content.
const DATE_PREFIX_RE = /^Today is [A-Za-z]+, [A-Za-z]+ \d{1,2}, \d{4}\. /;

// Shared opening every compassPrompts.js prompt except "briefing" is built
// from (`VOICE + "\n\nTASK: ..."` — see src/compass/compassPrompts.js). One
// prefix entry below covers all five of those modes (forecast, weeklyReview,
// prep, nudge, ask) rather than five near-duplicate entries.
const COMPASS_VOICE_PREFIX = `You are Compass, the family operating assistant inside Anchor & Flow,
a household management app. Your job is to pay attention, lighten the mental load,
and help the family feel steady — never to add work or guilt.

RULES:
- Answer ONLY from the FAMILY CONTEXT provided. Never invent events, tasks, meals,
  or people. If something isn't in the context, say you don't see it.
- Use first names from the context naturally.
- Warm and specific. No corporate tone. Never say "reminder", "task list", or "as an AI".
- Keep everything brief — a busy parent reads this in 20 seconds.
- Return ONLY valid JSON matching the schema. No markdown, no backticks, no preamble.`;

const SYSTEM_PROMPT_WHITELIST = [
  // ── Compass v1 engine (src/compass/compassPrompts.js via compassEngine.js) ──
  { label: "compass-voice-modes", match: "prefix", value: COMPASS_VOICE_PREFIX },
  { label: "compass-briefing", match: "prefix", value: "You are Compass for Anchor & Flow. Your job is to NOTICE\nconnections in this family's data — not generate tasks." },

  // ── Compass AI categorization/suggestions (ExhaleSection.jsx requestCompassSuggestion) ──
  { label: "compass-task-categorize", match: "exact", value: "You are a household task assistant. Given a short task description, suggest the best matching category and person from the provided lists, ONLY if one clearly applies. Respond ONLY with JSON: {\"categoryId\":null,\"personId\":null}. Use ONLY the exact ids provided, or null." },

  // ── Compass ad-hoc prompts (App.jsx) — daily anchor / proactive insights / chat / today-suggestions ──
  { label: "compass-daily-anchor", match: "prefix", value: "You are Compass, the Anchor & Flow AI. Build a smart family daily anchor." },
  { label: "compass-proactive-insights", match: "prefix", stripDate: true, value: "You are Compass, Anchor & Flow's proactive insight engine — warm, practical, and specific like a brilliant family manager friend. Scan the family's real data and surface 3-5 things they might be missing or that deserve attention NOW." },
  { label: "compass-chat", match: "prefix", stripDate: true, value: "You are Compass, Anchor & Flow's warm home assistant. Be concise and encouraging. Use what you know about this family to personalise responses." },
  { label: "compass-today-suggestions", match: "prefix", stripDate: true, value: "You are Compass, the Anchor & Flow AI — a warm family home assistant. Suggest what to do today based on the family's real data." },
  // Dead code (App.jsx's EndOfDayReset, replaced by SunsetClose — no live
  // JSX renders it) but kept here so it isn't a silent regression if it's
  // ever revived.
  { label: "compass-eod-closing-line", match: "exact", value: "You are Compass. Write ONE warm closing sentence under 20 words. Be specific. Make them feel seen." },

  // ── Morning/evening notification text (App.jsx generateAIMessage call sites) ──
  { label: "notif-morning-greeting", match: "exact", value: `You are Compass, the Anchor & Flow AI. Write a warm good morning greeting — max 50 chars, no punctuation at end. Start with "Good morning" and optionally one warm word. Examples: "Good morning, lovely day ahead", "Good morning — let's do this".` },
  { label: "notif-dinner-reminder", match: "exact", value: "You are Compass, the Anchor & Flow AI. Write a friendly 3pm meal prep reminder (max 120 chars). Mention the specific dinner and suggest one thing to do now (defrost, start slow cooker, etc). Warm tone." },
  { label: "notif-evening-recap", match: "exact", value: "You are Compass, the Anchor & Flow AI — warm and real. Write an evening recap (max 160 chars). Acknowledge what they did, mention tomorrow briefly. Caring tone, not corporate." },
  { label: "notif-event-nudge", match: "exact", value: "You are Compass, the Anchor & Flow AI. Write a friendly heads-up notification for an upcoming appointment in 2 hours (max 120 chars). Be warm and helpful — suggest one thing to do to prepare." },

  // ── Meal name/suggestion generation (App.jsx) ──
  { label: "meal-weektype-suggest", match: "prefix", value: "You are a practical family meal planner. Suggest 7 dinners (one per day Sun–Sat) for a " },
  { label: "meal-rescue-suggest", match: "exact", value: `You are a helpful family meal assistant. Given ingredients on hand, suggest 3 simple family-friendly dinners.
Respond ONLY with a valid JSON array, no markdown, no explanation, nothing else.
Format: [{"name":"Meal Name","desc":"1-2 sentence description of how to make it"}]
Always return exactly 3 meals. Use only the ingredients provided plus assumed pantry staples (oil, salt, pepper, water).` },
  { label: "meal-prep-tips", match: "exact", value: "You are a practical family meal prep assistant. Given a week of meals and their ingredients, generate smart prep tips. Focus on: shared ingredients that can be prepped once (e.g. chop all onions Sunday), leftover opportunities (e.g. swap meals to use leftovers), batch cooking ideas, and time-saving shortcuts. Also suggest if swapping 2 meals would create a leftover chain. Respond ONLY as JSON: {\"shared\":[{\"tip\":\"string\",\"emoji\":\"string\"}],\"swaps\":[{\"tip\":\"string\",\"emoji\":\"string\"}],\"batch\":[{\"tip\":\"string\",\"emoji\":\"string\"}]}. Max 3 items per category. Keep tips under 80 chars." },

  // ── Shopping/grocery assistant (App.jsx) — not in the original feature
  // list this whitelist was requested for, but a real, currently-used
  // feature that would otherwise silently break the same way. ──
  { label: "grocery-categorize", match: "exact", value: "You are a grocery assistant. Given a list of shopping items and a list of categories, assign each item to the best category. Respond ONLY with a JSON array: [{\"id\":\"\",\"category\":\"\"}]. Use ONLY the exact category names provided. If unsure, use Other." },
  { label: "grocery-photo-recognize", match: "prefix", value: `You are a grocery list assistant. Given an image, identify the grocery item and return ONLY JSON: {"name":"","category":""}. Category must be one of: ` },
];

// Validates and (if matched) strips a leading dynamic date prefix, then
// checks the remainder against the whitelist. Returns true iff `system`
// should be forwarded to Anthropic unchanged.
function isWhitelistedSystemPrompt(system) {
  if (typeof system !== "string" || system.length === 0) return false;
  const dateMatch = DATE_PREFIX_RE.exec(system);
  const withoutDate = dateMatch ? system.slice(dateMatch[0].length) : system;
  for (const entry of SYSTEM_PROMPT_WHITELIST) {
    const candidate = entry.stripDate ? withoutDate : system;
    if (entry.match === "exact" && candidate === entry.value) return true;
    if (entry.match === "prefix" && candidate.startsWith(entry.value)) return true;
  }
  return false;
}

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

  // A whitelisted system prompt (one of the app's own known feature
  // prompts — see SYSTEM_PROMPT_WHITELIST) passes through unchanged.
  // Anything else — unrecognized text, or none at all — falls back to the
  // fixed generic prompt and is logged as rejected, same as before.
  let systemPrompt = FIXED_SYSTEM_PROMPT;
  if (typeof body.system === "string" && body.system.length > 0) {
    if (isWhitelistedSystemPrompt(body.system)) {
      systemPrompt = body.system;
    } else {
      console.warn("Claude proxy: ignoring client-supplied system prompt for user", user.id);
    }
  }

  const safeBody = {
    model: MODEL_MAP[body.model] || DEFAULT_MODEL,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP),
    messages: body.messages,
    system: systemPrompt,
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
