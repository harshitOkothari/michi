#!/usr/bin/env bash
# One-command update:  bash deploy.sh "what I changed"
# Rebuilds js/bundle.js, commits everything, pushes to GitHub (Pages redeploys itself).
set -e
cd "$(dirname "$0")"
bash build.sh
git add -A
git commit -m "${1:-update}" || echo "Nothing new to commit."
git push
echo "Pushed. Live in ~1 minute."
