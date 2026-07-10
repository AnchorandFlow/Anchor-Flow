# RF0 — Baseline Bundle

Captured: 2026-07-09, before any extraction. All numbers here are the permanent pre-refactor reference point.

---

## Test baseline

```
Test Files:  7 passed (7)
Tests:       263 passed (263)
Duration:    2.20s
```

All 263 tests green as of commits `53cb369` + `4d386fc` (pre-RF-1). Any extraction batch that drops below 263/263 is a regression.

---

## Build baseline

Command: `npm run build`

```
dist/index.html                     1.52 kB  (gzip: 0.69 kB)
dist/assets/index-B1ELWDVe.css      1.71 kB  (gzip: 0.77 kB)
dist/assets/index-C0hls7fe.js   1,560.46 kB  (gzip: 370.28 kB)

Build time: 762ms
Vite version: 8.0.10
Chunks: 1 JS bundle (all code in a single file — confirmed by the warning below)
```

**Deployed baseline:** commit `0c84f2b`, bundle `index-C0hls7fe.js`, 370.28 kB gzip. Deployed and hash-verified in production 2026-07-09.

Vite warning (expected, pre-existing):
> Some chunks are larger than 500 kB after minification. Consider using dynamic import() to code-split the application.

This warning is a design goal of the refactor, not a current regression. It will be addressed by batch RF-6 (dynamic imports) or by the code-splitting milestone after extraction is complete.

---

## Build target

**`vite.config.js` `build.target` = `"es2019"`** (confirmed, line 5 of vite.config.js).

Every extraction commit must build cleanly against this target. The esbuild syntax check is the canonical gate:
```
npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null
```
Baseline: zero warnings.

---

## App.jsx line count

**11,928 lines** as of the RF-0 snapshot (main branch, 2026-07-09). The earlier figure of 14,172 was wrong — it came from a stale session summary that had not re-verified against `wc -l src/App.jsx`.

> Note: `lh-2` branch has Lighthouse code merged; main is the extraction target. Line count after `lh-2` lands will differ — run this section again at that point.

---

## Post-extraction bundle delta rule

After every **extraction-only batch** (cut + paste + import, nothing else):

- JS gzip size should change by **< 2 kB** (compression artifacts only).
- A delta > 5 kB means the batch introduced new code or broke tree-shaking. Treat it as a red flag.
- CSS should be **identical** unless a batch moves inline-style definitions into a stylesheet (which is out of scope for RF-1 through RF-8).
- Build time is allowed to increase slightly as more modules are resolved; a 2× increase is a red flag.
