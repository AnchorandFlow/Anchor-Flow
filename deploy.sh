#!/bin/bash
MSG=${1:-"update"}

NEWEST_APP=$(ls -t ~/Downloads/App*.jsx 2>/dev/null | head -1)
NEWEST_VAULT=$(ls -t ~/Downloads/AnchorVault*.jsx 2>/dev/null | head -1)

if [ -z "$NEWEST_APP" ]; then echo "❌ No App*.jsx found in Downloads"; exit 1; fi

APP_LINES=$(wc -l < "$NEWEST_APP")
echo "📄 App.jsx: $NEWEST_APP ($APP_LINES lines)"
if [ "$APP_LINES" -lt 5000 ]; then echo "❌ App.jsx too small — wrong file?"; exit 1; fi

cp "$NEWEST_APP" src/App.jsx
echo "✅ Copied App.jsx"

if [ -n "$NEWEST_VAULT" ]; then
  VAULT_LINES=$(wc -l < "$NEWEST_VAULT")
  echo "📄 AnchorVault: $NEWEST_VAULT ($VAULT_LINES lines)"
  if [ "$VAULT_LINES" -gt 1000 ]; then
    cp "$NEWEST_VAULT" src/components/AnchorVault.jsx
    echo "✅ Copied AnchorVault.jsx"
  else
    echo "⚠️  AnchorVault too small — skipping"
  fi
fi

npm run build
if [ $? -ne 0 ]; then echo "❌ Build failed — not deploying"; exit 1; fi

git add -A
git commit -m "$MSG"
vercel --prod
