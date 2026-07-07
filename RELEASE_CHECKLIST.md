# Release Checklist

Complete every item before deploying to production.

---

## Pre-release

- [ ] `npm test` — all tests green (215+ required; if count drops, investigate before shipping)
- [ ] `npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null` — 0 warnings
- [ ] `git diff --stat main` — review every changed file in the diff
- [ ] No secrets, credentials, or `.env.local` staged (`git diff --cached --name-only`)
- [ ] No Finder-duplicate files (`git diff --cached --name-only | grep ' 2\.'`)

## Deploy

- [ ] Run `./deploy.sh "descriptive commit message"`
- [ ] Script prints `📌 Build stamp: <YYYYMMDD-HHmmss-hash>` — confirm it looks correct
- [ ] Confirm the diff-stat at the prompt — type `y` only if the staged changes match what you intended
- [ ] Script completes without `❌` errors
- [ ] Live bundle hash matches local hash (printed at end of script, or verify manually)

## Post-deploy

- [ ] **Cold-open phone check**: Open PWA on a clean-loaded phone (no cached state)
  - Loading screen shows
  - App renders without blank/crash
  - Sync indicator reaches "synced" within ~10s
- [ ] **Receiving-device sync spot-check**: Edit something on device A, confirm it appears on device B
  within 2 minutes (2 poll cycles). Verify on the RECEIVER — this was the July lesson.
- [ ] **Check Vercel dashboard**: Confirm deployment status is "Ready" and the correct commit is live
- [ ] **Auth flow**: Sign out and sign back in on one device — confirm household data reappears

## Landing page (if landing was also changed)

- [ ] Deployed separately from `anchor and flow- landing/` directory
- [ ] Verified at `home.anchorandflowapp.com`
- [ ] Did NOT use the main app's `vercel.json`
