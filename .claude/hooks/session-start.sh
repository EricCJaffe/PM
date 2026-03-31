#!/usr/bin/env bash
# session-start.sh — BusinessOS PM session hygiene check
# Runs automatically at the start of each Claude Code session.

set -euo pipefail

BOLD='\033[1m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}── Session Start Check ────────────────────────────────${RESET}"

# ── 1. Fetch + prune from origin ─────────────────────────────────────────────
echo -n "  Fetching from origin... "
if git fetch --prune origin 2>/dev/null; then
  echo -e "${GREEN}done${RESET}"
else
  echo -e "${YELLOW}fetch failed (offline?)${RESET}"
fi

# ── 2. Current branch ahead/behind ──────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo -e "  Branch: ${BOLD}${BRANCH}${RESET}"

if git rev-parse --verify "origin/${BRANCH}" &>/dev/null; then
  AHEAD=$(git rev-list "origin/${BRANCH}..HEAD" --count 2>/dev/null || echo 0)
  BEHIND=$(git rev-list "HEAD..origin/${BRANCH}" --count 2>/dev/null || echo 0)
  if [ "$AHEAD" -gt 0 ] && [ "$BEHIND" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ ${AHEAD} commit(s) ahead, ${BEHIND} behind origin/${BRANCH} — consider rebase${RESET}"
  elif [ "$AHEAD" -gt 0 ]; then
    echo -e "  ${YELLOW}↑ ${AHEAD} unpushed commit(s)${RESET}"
  elif [ "$BEHIND" -gt 0 ]; then
    echo -e "  ${YELLOW}↓ ${BEHIND} commit(s) behind origin — run git pull${RESET}"
  else
    echo -e "  ${GREEN}✓ Up to date with origin/${BRANCH}${RESET}"
  fi
else
  echo -e "  ${YELLOW}(no remote tracking branch for ${BRANCH})${RESET}"
fi

# ── 3. Uncommitted changes ───────────────────────────────────────────────────
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠ ${UNCOMMITTED} uncommitted change(s) in working tree${RESET}"
else
  echo -e "  ${GREEN}✓ Working tree clean${RESET}"
fi

# ── 4. Stale remote branches (merged into main, still on remote) ─────────────
STALE=$(git branch -r --merged origin/main 2>/dev/null \
  | grep -v "origin/main\|origin/HEAD" \
  | wc -l | tr -d ' ')
if [ "$STALE" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠ ${STALE} remote branch(es) merged into main but not yet deleted${RESET}"
fi

# ── 5. Tasks assigned to @eric ───────────────────────────────────────────────
TASKS_FILE="docs/TASKS.md"
if [ -f "$TASKS_FILE" ]; then
  # Exclude lines inside code fences / backtick examples (lines starting with spaces+backtick or Example:)
  TASK_LINES=$(grep '\[@eric\]' "$TASKS_FILE" 2>/dev/null | grep -v '^\s*`\|^Example' || true)
  ERIC_TASKS=$(echo "$TASK_LINES" | grep -c '\[@eric\]' || true)
  ERIC_OPEN=$(echo "$TASK_LINES" | grep -c '^- \[ \]' || true)
  echo -e "  Tasks for @eric: ${BOLD}${ERIC_OPEN} open${RESET} (${ERIC_TASKS} total assigned)"
fi

echo -e "${BOLD}───────────────────────────────────────────────────────${RESET}"
echo ""
