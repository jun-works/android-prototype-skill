# Working on this repo

This repo is the source of the `android-prototype` Claude Code skill. Edit the skill here; `tools/setup.sh` links
`~/.claude/skills/android-prototype` to `skills/android-prototype`, so changes apply immediately.

## Layout

| Path | What |
|---|---|
| `skills/android-prototype/SKILL.md` | The method Claude follows (modes, phases, red flags, message format) |
| `skills/android-prototype/references/` | Docs loaded on demand (signature moments, motion recipes, Android UI, components…) |
| `skills/android-prototype/assets/shell.css`, `shell.js` | Prototype runtime + layout auditor — every prototype depends on them, so test changes against `examples/` |
| `skills/android-prototype/scripts/proto.py` | CLI: new · palette · check · frames · board · build · audit · shots |
| `skills/android-prototype/examples/` | Worked examples. `_private*` entries are local links to a private repo — never commit them |
| `evals/evals.json` | Test prompts + assertions used to measure changes |
| `tools/setup.sh`, `tools/hooks/` | Machine setup and commit/push checks |

## Changing the skill

1. Snapshot the current skill folder somewhere outside the repo (the baseline for comparison).
2. Make the change. Keep `SKILL.md` lean; put detail in `references/`.
3. If you touched `shell.*` or `proto.py`, run the examples:
   `python3 skills/android-prototype/scripts/proto.py check skills/android-prototype/examples/umteum/app.en.src.html --out /tmp/shots`
   — expect 0 errors, and open the contact sheet and frames to look.
4. Run the evals: for each prompt in `evals/evals.json`, run the new skill and the snapshot side by side (the
   `skill-creator` skill automates this), grade against the assertions, and compare.
5. Update README numbers only from evals you actually ran.

## Before showing or publishing anything

- Render it and look at it at full size (screenshots, README previews). Check image aspect ratios.
- Never commit `skills/android-prototype/examples/_private*`. The hooks in `tools/hooks/` block it.
