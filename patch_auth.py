#!/usr/bin/env python3
"""
patch_auth.py
Fixes the "Invalid Refresh Token: Already Used" reload loop.

Two changes:
  1. refreshAuthToken — adds a promise mutex so concurrent callers share one
     in-flight refresh instead of racing on the same rotated token.
     Also adds a supabase.auth.getSession() fallback for when the SDK already
     rotated the token (happens after calendar OAuth).
  2. isAuthExpiredError — adds "already used" and "invalid refresh" so the
     poll catches these and attempts recovery instead of silently looping.

Run from: ~/Desktop/anchor-and-flow
"""
import os, sys, subprocess

ROOT = os.path.abspath(os.path.dirname(__file__))
APP  = os.path.join(ROOT, "src", "App.jsx")

if not os.path.exists(APP):
    print("x src/App.jsx not found — run from ~/Desktop/anchor-and-flow")
    sys.exit(1)

with open(APP, "r", encoding="utf-8") as f:
    code = f.read()

edits = 0

def swap(label, old, new):
    global code, edits
    if old not in code:
        print("  x Anchor not found: " + label)
        return
    code = code.replace(old, new, 1)
    edits += 1
    print("  v " + label)

# ── 1. refreshAuthToken — add mutex + getSession fallback ─────────────────
OLD_REFRESH = (
    "// ── Supabase token refresh ──────────────────────────────────────────────────\n"
    "// Reads refresh_token from localStorage, calls Supabase, saves new tokens.\n"
    "// Returns new access_token string or null on failure.\n"
    "async function refreshAuthToken() {\n"
    "  try {\n"
    "    const refreshToken = localStorage.getItem(\"af_refreshToken\");\n"
    "    if (!refreshToken) { console.warn(\"[AF AUTH] no refresh_token stored — cannot refresh\"); return null; }\n"
    "    const SUPABASE_URL = \"https://sbgbyptkunvyxjfpzght.supabase.co\";\n"
    "    const res = await fetch(SUPABASE_URL + \"/auth/v1/token?grant_type=refresh_token\", {\n"
    "      method: \"POST\",\n"
    "      headers: {\n"
    "        \"Content-Type\": \"application/json\",\n"
    "        \"apikey\": SUPABASE_KEY,\n"
    "      },\n"
    "      body: JSON.stringify({ refresh_token: refreshToken })\n"
    "    });\n"
    "    if (!res.ok) {\n"
    "      console.warn(\"[AF AUTH] token refresh failed\", res.status);\n"
    "      return null;\n"
    "    }\n"
    "    const data = await res.json();\n"
    "    if (!data.access_token) { console.warn(\"[AF AUTH] token refresh — no access_token in response\"); return null; }\n"
    "    try { localStorage.setItem(\"af_authToken\", JSON.stringify(data.access_token)); } catch {}\n"
    "    if (data.refresh_token) { try { localStorage.setItem(\"af_refreshToken\", data.refresh_token); } catch {} }\n"
    "    AF_DEBUG&&console.log(\"[AF AUTH] token refreshed successfully\");\n"
    "    return data.access_token;\n"
    "  } catch(e) {\n"
    "    console.warn(\"[AF AUTH] token refresh error:\", e.message);\n"
    "    return null;\n"
    "  }\n"
    "}"
)

NEW_REFRESH = (
    "// ── Supabase token refresh ──────────────────────────────────────────────────\n"
    "// Reads refresh_token from localStorage, calls Supabase, saves new tokens.\n"
    "// Returns new access_token string or null on failure.\n"
    "// _refreshInFlight mutex prevents concurrent polls from racing on the same\n"
    "// rotated token — root cause of the 'Already Used' loop after calendar OAuth.\n"
    "var _refreshInFlight = null;\n"
    "async function refreshAuthToken() {\n"
    "  if (_refreshInFlight) return _refreshInFlight;\n"
    "  const p = (async function() {\n"
    "    try {\n"
    "      const refreshToken = localStorage.getItem(\"af_refreshToken\");\n"
    "      if (!refreshToken) { console.warn(\"[AF AUTH] no refresh_token stored — cannot refresh\"); return null; }\n"
    "      const SUPABASE_URL = \"https://sbgbyptkunvyxjfpzght.supabase.co\";\n"
    "      const res = await fetch(SUPABASE_URL + \"/auth/v1/token?grant_type=refresh_token\", {\n"
    "        method: \"POST\",\n"
    "        headers: {\n"
    "          \"Content-Type\": \"application/json\",\n"
    "          \"apikey\": SUPABASE_KEY,\n"
    "        },\n"
    "        body: JSON.stringify({ refresh_token: refreshToken })\n"
    "      });\n"
    "      if (!res.ok) {\n"
    "        console.warn(\"[AF AUTH] token refresh failed\", res.status);\n"
    "        // Calendar OAuth causes Supabase SDK to rotate the token internally.\n"
    "        // af_refreshToken may be stale — fall back to SDK's own session.\n"
    "        try {\n"
    "          const { data: sd } = await supabase.auth.getSession();\n"
    "          if (sd && sd.session && sd.session.access_token) {\n"
    "            try { localStorage.setItem(\"af_authToken\", JSON.stringify(sd.session.access_token)); } catch {}\n"
    "            if (sd.session.refresh_token) { try { localStorage.setItem(\"af_refreshToken\", sd.session.refresh_token); } catch {} }\n"
    "            AF_DEBUG&&console.log(\"[AF AUTH] recovered token via getSession()\");\n"
    "            return sd.session.access_token;\n"
    "          }\n"
    "        } catch(se) { console.warn(\"[AF AUTH] getSession fallback failed\", se.message); }\n"
    "        return null;\n"
    "      }\n"
    "      const data = await res.json();\n"
    "      if (!data.access_token) { console.warn(\"[AF AUTH] token refresh — no access_token in response\"); return null; }\n"
    "      try { localStorage.setItem(\"af_authToken\", JSON.stringify(data.access_token)); } catch {}\n"
    "      if (data.refresh_token) { try { localStorage.setItem(\"af_refreshToken\", data.refresh_token); } catch {} }\n"
    "      AF_DEBUG&&console.log(\"[AF AUTH] token refreshed successfully\");\n"
    "      return data.access_token;\n"
    "    } catch(e) {\n"
    "      console.warn(\"[AF AUTH] token refresh error:\", e.message);\n"
    "      return null;\n"
    "    } finally {\n"
    "      _refreshInFlight = null;\n"
    "    }\n"
    "  })();\n"
    "  _refreshInFlight = p;\n"
    "  return p;\n"
    "}"
)

swap("refreshAuthToken — mutex + getSession fallback", OLD_REFRESH, NEW_REFRESH)

# ── 2. isAuthExpiredError — add "already used" and "invalid refresh" ──────
OLD_AUTH_ERR = (
    "function isAuthExpiredError(err) {\n"
    "    const msg = String(err?.message || err || \"\").toLowerCase();\n"
    "    return msg.includes(\"jwt expired\") ||\n"
    "           msg.includes(\"401\") ||\n"
    "           msg.includes(\"unauthorized\") ||\n"
    "           msg.includes(\"invalid jwt\");\n"
    "  }"
)

NEW_AUTH_ERR = (
    "function isAuthExpiredError(err) {\n"
    "    const msg = String(err?.message || err || \"\").toLowerCase();\n"
    "    return msg.includes(\"jwt expired\") ||\n"
    "           msg.includes(\"401\") ||\n"
    "           msg.includes(\"unauthorized\") ||\n"
    "           msg.includes(\"invalid jwt\") ||\n"
    "           msg.includes(\"already used\") ||\n"
    "           msg.includes(\"invalid refresh\");\n"
    "  }"
)

swap("isAuthExpiredError — add already-used + invalid-refresh", OLD_AUTH_ERR, NEW_AUTH_ERR)

# ── write + check ─────────────────────────────────────────────────────────
with open(APP, "w", encoding="utf-8") as f:
    f.write(code)
print("  File written (" + str(len(code)) + " chars)")

esbuild = os.path.join(ROOT, "node_modules", ".bin", "esbuild")
if os.path.exists(esbuild):
    r = subprocess.run([esbuild, "src/App.jsx", "--bundle=false"], capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        print("  ! esbuild errors:\n" + r.stderr[:600])
    else:
        print("  v esbuild syntax OK")
else:
    print("  i esbuild not found — skipping check")

print()
print("Applied: " + str(edits) + " edit(s)")
print()
print('If clean:  ./deploy.sh "fix auth — refresh mutex + getSession fallback"')
