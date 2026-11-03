#!/usr/bin/env bash
# Init a clean git repo, leave secret fixtures untracked, install Sentinel hooks.
# Video beat: stage app.py + config.json → commit blocked; push also blocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$ROOT/../../project" && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--reset" ]]; then
  rm -rf .git
fi

if [[ ! -d .git ]]; then
  git init -q
  # Clean seed only — secret fixtures stay untracked until the demo stages them.
  git add README.md setup.sh
  git -c user.email="demo@sentinel.local" -c user.name="Sentinel Demo" \
    commit -q -m "chore: seed clean leaky-push-demo"
fi

node "$PROJECT/scripts/install-hook.mjs" --force "$ROOT"
node "$PROJECT/scripts/install-hook.mjs" --force --pre-push "$ROOT"

echo
echo "Ready. Secret fixtures are untracked: app.py  config.json"
echo "Show the block:"
echo "  git add app.py config.json"
echo "  git commit -m 'ship credentials'"
echo "Expect the Sentinel pre-commit hook to FAIL (exit 1)."
echo "Optional push block (same working tree): git push  → pre-push FAIL"
