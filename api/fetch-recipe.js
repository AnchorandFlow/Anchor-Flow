// /api/fetch-recipe.js
// Server-side fetch + parse for the Recipes tab's "Import from URL" feature.
// Fetches the target page here (avoids CORS, keeps the target URL off the
// client) and extracts recipe data in order of preference: JSON-LD
// schema.org/Recipe, OpenGraph meta tags, then a bare <title> guess.
//
// This endpoint makes the server fetch an arbitrary user-supplied URL, so —
// same as api/claude.js — it requires a valid Supabase session and is rate
// limited, plus it rejects local/private-network targets (SSRF guard).
//
// Env vars required (already set for api/claude.js):
//   SUPABASE_URL, SUPABASE_ANON_KEY

const MAX_BODY_BYTES = 2 * 1024 * 1024; // stop reading a page past ~2MB
const FETCH_TIMEOUT_MS = 8000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const hits = new Map();
function rateLimited(userId) {
  const now = Date.now();
  const entry = hits.get(userId) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count++;
  hits.set(userId, entry);
  if (hits.size > 5000) hits.clear(); // memory guard
  return entry.count > RATE_LIMIT;
}

async function verifySupabaseToken(token) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
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

// ── SSRF guard ──────────────────────────────────────────────────────────────
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);
function isPrivateHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".local")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}
function safeTargetUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isPrivateHost(u.hostname)) return null;
  return u;
}

// ── HTML parsing (regex-based — no HTML parser dependency available at
// serverless runtime; jsdom is a devDependency only, not safe to rely on
// being installed in production) ────────────────────────────────────────────
function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function findRecipeNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const type = node["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return node;
  if (node["@graph"]) return findRecipeNode(node["@graph"]);
  return null;
}

function extractJsonLdRecipe(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const raw = match[1].trim();
    if (!raw) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const found = findRecipeNode(parsed);
    if (found) return found;
  }
  return null;
}

// "2 cups flour" -> {amount:"2", unit:"cups", name:"flour"}. Falls back to
// the whole line as the name when it doesn't match a leading quantity.
function parseIngredientLine(line) {
  const s = decodeEntities(line);
  const m = s.match(/^([\d\s./¼½¾⅓⅔⅛⅜⅝⅞-]+)\s*([a-zA-Z.]+)?\s+(.+)$/);
  if (m && m[3]) {
    return { id: Math.random().toString(36).slice(2, 9), amount: m[1].trim(), unit: (m[2] || "").trim(), name: m[3].trim() };
  }
  return { id: Math.random().toString(36).slice(2, 9), amount: "", unit: "", name: s };
}

// recipeInstructions can be a plain string, an array of strings, an array of
// HowToStep objects, or HowToSection objects nesting either of those.
function flattenInstructions(instr) {
  if (!instr) return [];
  if (typeof instr === "string") {
    return instr
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ id: Math.random().toString(36).slice(2, 9), text: decodeEntities(text), timer: null }));
  }
  if (Array.isArray(instr)) {
    let out = [];
    instr.forEach((item) => {
      if (typeof item === "string") {
        out.push({ id: Math.random().toString(36).slice(2, 9), text: decodeEntities(item), timer: null });
      } else if (item && item["@type"] === "HowToSection" && Array.isArray(item.itemListElement)) {
        out = out.concat(flattenInstructions(item.itemListElement));
      } else if (item && item.text) {
        out.push({ id: Math.random().toString(36).slice(2, 9), text: decodeEntities(item.text), timer: null });
      }
    });
    return out;
  }
  return [];
}

function metaTag(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return "";
}
function titleTag(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]) : "";
}

function mapJsonLdToRecipe(node) {
  const nameRaw = node.name;
  const title = typeof nameRaw === "string" ? nameRaw : Array.isArray(nameRaw) ? nameRaw[0] : "";
  let serves = null;
  const yieldRaw = node.recipeYield;
  if (yieldRaw) {
    const y = Array.isArray(yieldRaw) ? yieldRaw[0] : yieldRaw;
    const ym = String(y).match(/\d+/);
    if (ym) serves = parseInt(ym[0], 10);
  }
  const rawIngredients = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient
    : Array.isArray(node.ingredients)
    ? node.ingredients
    : [];
  const ingredients = rawIngredients.map(parseIngredientLine);
  const steps = flattenInstructions(node.recipeInstructions);
  const notes = typeof node.description === "string" ? decodeEntities(node.description) : "";
  const hasStructure = ingredients.length > 0 || steps.length > 0;
  return {
    title: decodeEntities(title) || "Imported recipe",
    type: hasStructure ? "full" : "simple",
    serves,
    ingredients,
    steps,
    notes,
    sourceUsed: "jsonld",
  };
}

async function readBodyCapped(response) {
  const reader = response.body ? response.body.getReader() : null;
  if (!reader) return await response.text();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BODY_BYTES) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in required" });
  const user = await verifySupabaseToken(token);
  if (!user) return res.status(401).json({ error: "Invalid or expired session" });
  if (rateLimited(user.id)) return res.status(429).json({ error: "Too many requests — try again in a few minutes" });

  const rawUrl = req.body && req.body.url;
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return res.status(400).json({ error: "url required" });
  }
  const target = safeTargetUrl(rawUrl.trim());
  if (!target) return res.status(400).json({ error: "That URL isn't supported" });

  let html;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AnchorFlowRecipeImport/1.0)" },
    });
    clearTimeout(timer);
    if (!r.ok) return res.status(502).json({ error: "Couldn't load that page" });
    html = await readBodyCapped(r);
  } catch {
    return res.status(502).json({ error: "Couldn't reach that URL" });
  }

  const recipeNode = extractJsonLdRecipe(html);
  if (recipeNode) {
    return res.status(200).json({ ok: true, recipe: mapJsonLdToRecipe(recipeNode) });
  }

  const ogTitle = metaTag(html, "og:title");
  const ogDesc = metaTag(html, "og:description") || metaTag(html, "description");
  if (ogTitle || ogDesc) {
    return res.status(200).json({
      ok: true,
      recipe: {
        title: ogTitle || titleTag(html) || "Imported recipe",
        type: "simple",
        serves: null,
        ingredients: [],
        steps: [],
        notes: ogDesc || "",
        sourceUsed: "opengraph",
      },
    });
  }

  return res.status(200).json({
    ok: true,
    recipe: {
      title: titleTag(html) || "Imported recipe",
      type: "simple",
      serves: null,
      ingredients: [],
      steps: [],
      notes: "",
      sourceUsed: "guess",
    },
  });
}
