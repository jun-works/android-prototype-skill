# Review checklist

Use after every `proto.py check` (Phase 5) and in Critique mode. The audit measures; this list is for what only
looking can judge. Open `contact.png` first for the system view, then individual shots for detail.

## 1. Fixing audit findings

| Finding | Usual cause → fix |
|---|---|
| `text-overflow` / `spills-off-screen` | Fixed widths, `white-space:nowrap` on long copy, rows without `min-width:0`. → Let it wrap, use `.ellipsis` deliberately, shorten copy, or give the flex child `min-width:0`. |
| `text-clipped` / `text-clipped-v` | Fixed height + overflow hidden. → Remove fixed height or use `.clamp-2` (intentional, shows ellipsis). |
| `text-overlap` | Absolute positioning, negative margins, a badge/label placed on text. → Return to flow layout; mark intentional overlaps with `data-overlap-ok`. |
| `text-covered` | FAB/bottom bar over content, sticky header over text. → Add bottom padding to `.content` (e.g. `padding-bottom:88px` when a FAB exists), move the element, or shorten the list. |
| `low-contrast` | `--on-surface-variant` on a container, white on a light container, coloured text on colour. → Use the matching `on-*` role; put text on `surface`; darken the role in `@brand`. |
| `small-tap-target` | Icon without `.icon-btn`, text-only links, 32dp buttons. → Use `.icon-btn`/`.btn`; pad the hit area. |
| `dead-control` | Decorative buttons, rows without `data-go`. → Wire it (navigate, sheet, action, snackbar) or make it a non-button element. For JS-wired listeners add `data-js`. |
| `todo-control` | `data-todo` placeholder. → Build it or remove it. |
| `unreachable-screen` | Navigation done in JS, or forgotten link. → Add `data-go`, or declare with `data-links` on the element whose action navigates. |
| `no-up-button` | Pushed screen without back. → `icon-btn` with `arrow_back` + `data-back` in the app bar (or `data-no-up` if truly intended, e.g. onboarding). |
| `broken-link` | Typo in an id. |
| `emoji` / `placeholder-copy` | → Material Symbols / real copy. |
| `theme-unset` / `purple-primary` | → Run `palette --write`; pick a seed from the product. |
| `icon-font-missing` / `font-missing` | Offline, or wrong family name in the stack vs. the `<link>`. |
| `js-error` | Fix it; open the built HTML in a browser to see the console if the message isn't enough. |

## 2. Look at the screenshots

**System (contact sheet)**
- Do all screens look like the same app? Same app bar style, margins, radii, icon weight, type sizes.
- Is there visual rhythm, or is every screen a stack of identical cards?
- Is the primary colour used sparingly and consistently for the same meaning?
- Do top-level screens show the bottom nav and pushed screens not?

**Each key screen**
- **Hierarchy**: in one second, what's the most important thing? Is it the biggest/strongest element? Is there one
  clear primary action?
- **Alignment**: one left edge (16dp margin); icons and text baselines aligned in rows; nothing 2px off.
- **Spacing**: consistent gaps from the 4/8/12/16/24 scale; related things closer than unrelated things; no
  cramped blocks next to empty voids.
- **Typography**: ≤2 families; sizes from the scale; enough contrast between levels (title vs body); no orphan
  single words in headings where avoidable; numbers tabular.
- **Content**: realistic, varied, in the UI language; long-content case shown somewhere.
- **Android-ness**: leading-aligned titles, `arrow_back`, active-indicator pill in nav, FAB position, sheets/dialogs/snackbars
  used per `android-ui.md`.
- **States**: is there an empty state, a success feedback, an error path?
- **Red flags** from SKILL.md — go through the list literally.
- **Not generic**: would this screen look the same in any other app? If yes, what's the one thing to make it this app's?

**Signature moment** (screenshot + `proto.py frames` filmstrip)
- Does it pass the competitor test — is it tied to what *this* app does?
- Does the motion have a clear beginning → middle → end, and does each phase map to something true (a step, a rule, a state)?
- Is the still end state meaningful on its own (screenshots, reduced motion)?
- Is text readable in every frame? Nothing pops in unannounced, nothing jitters?
- Is everything around it quiet enough to let it land?

**Flow**
Walk the flow's screens in order. Every step needs a visible control that leads to the next, a result that shows the
action worked, state that carries over (names, choices), and a way back.

**Content**
Real, specific copy in the UI language (해요체 for Korean users); verbs on buttons; the one sentence that matters
emphasised; realistic, varied data (names, dates relative to today, `12,800원`, `3분 전`); one long-content case.
No "Lorem", "제목", "Item 1", identical rows or round-number fake data.

## 3. Critique mode (someone else's prototype/screenshots)

Structure the answer:
1. What works (2–3 specific points).
2. Problems ranked by impact, each with *where*, *why it matters for the user*, and *the fix* — group under
   Navigation & structure / Hierarchy & layout / Visual system / Content / Android conventions / Accessibility.
3. If you have the HTML, run `proto.py audit` on it (it works on any page that uses the shell; for other HTML,
   screenshot it with Chrome and judge visually) and include the measurable findings.
4. Offer to produce a revised prototype.
