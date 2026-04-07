#!/usr/bin/env bash
# sync-check.sh — BusinessOS PM mid-session sync check
# Run any time during a session: ! bash .claude/hooks/sync-check.sh
# Shell alias: prcheck (defined in ~/.zshrc)

BOLD='\033[1m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}── Mid-Session Sync Check ─────────────────────────────${RESET}"

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
    echo -e "  ${YELLOW}⚠  ${AHEAD} commit(s) ahead, ${BEHIND} behind origin/${BRANCH} — consider rebase${RESET}"
  elif [ "$AHEAD" -gt 0 ]; then
    echo -e "  ${YELLOW}↑  ${AHEAD} unpushed commit(s)${RESET}"
  elif [ "$BEHIND" -gt 0 ]; then
    echo -e "  ${RED}↓  BEHIND by ${BEHIND} commit(s) — run: git pull${RESET}"
  else
    echo -e "  ${GREEN}✅ Up to date with origin/${BRANCH}${RESET}"
  fi
else
  echo -e "  ${YELLOW}(no remote tracking branch for ${BRANCH})${RESET}"
fi

# ── 3. Uncommitted changes ───────────────────────────────────────────────────
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠  ${UNCOMMITTED} uncommitted change(s) in working tree${RESET}"
else
  echo -e "  ${GREEN}✅ Working tree clean${RESET}"
fi

# ── 4. Stale remote branches ─────────────────────────────────────────────────
STALE=$(git branch -r --merged origin/main 2>/dev/null \
  | grep -v "origin/main\|origin/HEAD" \
  | wc -l | tr -d ' ')
if [ "$STALE" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠  ${STALE} remote branch(es) merged into main but not yet deleted${RESET}"
else
  echo -e "  ${GREEN}✅ No stale remote branches${RESET}"
fi

# ── 5. Tasks assigned to @eric ───────────────────────────────────────────────
TASKS_FILE="docs/TASKS.md"
if [ -f "$TASKS_FILE" ]; then
  TASK_LINES=$(grep '\[@eric\]' "$TASKS_FILE" 2>/dev/null | grep -v '^\s*`\|^Example' || true)
  ERIC_OPEN=$(echo "$TASK_LINES" | grep -c '^- \[ \]' || true)
  ERIC_TOTAL=$(echo "$TASK_LINES" | grep -c '\[@eric\]' || true)
  echo -e "  Tasks for @eric: ${BOLD}${ERIC_OPEN} open${RESET} (${ERIC_TOTAL} total assigned)"
fi

echo -e "${BOLD}───────────────────────────────────────────────────────${RESET}"
echo ""
