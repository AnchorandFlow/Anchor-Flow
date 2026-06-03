#!/bin/bash
MSG=${1:-"update"}

echo "🔍 Building from src/App.jsx directly"
APP_LINES=$(wc -l < src/App.jsx)
echo "📄 App.jsx: $APP_LINES lines"
if [ "$APP_LINES" -lt 5000 ]; then echo "❌ App.jsx too small — wrong file?"; exit 1; fi

npm run build
if [ $? -ne 0 ]; then echo "❌ Build failed — not deploying"; exit 1; fi

git add -A
git commit -m "$MSG"
vercel --prod
