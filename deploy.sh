#!/bin/bash
set -e
MSG=${1:-"update"}

echo "🔍 Building from src/App.jsx directly"
APP_LINES=$(wc -l < src/App.jsx)
echo "📄 App.jsx: $APP_LINES lines"
if [ "$APP_LINES" -lt 5000 ]; then echo "❌ App.jsx too small — wrong file?"; exit 1; fi

npm run build

git add -A
if ! git diff --cached --quiet; then
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