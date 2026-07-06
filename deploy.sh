#!/bin/bash
set -e
MSG=${1:-"update"}

echo "🔍 Building from src/App.jsx directly"
APP_LINES=$(wc -l < src/App.jsx)
echo "📄 App.jsx: $APP_LINES lines"
if [ "$APP_LINES" -lt 5000 ]; then echo "❌ App.jsx too small — wrong file?"; exit 1; fi

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
