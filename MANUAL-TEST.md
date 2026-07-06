## Manual Device Tests

### Zombie-session fix (branch: zombie-session-fix)

**How to force a zombie session:**
1. Open DevTools → Application → Local Storage.
2. Set `af_authToken` to any garbage value (e.g. `"expired-token"`). Keep all other `af_*` keys intact — your household data must remain.
3. Wait up to 15 seconds for the next poll tick, or trigger a sync manually by switching tabs to force `visibilitychange`.

**What should happen:**
- The `[AF SYNC] poll auth expired — zombie session detected` log line appears in the console.
- The in-app banner "Session expired — please sign in again." slides in.
- The AuthModal opens on top of the current view — household data (tasks, meals, Exhale cards, etc.) remains visible behind it.
- No reload, no data wipe. The `af_tasks`, `af_people`, etc. keys in localStorage are untouched.
- `af_authToken` and `af_authUser` are now `null` in localStorage.

**After re-login:**
- Sign in through the AuthModal with the correct credentials.
- Verify the `af_dirtyKeys` array (if non-empty) triggers a push within the first poll cycle.
- All household data should be exactly as it was before the zombie was triggered — nothing lost.

**Contrast with explicit sign-out:**
- Tap Settings → Sign out → confirm.
- All `af_*` household keys are removed from localStorage.
- After re-login on the same device, the device pulls fresh data from the cloud.
