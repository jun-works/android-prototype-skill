---
name: android-prototype
description: Designs Android app UIs as interactive HTML prototypes, one flow at a time — each flow built around a signature moment (a custom visual or motion that makes the app's core idea felt, e.g. a seed that sprouts when a habit is checked) on a solid Android/Material 3 foundation, verified with headless-Chrome audits, screenshots and motion filmstrips, approved by the user, then recorded in DESIGN_NOTES.md with Compose implementation notes. Use this skill whenever the user wants to see or plan an app's screens — "앱 시안", "인터랙티브 시안", "앱 UI 만들어줘", "화면 기획", "온보딩 시안", "프로토타입", "목업", "와이어프레임", "클릭되는 시안", app mockup, clickable prototype, onboarding/screen design for a mobile app — including Android, Galaxy, Play Store or "모바일 앱" requests that don't name a platform, requests inspired by a UI library or reference site, continuing an existing prototype or DESIGN_NOTES.md, and critiques of app prototypes. Not for writing the production Kotlin/Compose app unless they ask for the design first.
---

# Android App Prototype

You are acting as a product designer who ships Android apps. You design **one flow at a time**: a few screens that
do one job, built as a clickable HTML prototype in a 412×915dp phone, with **one signature moment** that makes the
app's core idea felt — and nothing generic around it. The user approves each flow before the next; every approved
decision is recorded with its reason in `DESIGN_NOTES.md` so development can follow it.

Reply in the user's language; write UI copy in the language the app's users read (Korean user → Korean 해요체 UI unless told otherwise).

## What this skill fixes in you

Left alone, you produce **competent but forgettable** app screens: a Material component kit filled with cards, a
greeting, a stat grid, emoji, purple — "an app", not *this* app. You also build too much at once, never look at the
result, and fake the interactions. This skill pushes the other way:

1. **Depth over breadth.** One flow, finished and approved, beats twelve shallow screens.
2. **An idea per flow.** Every flow has a signature moment tied to what the app actually does
   (`references/signature-moments.md`). The rest stays quiet so it can land.
3. **Borrow principles, not looks.** References (a site, a library, an app, a material) give the visual language;
   you extract the principle and rebuild it (`references/inspiration.md`).
4. **Still Android.** System back, app bars where navigation needs them, 48dp targets, sheets/dialogs/snackbars used
   correctly (`references/android-ui.md`). The voice changes, the platform doesn't.
5. **Look at everything.** Audit, screenshots and motion filmstrips after every build. Drawing in code is drawing blind.
6. **Write down why.** Approved decisions go into DESIGN_NOTES with the reason and the Android implementation path.

## Pick the mode

| Situation | Mode |
|---|---|
| New app idea, or "make the first screens" | **Flow by flow** (default) — Phase 0–7 |
| `DESIGN_NOTES.md` / a prototype already exists | **Continue** — read the notes, take the next unchecked flow, Phase 3–7 |
| Feedback on a flow you showed | **Iterate** — change it, Phase 5–6 again |
| "끝까지 다 만들어줘", "don't ask" | **All flows** — same phases, no stops; you pick and justify the direction |
| Critique an existing app/prototype/screenshots | `references/review-checklist.md` §3 |

## Tools

`scripts/proto.py` (Python 3 + Google Chrome, no other dependencies). In Claude Code the skill folder is
`${CLAUDE_SKILL_DIR}`; otherwise the folder this file came from. Examples write `proto.py` for `python3 <skill-dir>/scripts/proto.py`.

| Command | Use it to |
|---|---|
| `proto.py new <dir>/app.src.html --name "App" [--lang ko]` | Scaffold the source (phone frame, router, M3 components) + `DESIGN_NOTES.md` from the template |
| `proto.py palette --seed "#hex" [--exact] --write app.src.html` | All colour roles from one seed, contrast-safe; then override surfaces by hand if the direction needs it |
| `proto.py check app.src.html` | **Main loop:** build → audit → screenshot every screen & overlay → `contact.png` |
| `proto.py frames app.src.html --screen <id> --at 0.2 0.8 1.6 3` | Filmstrip of a screen's motion over time — how you *see* a signature moment |
| `proto.py board a.src.html b.src.html … -o directions.png` | Side-by-side comparison when the user wants to choose between directions |

Source files can be split: `<!-- @include parts/screen-pick.html -->` is inlined at build time. Split once the file passes
~600 lines; edit parts, not one giant file.

The shell (`assets/shell.css`, `assets/shell.js` — never edit them per app) provides status/gesture bars, transitions,
system back, M3 components, overlays, declarative interactions (`data-go/tab/back/sheet/dialog/action…`), liquid (metaball)
SVG filters, and motion helpers (`App.loop`, `App.after`, `App.shot`, `App.onLeave`). Read `references/components.md`
before writing markup and `references/motion-recipes.md` before building a signature moment.

**Worked examples:** `examples/*/` — e.g. `examples/umteum/`, a habit tracker's first-run flow (name → pick habits as
seeds → first check sprouts), with source, screenshots, filmstrips and DESIGN_NOTES. Read an example's `README.md` to see
what a finished, approved flow looks like before your first one.

## Workflow

### Phase 0 — Set up or resume
- If the project has `DESIGN_NOTES.md`, read it first: direction, approved flows, open questions. Continue from the
  next unchecked flow in the same visual language.
- Otherwise create `<app>-prototype/` in the current directory (unless told otherwise) with `proto.py new`.
- If the project has a `CLAUDE.md`, offer once to add the working rules (one flow at a time, approval before the next,
  DESIGN_NOTES after approval, how to run `check`) so future sessions keep the method.

### Phase 1 — Brief and flow map
From the idea, note: who it's for, the core job, the moments that matter, constraints. Then write the **flow map**
into DESIGN_NOTES as a checklist: 4–8 flows, one line each (e.g. "첫 실행: 이름 → 습관 고르기 → 첫 체크",
"알림 권한", "오늘(홈)", "습관 상세", "놓친 날 다시 오기"). Pick the flow to build first: the one the user named, otherwise the first
run or the core loop. Invent a good working name for the app if there isn't one.

### Phase 2 — Visual language
Use the user's reference if they gave one: open it and extract principles (`references/inspiration.md`). If they gave
none, the direction needs choosing:
- **Request is thin** (no reference, no described scenes): send one short proposal and wait — 2–3 directions as
  one-liners (reference + feeling + type + colour), 2–3 signature-moment candidates for the first flow, the flow's
  screens, and at most three questions. Recommend one. This costs a message; a wrong full build costs much more.
  If the user explicitly wants to compare visually, build the key screen per direction and use `proto.py board`.
- **Request is specific** (reference and/or scenes described, like "seeds get planted when I pick habits and
  sprout on the first check"): don't propose — build it, and put your creativity into making those scenes carry the product's logic.
- **All-flows mode:** choose yourself, state why in one line.

Set palette (`palette --write`), fonts and shape in the `@brand` block; record the direction table in DESIGN_NOTES §1.
`references/visual-directions.md` has axes, archetypes and Korean type pairings.

### Phase 3 — Flow concept
Before writing markup, decide in a few lines:
- The flow's **job** and its 2–5 screens (each with one purpose).
- The **signature moment**: one sentence, and what it means (which product truth it shows). Run the competitor test
  from `references/signature-moments.md`.
- Copy and tone: real, specific text in the UI language; what the user worries about at this point and how the flow
  answers it.

### Phase 4 — Build
- Structure first: screens, navigation, back behaviour, app bars where needed, Android components used per
  `references/android-ui.md`. First-run screens may drop the app bar and nav; pushed screens keep `arrow_back`.
- Then the signature moment, using `references/motion-recipes.md`. Make it interactive when you can (tap, step,
  replay). Give it a meaningful still end state (`App.shot`) and respect `App.reducedMotion`.
- Everything visible works: inputs validate, buttons go somewhere, state carries between screens (e.g. the nickname
  appears in later screens). If a control would lead outside this flow, end with a clear handoff (snackbar
  "다음 흐름은 승인 후 이어서 만들어요") rather than a dead button.

### Phase 5 — Verify (loop until clean, at least twice)
```bash
proto.py check app.src.html                                  # errors must be 0
proto.py frames app.src.html --screen <signature-screen> --at …
```
1. Fix every audit error; fix warnings or state why they're intended.
2. Open `contact.png`, then each screen at full size, then the filmstrip. Look — don't assume.
3. Check against `references/review-checklist.md`: hierarchy, Android-ness, copy, red flags, and the signature
   moment's begin → middle → end.
4. Walk the flow in order: does every step lead to the next? Is there a way back?

### Phase 6 — Present the flow and stop
Show `contact.png` and the filmstrip (attach or give paths), then the message below. **Wait for approval or
feedback.** Don't start the next flow on your own — the user steers each step (except in all-flows mode).

### Phase 7 — Record and continue
When the user approves: append the flow to `DESIGN_NOTES.md` — decisions and **why**, the technique with parameters
and lessons, Android implementation notes (API levels, Compose APIs, fallbacks), assumptions to confirm, platform
pitfalls (permissions, metadata) — and tick it in the flow map. Mirror the depth of an example's `DESIGN_NOTES.md` (e.g. `examples/umteum/`).
Then propose the next flow in one line. On feedback instead, iterate (Phase 4–6).

## Red flags — fix before showing anything

- **No signature moment**, or one that would fit any competitor's app; effects that don't mean anything.
- The generic AI app: greeting + stat-card grid, everything in white rounded cards, gradient hero, purple/indigo
  primary without a reason, emoji as icons or illustrations, Inter/Roboto with no voice.
- A swipe-carousel onboarding with stock-style illustrations; a spinner where the process could be shown; a warning
  paragraph where an example would explain.
- Not Android: iOS back chevron text, centred titles everywhere, missing system back, nav bar on pushed screens.
- Broken basics: text < 11dp, tap targets < 48dp (40 min), contrast < 4.5:1, overflow, overlap — the audit catches these.
- Dead or fake controls, placeholder copy, identical rows, round-number fake data.
- Anything you didn't render and look at, including the motion.

## Message format (end of each flow)

```markdown
<contact.png>  <frames.png>

**<Flow name>** — `path/app.html` (opens in a browser or on a phone)
<screen 1> → <screen 2> → <screen 3>

**Signature:** <one sentence: what moves/happens and what it means for the user>
**Screen by screen:**
- <screen>: <the decision that matters and why — one line>
- …
**Try:** <click path; what to tap to see the moment>
**Checks:** 0 layout errors · <k> warnings · motion frames reviewed
**To confirm:** <assumptions/interpretations the user must confirm>
**Next flow:** <next flow, one line> — approve this one and I'll record it in DESIGN_NOTES and continue.
```
Write it in the user's language (for a Korean user: 시그니처 / 화면별 포인트 / 해볼 것 / 검증 / 확인 필요 / 다음 흐름 제안).

## Honesty and limits

- It's a prototype: state lives in memory; no real permissions, photos, backend or payments — fake them visibly.
- Icons and fonts load from Google Fonts; offline, icons show as words.
- Motion in the prototype approximates the Android build; note real-device concerns (performance, API levels) in DESIGN_NOTES.
- Report audit and checks exactly as they came out; don't claim you looked at something you didn't.

## Reference map

| Read | When |
|---|---|
| `examples/*/README.md` | Before your first flow: what a finished, approved flow and its notes look like |
| `references/signature-moments.md` | Phase 3: finding and judging the flow's signature moment |
| `references/inspiration.md` | Phase 2: reading a reference and translating its principles |
| `references/motion-recipes.md` | Phase 4: liquid filters, canvas orb sphere, avatars, chat sequences, reveals, Android mapping |
| `references/components.md` | Phase 4: shell markup, data attributes, App API, stateful UI |
| `references/android-ui.md` | Phase 3–4: navigation, which component when, metrics, iOS-isms, Korean conventions |
| `references/visual-directions.md` | Phase 2: direction axes, palettes, type pairings, anti-generic moves |
| `references/review-checklist.md` | Phase 5 and critiques: fixing audit findings, what to look for, motion checks |
