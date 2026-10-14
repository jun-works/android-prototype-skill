# Visual directions

The checkpoint is only useful if the directions are genuinely different and each one is *about* the product. Three
recolours of the same layout is not a choice; it's a delay.

## Contents
1. What a direction is
2. The axes (pick a different position on several)
3. Starter archetypes
4. Colour with `proto.py palette`
5. Typography (Latin + Korean pairings on Google Fonts)
6. Shape, density, imagery
7. Anti-generic moves
8. Self-test before the board

## 1. What a direction is

A direction is a **thesis** in one line that ties a visual decision to the brief:
> "B · 노트북 — 종이 같은 따뜻한 배경, 세리프 제목, 손글씨 같은 체크 표시: 기록을 '쓰는' 느낌" 

It sets: colour strategy, type voice, shape language, density, imagery, and the **composition** of the key screen
(what's biggest, what's first, how content is grouped). Two directions must differ on at least three axes,
including composition or density — not just hue.

## 2. The axes

| Axis | Range |
|---|---|
| Colour strategy | Neutral + one sharp accent · tonal (tinted surfaces) · bold colour-blocked surfaces · dark-first · monochrome + semantic colours only |
| Type voice | Neutral grotesk · humanist/warm · geometric · editorial serif headlines · rounded/friendly · condensed/sporty · mono accents for data |
| Shape | Sharp (4dp) · soft (12–16) · pill/full · mixed (round buttons, square cards) |
| Density | Airy (big type, few items) · balanced · dense/utility (more rows, smaller cards) |
| Composition | List-first · hero-number-first · card grid · timeline · map/canvas-first · conversational |
| Imagery | None (type + icons) · tonal `.media` blocks with symbols · simple geometric illustration (inline SVG) · photos (only if content is photos) |
| Elevation | Flat with outlines · tonal surfaces (M3 default) · shadows |

## 3. Starter archetypes

Use as springboards, then bend toward the brief. Mix and rename.

- **Calm utility** — neutral surfaces, one accent, Roboto Flex/IBM Plex, sharp-ish 8dp, list-first, dense. Good for
  tools, finance, productivity.
- **Warm editorial** — off-white/paper surfaces, serif headlines (Noto Serif KR, Gowun Batang, Fraunces, Newsreader),
  generous spacing, thin outlines, almost no shadows. Good for journaling, reading, food, wellness.
- **Bold colour-block** — large surfaces in the primary/tertiary containers, big display numbers, pill shapes,
  confident type (Gothic A1 Black, Archivo, Space Grotesk). Good for fitness, social, youth.
- **Playful soft** — rounded type (Gowun Dodum, Nunito, Jua for display), 20–28dp radii, tertiary colour pops,
  illustrated empty states. Good for kids, pets, habits, casual games.
- **Dark focus** — dark-first theme, high-contrast accent, mono numbers (JetBrains Mono, IBM Plex Mono). Good for
  audio, night use, dev tools, trading.
- **Map/canvas-first** — the content (map, camera, calendar grid) owns the screen; UI floats in sheets and chips.
  Good for local, travel, delivery, scheduling.

## 4. Colour with `proto.py palette`

```bash
proto.py palette --seed "#2f6b4f" --write directions/a.src.html --name "a-forest"           # tonal (default)
proto.py palette --seed "#ff5a1f" --style vibrant --write directions/b.src.html --name "b-ember"
proto.py palette --seed "#3a3a3a" --style muted --tertiary-hue 25 --write directions/c.src.html # neutral + warm accent
proto.py palette --seed "#0064ff" --exact --write app.src.html                                  # brand colour exactly as primary
```
It generates every M3 role at fixed tones (CIE L*) so text/background pairs keep contrast. Options:
`--secondary-hue`, `--tertiary-hue` / `--tertiary-shift` (default +60°), `--neutral-chroma` (0 = pure grey surfaces,
6–10 = noticeably tinted), `--dark` (also emits `:root.dark`).

Choosing a seed: derive it from the product, not from habit. Plants → leaf/soil, finance trust → ink/navy or a
confident unexpected colour, food → appetite (tomato, saffron), sleep → night blues, kids → primary-ish pops.
**Avoid the defaults** (indigo #6366f1, violet #8b5cf6, M3 #6750a4, generic #2196f3) unless you can argue for them.
After generating, you can still override single roles in the `@brand` block (e.g. a warmer `--surface`).

Use colour by role: `primary` for the main action and selection, `*-container` for large tinted areas, `tertiary` for
a contrasting accent (badges, highlights), `surface-container-*` to group without shadows. One accent used sparingly
reads as designed; five colours used evenly reads as random.

## 5. Typography

Set `--font-display` (headlines, titles, big numbers) and `--font-body` (everything else) in `@brand`, and add the
Google Fonts `<link>`. Always include a Korean family in the stack when the UI is Korean — Latin-only fonts fall back
to a mismatched system font for Hangul.

| Voice | Display | Body |
|---|---|---|
| Neutral modern | "Roboto Flex", "Noto Sans KR" | same |
| Technical / precise | "IBM Plex Sans KR" | "IBM Plex Sans KR"; numbers in "IBM Plex Mono" |
| Editorial / warm | "Noto Serif KR" or "Gowun Batang" | "Noto Sans KR" |
| Friendly / soft | "Gowun Dodum" or "Jua" (display only) | "Gowun Dodum" / "Noto Sans KR" |
| Bold / sporty | "Gothic A1" 800–900, "Black Han Sans" (display only) | "Gothic A1" |
| Latin-only apps | Fraunces · Space Grotesk · Archivo · DM Serif Display · Instrument Serif | Inter Tight · DM Sans · Manrope · Public Sans |

Example link: `https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=block`

Type does a lot of the direction's work: a display size jump (e.g. a 45dp number on a dashboard, a 32dp serif title)
creates hierarchy more convincingly than cards and colour. Use `.num` for tabular numbers.

## 6. Shape, density, imagery

- Shape: set `--btn-radius --card-radius --sheet-radius --fab-radius` together. Sharp UI = 4–8, soft = 12–16, pill = full.
- Density: change list item heights, card padding and type sizes together. Dense ≠ cramped: keep 48dp targets.
- Imagery: `.media[data-icon]` tonal blocks with a symbol, or simple inline SVG shapes in theme colours. If the
  product is about photos (restaurants, places, outfits), use a consistent photo treatment only if you have
  appropriate images; otherwise tonal blocks are more honest than mismatched stock photos.

## 7. Anti-generic moves

When a screen starts looking like "an AI app", try one of these instead of adding more cards:
- Replace the greeting header with the most useful thing right now ("오늘 물 줄 식물 3개").
- Replace a stat-card grid with one big number + a compact list.
- Remove card containers; group with spacing, section titles and `surface-container` bands.
- Give one element a signature treatment that comes from the product (a progress ring that's a plant pot, a ticket
  stub shape for bookings, a receipt edge for expenses) and keep everything else quiet.
- Use the tertiary colour for exactly one thing.
- Write sharper copy. Specific labels make generic layouts feel specific.

## 8. Self-test before the board

- Could you tell the directions apart in greyscale thumbnails? If not, change composition/density/type.
- Can you say each thesis in one line that mentions the brief's users or adjectives?
- Does each still look Android (app bar, nav, FAB conventions)? Directions vary the voice, not the platform.
- Did each pass `proto.py check` with no errors?
