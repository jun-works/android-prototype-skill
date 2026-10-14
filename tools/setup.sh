#!/bin/sh
# One-time setup on a Mac: install the skill into Claude Code from this repo.
# Optional: a private companion repo cloned next to this one (../android-prototype-private,
# or PRIVATE_DIR=/path) adds private examples, personal rules and extra commit checks.
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$REPO/skills/android-prototype"
PRIVATE="${PRIVATE_DIR:-$(dirname "$REPO")/android-prototype-private}"
CLAUDE_DIR="$HOME/.claude"

echo "repo:    $REPO"

# 1. Claude Code uses the skill straight from this repo (edits apply immediately)
mkdir -p "$CLAUDE_DIR/skills"
LINK="$CLAUDE_DIR/skills/android-prototype"
if [ -e "$LINK" ] && [ ! -L "$LINK" ]; then
  mv "$LINK" "$LINK.backup-$(date +%Y%m%d%H%M%S)"; echo "backed up existing skill folder"
fi
ln -sfn "$SKILL" "$LINK"
echo "skill:   $LINK -> $SKILL"

# 2. Commit/push safety checks (tracked in tools/hooks)
git -C "$REPO" config core.hooksPath tools/hooks
echo "hooks:   tools/hooks"

# 3. Private companion repo (optional)
if [ -d "$PRIVATE" ]; then
  echo "private: $PRIVATE"
  for d in "$PRIVATE"/examples/*/; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    ln -sfn "${d%/}" "$SKILL/examples/_private-$name"
    echo "         example linked as examples/_private-$name"
  done
  if [ -f "$PRIVATE/RULES.md" ]; then
    touch "$CLAUDE_DIR/CLAUDE.md"
    line="@$PRIVATE/RULES.md"
    grep -qxF "$line" "$CLAUDE_DIR/CLAUDE.md" || printf '\n%s\n' "$line" >> "$CLAUDE_DIR/CLAUDE.md"
    echo "         personal rules imported in ~/.claude/CLAUDE.md"
  fi
else
  echo "private: not found (optional) — skipping"
fi

# 4. Requirements
command -v python3 >/dev/null && echo "python3: $(python3 --version 2>&1)" || echo "python3: MISSING — install Python 3.8+"
if [ -d "/Applications/Google Chrome.app" ] || command -v google-chrome >/dev/null || command -v chromium >/dev/null; then
  echo "chrome:  found"; else echo "chrome:  MISSING — install Google Chrome"; fi
echo "done. Restart Claude Code to pick up the skill."
