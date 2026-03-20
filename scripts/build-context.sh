#!/bin/bash
# build-context.sh — Build SHARED_CONTEXT.md for Claude.ai Projects
# Run after session closeout: ./scripts/build-context.sh
# Individual plan workaround — upload output to your Claude.ai Project

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="$PROJECT_ROOT/SHARED_CONTEXT.md"

echo "Building shared context for BusinessOS PM..."

cat > "$OUTPUT" << HEADER
# SHARED_CONTEXT.md — BusinessOS PM
# Generated: $(date '+%Y-%m-%d %H:%M')
# Upload to your Claude.ai Project to sync context across team members.
---
HEADER

FILES=(
  "docs/CONTEXT.md"
  "docs/TASKS.md"
  "docs/HANDOFF.md"
  "docs/ACTIVE_WORK.md"
  "docs/PRODUCT_ROADMAP.md"
  "docs/PROMPT_LIBRARY.md"
  "docs/TROUBLESHOOTING.md"
  "docs/SUPABASE.md"
)

for f in "${FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$f" ]; then
    echo "" >> "$OUTPUT"
    echo "---" >> "$OUTPUT"
    echo "## SOURCE: $f" >> "$OUTPUT"
    echo "---" >> "$OUTPUT"
    cat "$PROJECT_ROOT/$f" >> "$OUTPUT"
    echo "  included: $f"
  fi
done

SIZE=$(wc -c < "$OUTPUT")
echo ""
echo "Done. SHARED_CONTEXT.md (${SIZE} bytes)"
echo "Next: upload to your Claude.ai Project"
