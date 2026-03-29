#!/bin/bash
# preflight.sh — Session preflight for BusinessOS PM
# Usage: ./scripts/preflight.sh

set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "================================================"
echo "  BUSINESSOS PM — SESSION PREFLIGHT"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "================================================"
echo ""

WARNINGS=0

echo "Toolstack check:"

# .env.local
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  echo "  OK  .env.local exists"
else
  echo "  MISSING .env.local — copy from .env.local.example"
  WARNINGS=$((WARNINGS + 1))
fi

# .gitignore check
if [ -f "$PROJECT_ROOT/.gitignore" ]; then
  if grep -qE "\.env\.local|\.env\*" "$PROJECT_ROOT/.gitignore"; then
    echo "  OK  .env.local in .gitignore"
  else
    echo "  CRITICAL .env.local NOT in .gitignore — fix immediately"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# migrations folder
if [ -d "$PROJECT_ROOT/supabase/migrations" ]; then
  COUNT=$(ls "$PROJECT_ROOT/supabase/migrations/"*.sql 2>/dev/null | wc -l | tr -d '[:space:]')
  LATEST=$(ls "$PROJECT_ROOT/supabase/migrations/"*.sql 2>/dev/null | tail -1 | xargs basename 2>/dev/null || echo "none")
  echo "  OK  supabase/migrations/ ($COUNT files, latest: $LATEST)"
else
  echo "  MISSING supabase/migrations/"
  WARNINGS=$((WARNINGS + 1))
fi

# Not on main branch check
BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [ "$BRANCH" = "main" ]; then
  echo "  WARNING on main branch — create a feature branch before building"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  OK  branch: $BRANCH"
fi

echo ""
echo "Core docs:"
DOCS=("CLAUDE.md" "AGENTS.md" "docs/TASKS.md" "docs/ACTIVE_WORK.md" "docs/HANDOFF.md" "docs/TEAM.md" "docs/PROMPT_LIBRARY.md" "docs/TROUBLESHOOTING.md" "docs/PRODUCT_ROADMAP.md")
for f in "${DOCS[@]}"; do
  if [ -f "$PROJECT_ROOT/$f" ]; then
    echo "  OK  $f"
  else
    echo "  MISSING $f"
    WARNINGS=$((WARNINGS + 1))
  fi
done

echo ""
echo "================================================"
if [ "$WARNINGS" -gt 0 ]; then
  echo "  $WARNINGS item(s) need attention."
else
  echo "  All checks passed. Ready to build."
fi
echo "  Check docs/TASKS.md for open P0/P1 items."
echo "================================================"
echo ""
