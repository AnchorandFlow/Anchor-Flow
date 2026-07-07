# Deployment Runbook

**DO NOT deploy without completing this checklist.**

---

## Prerequisites

- Working directory: `anchor-and-flow/` (main app, NOT the landing subfolder)
- On `main` branch, all changes committed
- No pending merges or rebase in progress

---

## deploy.sh flow

The script is `./deploy.sh [commit message]`. It is interactive.

### Steps the script runs

1. **Line-count guard:** `wc -l < src/App.jsx` — aborts if < 5000 lines (wrong file check)
2. **Build stamp (NEW):** Writes `YYYYMMDD-HHmmss-<7-char-hash>` stamp into `public/sw.js` `CACHE_VERSION` and `src/buildStamp.js` `BUILD_STAMP` **before** the build. This ensures every deploy changes `sw.js`, triggering the update banner on all open clients. The stamp is also surfaced in Settings under "Build:".
3. **Build:** `npm run build` (Vite 8, ES2019 target, outputs to `dist/`)
4. **Stage all:** `git add -A`
5. **Finder-duplicate guard:** Aborts if any staged file path matches ` 2.` or ` 2/`
   (macOS Finder duplicate pattern). Lists offending files and exits with code 1.
6. **Diff-stat confirm:** Prints `git diff --cached --stat` and prompts `[y/N]`.
   Aborts unless you type `y`. (Skipped if nothing new to commit.)
7. **Commit:** `git commit -m "<message>"`
8. **Push:** `git push origin main`
9. **Vercel deploy:** `vercel --prod`
10. **Live hash check:** `curl` the live site and compares the script tag hash against
    the local `dist/assets/index-*.js` basename. Warns if they differ (aliasing issue).

### Cache cleanup on SW activate

The SW `activate` handler deletes **all** caches that don't match the current `CACHE_VERSION`. Since every deploy writes a new timestamp+hash stamp, each deploy's SW activation automatically cleans up the previous stamp's cache. There is no unbounded growth — at most two caches exist simultaneously (current + previous activating).

### Common deploy failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `❌ App.jsx too small` | Wrong directory or file | Confirm `pwd` is `anchor-and-flow/` |
| `❌ Finder-duplicate pattern` | `git add -A` picked up ` 2.` files | `git reset HEAD '<file> 2.ext'`, then re-run |
| `⚠️ HASH MISMATCH` | Vercel alias not promoted | Re-run `vercel --prod` or check Vercel dashboard |
| Build fails | ESLint, missing dep | `npm ci && npm run build` locally first |

---

## Manual pre-deploy checklist

Run these before calling `./deploy.sh`:

```
[ ] npm test                          — all tests pass (202+ green)
[ ] npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null
                                      — 0 warnings
[ ] git diff --stat HEAD              — review what you're about to ship
[ ] No .env.local or credentials staged (check git diff --cached --name-only)
```

---

## Rollback procedure

1. Find the last good commit hash: `git log --oneline -10`
2. `git revert <bad-commit-hash>` — creates a revert commit (preferred, preserves history)
3. If multiple commits: `git revert <oldest>..<newest>` (reverts range)
4. `./deploy.sh "revert: <description>"`
5. After deploy, verify live hash matches the reverted bundle

Do NOT use `git reset --hard` on published commits — it rewrites history other devices may
have pulled.

---

## SW cache-version note

When changing `public/sw.js` cache name (e.g. bumping `anchor-flow-v20260622-1`):
- All clients that have the old cache will delete it on SW activation
- During the SW update window, some clients serve old assets from cache — expected
- The in-app "update available" banner + `controllerchange` reload handles the transition
- Do NOT increment cache version for code-only changes (hashed assets handle this)
- DO increment cache version when changing sw.js behavior (new routes, strategy changes)

---

## Landing project (separate deploy — CRITICAL)

The landing page at `anchor and flow- landing/` is a SEPARATE Vercel project.

**Do NOT:**
- Run `vercel --prod` from inside `anchor and flow- landing/` using the main app's config
- Touch `anchor and flow- landing/vercel.json`
- Include landing files in main app deploys

**How to deploy landing changes:**
```bash
cd "anchor and flow- landing/"
# Make changes
vercel --prod   # uses the landing project's own vercel.json and Vercel project
```

The landing project deploys to `home.anchorandflowapp.com` (separate domain from `anchorandflowapp.com`).

---

## Post-deploy verification

1. **Cold-open phone check:** Open the PWA on a phone (clear site data first for a true cold load)
   - Loading screen appears (navy, "anchor & flow" text)
   - App renders within 3 seconds
   - Sync indicator shows "synced" within 10 seconds
2. **Receiving-device sync spot-check:** Make an edit on the desktop, verify it appears on phone
   within 2 poll intervals (~120 seconds). This is the "July lesson" — verify on the RECEIVER.
3. **Live bundle hash:** Confirm `deploy.sh` printed matching hashes, or manually:
   ```bash
   curl -s https://www.anchorandflowapp.com | grep -o 'assets/index-[^"]*\.js'
   ls dist/assets/index-*.js | xargs basename
   ```
