#!/usr/bin/env python3
"""
Run: python3 apply_patch.py App.jsx
Creates App_fixed.jsx with all session persistence fixes applied.
"""
import sys, re

if len(sys.argv) < 2:
    print("Usage: python3 apply_patch.py App.jsx")
    sys.exit(1)

with open(sys.argv[1], 'r') as f:
    src = f.read()

fixes_applied = []

# ── FIX 1: Token validation useEffect ────────────────────────────────────────
TOKEN_VALIDATION = """
  // ── FIX 1: Validate auth token on load — clear if expired ───────────────
  useEffect(() => {
    if (!authToken) return;
    sbFetch("/auth/v1/user", { _token: authToken })
      .catch(() => {
        try { localStorage.removeItem("af_authToken"); } catch {}
        try { localStorage.removeItem("af_authUser"); } catch {}
        setAuthToken(null);
        setAuthUser(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

"""

TARGET1 = "  // ── Household sync functions"
if TARGET1 in src and "FIX 1" not in src:
    src = src.replace(TARGET1, TOKEN_VALIDATION + TARGET1)
    fixes_applied.append("FIX 1: Token validation useEffect added")
else:
    fixes_applied.append("FIX 1: SKIPPED (already applied or target not found)")

# ── FIX 2: signIn — clear lastHHSync after saving token ──────────────────────
OLD_SIGNIN = '      try { localStorage.setItem("af_authToken", JSON.stringify(token)); } catch {}\n      try { localStorage.setItem("af_authUser", JSON.stringify({ id: userId, email, displayName })); } catch {}'
NEW_SIGNIN = OLD_SIGNIN + '\n      // FIX 2: clear sync stamp so fresh data is pulled on next load\n      try { localStorage.removeItem("af_lastHHSync"); } catch {}'

if OLD_SIGNIN in src and "FIX 2" not in src:
    src = src.replace(OLD_SIGNIN, NEW_SIGNIN, 1)
    fixes_applied.append("FIX 2: signIn lastHHSync clear added")
else:
    fixes_applied.append("FIX 2: SKIPPED (already applied or target not found)")

# ── FIX 3: signUp — clear lastHHSync after saving token ──────────────────────
OLD_SIGNUP = '        try { localStorage.setItem("af_authToken", JSON.stringify(token)); } catch {}\n        try { localStorage.setItem("af_authUser", JSON.stringify(userObj)); } catch {}'
NEW_SIGNUP = OLD_SIGNUP + '\n        // FIX 3: clear sync stamp so fresh data is pulled on next load\n        try { localStorage.removeItem("af_lastHHSync"); } catch {}'

if OLD_SIGNUP in src and "FIX 3" not in src:
    src = src.replace(OLD_SIGNUP, NEW_SIGNUP, 1)
    fixes_applied.append("FIX 3: signUp lastHHSync clear added")
else:
    fixes_applied.append("FIX 3: SKIPPED (already applied or target not found)")

# ── FIX 4: Replace broken background sync useEffect ──────────────────────────
OLD_SYNC = """  // ── Background household sync on app load ────────────────────────────────
  // Runs AFTER render - pulls latest household data without blocking the UI
  // Does NOT clear auth on failure — network errors shouldn't log users out
  useEffect(() => {
    if (!authToken || !householdId) return;
    const timer = setTimeout(() => {
      sbFetch(`/rest/v1/households?id=eq.${householdId}&select=*`, { _token: authToken })
        .then(rows => {
          if (rows && rows.length > 0 && rows[0].data) {
            const row = rows[0];
            let changed = false;
            SYNC_KEYS.forEach(k => {
              if (row.data[k] !== undefined) {
                try { localStorage.setItem("af_"+k, JSON.stringify(row.data[k])); changed = true; } catch {}
              }
            });
            // Only reload if we got new data (avoids reload loop)
            if (changed) {
              const lastSync = localStorage.getItem("af_lastHHSync");
              const now = Date.now().toString();
              if (lastSync !== row.updated_at) {
                localStorage.setItem("af_lastHHSync", row.updated_at || now);
                // Don't auto-reload — just update silently next time
              }
            }
          }
        })
        .catch(() => {}); // silently ignore — don't log out on network errors
    }, 2000); // delay 2s so UI renders first
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);"""

NEW_SYNC = """  // ── Background household sync on app load ────────────────────────────────
  // FIX 4: Pulls latest data and reloads ONCE if server has newer data.
  // Does NOT clear auth on failure — network errors shouldn't log users out.
  useEffect(() => {
    if (!authToken || !householdId) return;
    const timer = setTimeout(() => {
      sbFetch(`/rest/v1/households?id=eq.${householdId}&select=*`, { _token: authToken })
        .then(rows => {
          if (rows && rows.length > 0 && rows[0].data) {
            const row = rows[0];
            const lastSync = localStorage.getItem("af_lastHHSync");
            // Only reload if server has data we haven't applied yet
            if (lastSync !== (row.updated_at || "")) {
              let changed = false;
              SYNC_KEYS.forEach(k => {
                if (row.data[k] !== undefined) {
                  try { localStorage.setItem("af_" + k, JSON.stringify(row.data[k])); changed = true; } catch {}
                }
              });
              if (changed) {
                localStorage.setItem("af_lastHHSync", row.updated_at || Date.now().toString());
                window.location.reload(); // apply fresh data to React state
              }
            }
          }
        })
        .catch(() => {}); // silently ignore — don't log out on network errors
    }, 2000); // delay 2s so UI renders first
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);"""

if OLD_SYNC in src:
    src = src.replace(OLD_SYNC, NEW_SYNC)
    fixes_applied.append("FIX 4: Background sync useEffect replaced")
else:
    fixes_applied.append("FIX 4: SKIPPED (target not found — may already be fixed)")

# ── FIX 5: signOut — clear lastHHSync ────────────────────────────────────────
OLD_SIGNOUT = """  async function signOut() {
    if (authToken) { try { await sbSignOut(authToken); } catch {} }
    setAuthToken(null);
    setAuthUser(null);
    setHouseholdId(null);
    setSyncStatus("idle");
  }"""

NEW_SIGNOUT = """  async function signOut() {
    if (authToken) { try { await sbSignOut(authToken); } catch {} }
    setAuthToken(null);
    setAuthUser(null);
    setHouseholdId(null);
    setSyncStatus("idle");
    // FIX 5: clear sync stamp on sign out
    try { localStorage.removeItem("af_lastHHSync"); } catch {}
  }"""

if OLD_SIGNOUT in src and "FIX 5" not in src:
    src = src.replace(OLD_SIGNOUT, NEW_SIGNOUT)
    fixes_applied.append("FIX 5: signOut lastHHSync clear added")
else:
    fixes_applied.append("FIX 5: SKIPPED (already applied or target not found)")

# ── Write output ──────────────────────────────────────────────────────────────
outfile = sys.argv[1].replace(".jsx", "_fixed.jsx")
with open(outfile, 'w') as f:
    f.write(src)

print(f"\n✅ Done! Output: {outfile}")
print(f"   Original: {len(src.splitlines())} lines\n")
print("Fixes summary:")
for fix in fixes_applied:
    status = "✓" if "SKIPPED" not in fix else "⚠"
    print(f"  {status} {fix}")
