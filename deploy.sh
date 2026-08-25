#!/bin/bash
set -e

# ── Double-run guard ──────────────────────────────────────────────────────────
# Read through this script top to bottom: git commit is called exactly once,
# inside one `if`, no loop, no recursion — nothing INSIDE deploy.sh causes a
# single invocation to commit twice. Checked for external causes too: no git
# hooks (.git/hooks/ has only the *.sample files Git ships by default), no
# package.json/vercel.json build step that calls this script, no shell alias
# referencing it. So the reported "runs twice, duplicate commits with wrong
# messages" is coming from the SCRIPT BEING INVOKED TWICE in quick succession
# (a double-paste, a flaky terminal/SSH session double-sending input, or two
# calls issued back-to-back before the first finished) — not from a bug in
# the script's own control flow. This lock can't fix an unknown external
# trigger, but it makes the actual symptom (two overlapping/near-simultaneous
# runs) impossible: the second invocation refuses to proceed instead of
# silently committing a second, differently-worded message on top of the
# first. Auto-expires after 5 minutes in case a previous run crashed/was
# killed without reaching the `trap`-based cleanup below.
LOCK_FILE=".git/af-deploy.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_MTIME=$(stat -f %m "$LOCK_FILE" 2>/dev/null || stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)
  LOCK_AGE=$(( $(date +%s) - LOCK_MTIME ))
  if [ "$LOCK_AGE" -lt 300 ]; then
    echo "❌ Another deploy started ${LOCK_AGE}s ago (lock: $LOCK_FILE) — refusing to run again."
    echo "   If no other deploy is actually still running, remove the lock and retry:"
    echo "   rm $LOCK_FILE"
    exit 1
  fi
  echo "⚠️  Stale lock file (${LOCK_AGE}s old, previous run likely crashed) — continuing."
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

MSG=${1:-"update"}

echo "🔍 Building from src/App.jsx directly"
APP_LINES=$(wc -l < src/App.jsx)
echo "📄 App.jsx: $APP_LINES lines"
if [ "$APP_LINES" -lt 5000 ]; then echo "❌ App.jsx too small — wrong file?"; exit 1; fi

# ── Build stamp ───────────────────────────────────────────────────────────────
# Write UTC datetime + short git hash into public/sw.js CACHE_VERSION and
# src/buildStamp.js BEFORE the build so every deploy changes sw.js (→ waiting
# worker → update banner) and the stamp is visible in Settings without Web Inspector.
# Pattern is idempotent: sed replaces the entire anchor-flow-v... value in place.
STAMP_DATE=$(date -u '+%Y%m%d-%H%M%S')
STAMP_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
STAMP="${STAMP_DATE}-${STAMP_HASH}"
echo "📌 Build stamp: $STAMP"
# sw.js: replace CACHE_VERSION value (anchor-flow-v<anything> → anchor-flow-v<stamp>)
sed -i '' "s/const CACHE_VERSION = \"anchor-flow-v[^\"]*\"/const CACHE_VERSION = \"anchor-flow-v${STAMP}\"/" public/sw.js
# buildStamp.js: replace BUILD_STAMP export
sed -i '' "s/export const BUILD_STAMP = \"[^\"]*\"/export const BUILD_STAMP = \"${STAMP}\"/" src/buildStamp.js
echo "✅ Stamped sw.js and src/buildStamp.js"

npm run build

git add -A

# ── Finder-duplicate guard ────────────────────────────────────────────────────
# Abort if any staged file looks like a macOS Finder duplicate (" 2.", " 2/").
# These appear as "<name> 2.ext" or inside "<dir> 2/" and signal an accident.
if git diff --cached --name-only | grep -qE ' 2\.| 2/'; then
  echo "❌ Staged files contain Finder-duplicate pattern (' 2.' or ' 2/') — aborting."
  echo "   Offending files:"
  git diff --cached --name-only | grep -E ' 2\.| 2/'
  echo "   Run 'git reset HEAD <file>' to unstage them."
  exit 1
fi

if ! git diff --cached --quiet; then
  echo ""
  echo "── Staged changes ──────────────────────────────────────────────────────"
  git diff --cached --stat
  echo "────────────────────────────────────────────────────────────────────────"
  echo ""
  read -r -p "Deploy these changes? [y/N] " CONFIRM
  case "$CONFIRM" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
  git commit -m "$MSG"
else
  echo "ℹ️  Nothing new to commit — deploying current HEAD"
fi
git push origin main
vercel --prod

echo "🔎 Verifying live bundle hash..."
sleep 5
LIVE=$(curl -s https://www.anchorandflowapp.com | grep -o 'assets/index-[^"]*\.js')
LOCAL=$(ls dist/assets/index-*.js | xargs -n1 basename)
echo "   live:  $LIVE"
echo "   local: assets/$LOCAL"
if [ "$LIVE" != "assets/$LOCAL" ]; then
  echo "⚠️  HASH MISMATCH — live alias may not have promoted!"
fi
