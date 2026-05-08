#!/bin/bash
# Anchor & Flow — one-command deploy
# Place this at ~/Desktop/anchor-and-flow/deploy.sh
# Run with: bash ~/Desktop/anchor-and-flow/deploy.sh

set -e

PROJECT="$HOME/Desktop/anchor-and-flow"
SCRIPT="$PROJECT/write_app.py"

echo "⚓️  Anchor & Flow Deploy"
echo "────────────────────────"

# Step 1: Write latest App.jsx from the embedded script
if [ -f "$SCRIPT" ]; then
  echo "1/4  Writing App.jsx..."
  python3 "$SCRIPT"
else
  echo "⚠️   write_app.py not found — skipping file write"
  echo "     (download a fresh write_app.py from Claude first)"
fi

# Step 2: Stage
echo "2/4  Staging..."
cd "$PROJECT"
git add src/App.jsx

# Step 3: Commit
echo "3/4  Committing..."
git commit -m "update App.jsx" 2>/dev/null || echo "     Nothing new to commit"

# Step 4: Deploy
echo "4/4  Deploying to production..."
vercel --prod

echo ""
echo "✅  Done! Live at https://www.anchorandflowapp.com"
