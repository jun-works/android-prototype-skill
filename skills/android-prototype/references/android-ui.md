# Making it feel like Android (Material 3)

What separates "an app screen" from "an Android app" is mostly structure and behaviour, not decoration.

## Contents
1. System frame & metrics
2. Navigation model
3. Which component when
4. Screen archetypes
5. iOS-isms and web-isms to remove
6. Korean-market notes

## 1. System frame & metrics

- Canvas 412×915dp (Pixel/Galaxy class). Status bar ~36dp on top, gesture area 24dp at the bottom; content is
  edge-to-edge behind them (the shell handles both).
- **Margins** 16dp on phones; 24dp inside sheets and dialogs. Spacing on a 4dp grid; most gaps are 8/12/16/24.
- **Touch targets** 48×48dp (icon buttons are 48 with a 24 icon). Minimum 40 for dense controls; chips are 32 high
  with spacing.
- **Type scale** (M3): display 57/45/36 · headline 32/28/24 · title 22/16/14 · body 16/14/12 · label 14/12/11.
  Body text is 14–16. Nothing below 11.
- Heights: top app bar 64 (medium 112, large 152) · list item 56/72/88 · bottom nav 80 · FAB 56 (r16) · buttons 40
  (56 for a prominent bottom CTA) · text field 56 · chip 32 · bottom-sheet top radius 28 · dialog radius 28.
- Icons: Material Symbols, 24dp, one style (Rounded in the shell). Filled = selected/active state, outlined = rest.

## 2. Navigation model

Decide this before drawing anything.

| Situation | Use |
|---|---|
| 3–5 equally important top-level destinations | **Bottom navigation bar** (the default for consumer apps) |
| 1 main destination + settings/profile | Single stack: home screen with avatar/settings icon in the app bar |
| 6+ destinations, rarely switched | Navigation drawer (avoid in new consumer apps) |
| Peer views of the same content (day/week/month, posts/media) | **Tabs** inside a screen, under the app bar |
| Linear task (sign-up, checkout, onboarding) | Full screens with a step indicator; bottom nav hidden |

Rules:
- Bottom nav appears **only on top-level destinations**. Detail screens push on top and hide it.
- Every pushed screen has `arrow_back` at the leading edge of the top app bar. System back always works too.
- Back from a non-start tab returns to the start tab, then exits.
- Tapping the current tab again scrolls to top / resets (nice touch, optional).
- Labels on bottom nav are short nouns (식물 · 일정 · 기록 · 내 정보). Always show labels.

## 3. Which component when

| Need | Android answer | Not |
|---|---|---|
| The single most common create action | **FAB** bottom-right (extended FAB with label when the action needs a word) | A "+" in the top bar only |
| Choose from options / quick edit / filters in context | **Modal bottom sheet** | Centred popup, iOS action sheet |
| Confirm a destructive or blocking decision | **Dialog**: title as a question, 1–2 text buttons right-aligned ("취소" "삭제") | Bottom sheet, toast |
| Tell the outcome of an action | **Snackbar** at the bottom, with Undo for reversible actions | Dialog "저장되었습니다! 확인" |
| Overflow actions for a screen | `more_vert` → **menu** | A hamburger |
| Filter a list | **Filter chips** row under the app bar | A modal with checkboxes for 2–3 options |
| Switch between 2–3 views | **Segmented button** or tabs | Two big toggle buttons |
| On/off setting | **Switch** at the trailing edge of a list row | Checkbox for instant-apply settings |
| Search | **Search bar** (pill, 56dp) at the top of a list screen, or a search icon that opens a search screen | A tiny text input |
| Primary action at the end of a form/detail | Full-width filled button in a `.bottom-bar` (56dp) | A floating button that covers content |
| Loading | Skeleton blocks or a linear progress at the top | A full-screen spinner for <1s waits |
| Nothing yet | **Empty state**: icon/illustration, one sentence, one action | A blank list |

## 4. Screen archetypes

- **Feed / list home** — large or small top app bar · optional search bar · filter chips · list or cards · FAB.
- **Dashboard home** — only when the core job is monitoring numbers. Lead with the one number that matters, not a
  grid of six equal stat cards.
- **Detail** — back arrow + title (or transparent bar over a header image) · key facts first · sections with
  `.section-title` · primary action in a bottom bar.
- **Create / edit** — full-screen form with close (`close`) on the leading edge and "저장" as a text/filled button on
  the trailing edge, or a bottom sheet for ≤3 fields.
- **Settings** — grouped list rows, switches trailing, section titles, no cards.
- **Onboarding** — 1–3 screens max, each with one message and one action; skip in the top-right.

## 5. iOS-isms and web-isms to remove

- Centre-aligned titles on every screen (Android: leading-aligned small app bar; centre only for brand root screens).
- "‹ Back" or "< 이전" text; chevron-left icon instead of `arrow_back`.
- Tab bar with only colour change on the active icon (Android: active indicator pill + filled icon + bold label).
- iOS switch styling, grouped inset tables with rounded sections everywhere, swipe-left-only delete with red "Delete".
- Action sheets that list options with a separate "Cancel" block at the bottom (Android: bottom sheet, dismiss by scrim/back).
- Large rounded "pill" text fields with an iOS search look on every input (Android fields: filled or outlined, floating label).
- Web-isms: hover-only affordances, hyperlinks styled as underlined text for primary actions, footer, breadcrumbs,
  modals with an "×" in the corner, toasts in the top-right.

## 6. Korean-market notes

When the users are Korean, borrow the conventions they expect from apps they use daily (Toss, 당근, 카카오, 배민,
네이버) — without copying any brand's look:
- Copy is short and polite-casual (해요체): "식물을 추가했어요", "삭제할까요?". Buttons are verbs: "저장", "다음", "확인".
- Numbers: `12,800원`, dates `10월 14일 (화)`, relative times `3분 전`, `D-3`.
- Big bottom CTA buttons on flows are common and welcome (full-width, 56dp).
- Bottom nav is near-universal; 4–5 tabs with short labels.
- Fonts: Noto Sans KR, IBM Plex Sans KR, Nanum Gothic, Gothic A1, Gowun Dodum (friendly), Do Hyeon/Black Han Sans
  (display only). Pretendard is common in real apps but isn't on Google Fonts; use it only if the user provides it.
