# Shell components & interaction API

Everything here is provided by `assets/shell.css` + `assets/shell.js`. Use these classes first; add app-specific CSS in
the `<style id="app">` block only for what the shell doesn't cover. 1px = 1dp.

## Contents
1. File anatomy
2. Screens, app bars, navigation
3. Declarative interactions (`data-*`)
4. App API and stateful UI (lists that really add/delete/filter)
5. Component markup
6. Tokens you can use in app CSS
7. Gotchas

## 1. File anatomy

```
<html lang="ko" data-theme="<direction name>">        ← data-theme is set by `palette --write`; audit warns if UNSET
<head>  Google Fonts links  ·  <link data-shell>  ·  <style id="theme"> @theme + @brand blocks  ·  <style id="app">
<body><div class="stage"><div class="device">
   <div class="screens">  <section class="screen" id="…">…</section> …  </div>
   <nav class="nav-bar" data-for="home,saved,me">…</nav>      ← optional, shared by top-level screens
   <div class="overlays">  .sheet / .dialog / .menu  </div>
</div></div>
<script data-shell>  ·  <script id="app-js"> your App.state / App.actions / App.onEnter </script>
```
Status bar, gesture bar, scrim and snackbar are injected automatically. Set the clock with `<div class="device" data-time="9:41">`.

## 2. Screens, app bars, navigation

```html
<section class="screen" id="home" data-start data-title="홈">        <!-- data-start: first screen (default: first in file) -->
  <header class="top-app-bar">                                     <!-- small: title left-aligned (the Android default) -->
    <h1 class="title">오늘</h1>
    <div class="actions">
      <button class="icon-btn" data-go="search" aria-label="검색"><span class="ms">search</span></button>
      <button class="icon-btn" data-menu="home-menu" aria-label="더보기"><span class="ms">more_vert</span></button>
    </div>
  </header>
  <div class="content"> … scrolls … </div>                           <!-- exactly one .content per screen -->
  <button class="fab" data-sheet="new-plant" aria-label="식물 추가"><span class="ms">add</span></button>
</section>

<section class="screen" id="plant" data-title="식물 상세">           <!-- pushed screen: needs a back button -->
  <header class="top-app-bar">
    <button class="icon-btn" data-back aria-label="뒤로"><span class="ms">arrow_back</span></button>
    <h1 class="title">몬스테라</h1>
  </header>
  <div class="content">…</div>
  <div class="bottom-bar"><button class="btn block lg" data-action="water">물 줬어요</button></div>  <!-- sticky bottom action -->
</section>
```
App bar variants: `.top-app-bar.center` (centre title — only for a root screen with brand wordmark), `.medium`, `.large`
(collapsing-style big title for top-level screens with lists). The bar tints automatically when its `.content` scrolls.

Screen options: `data-status="light"` (white status icons over dark/photo headers) · `style="--screen-bg:var(--surface-container-low)"`
(screen background) · `data-no-up` (pushed screen with intentionally no back button, e.g. onboarding).

**Bottom navigation** — shown only on the screens in `data-for`; tapping switches tab with a fade-through:
```html
<nav class="nav-bar" data-for="home,calendar,me">
  <button class="nav-item" data-tab="home"><span class="pill"><span class="ms">potted_plant</span></span>식물</button>
  <button class="nav-item" data-tab="calendar"><span class="pill"><span class="ms">calendar_month</span><span class="badge">3</span></span>일정</button>
  <button class="nav-item" data-tab="me"><span class="pill"><span class="ms">person</span></span>내 정보</button>
</nav>
```
Back behaviour (matches Android): back closes the top overlay → pops the stack → from a non-start tab returns to the
start tab → at the start screen shows "back would exit" snackbar.

## 3. Declarative interactions

Put these on any element (usually `button`). Several can be combined; they run in this order:
segmented select → `data-action` → `data-chip` → `data-panel` → `data-toggle` → `data-close` → `data-snack`/`data-todo`
→ navigation (`data-back` / `data-tab` / `data-go` / `data-sheet` / `data-dialog` / `data-menu`).
If `App.actions.x` returns `false`, the rest is skipped (use it for validation).

| Attribute | Effect |
|---|---|
| `data-go="id"` | Push screen (slide). If both current and target are tab roots → acts like `data-tab` |
| `data-tab="id"` | Switch top-level destination (resets stack) |
| `data-back` | System back |
| `data-sheet="id"` / `data-dialog="id"` | Open bottom sheet / dialog |
| `data-menu="id"` | Open dropdown menu anchored to this element |
| `data-close` | Close the top overlay |
| `data-action="name"` | Call `App.actions.name(el, event)` |
| `data-snack="text"` (+ `data-snack-action="실행취소"` `data-snack-do="actionName"`) | Show snackbar |
| `data-chip` | Toggle `.selected`; inside `[data-single]` only one stays selected |
| `data-panel="panelId"` | Tab inside a screen: activates this `.tab`, shows `#panelId` and hides sibling `.tab-panel`s |
| `data-toggle="#selector"` (+ `data-toggle-class="x"`) | Toggle `hidden` (or the class) on targets; without selector toggles self |
| `data-links="id1,id2"` | Declares navigation your JS performs (so the audit's reachability check knows) |
| `data-js` | Marks a control wired with `addEventListener` in your JS (so the audit doesn't call it dead) |
| `data-todo="text"` | Placeholder snackbar. The audit flags it — avoid in deliverables |

Forms: `<form data-action="save" data-back>` — on submit the shell validates required/pattern/type fields, marks
`.field.error`, focuses the first bad field, and only then runs the action and navigation. `data-go` / `data-snack` work too.

## 4. App API and stateful UI

```js
App.go(id) App.tab(id) App.back() App.reset(id)          // navigation
App.sheet(id) App.dialog(id) App.menu(id, anchorEl) App.close() App.closeAll()
App.snack(text, actionLabel?, fnOrActionName?)
App.state                                                 // your data
App.actions.name = function (el, event) { … }             // called by data-action
App.onEnter('screenId', function (screenEl) { … })        // runs every time the screen is shown (render here)
App.ready = function () { … }                             // runs once at boot, before the first screen shows
App.onLeave('screenId', fn)                               // runs when the screen is left (stop timers)
App.loop('screenId', function (dt, t) { … })              // rAF loop only while the screen shows → {start, stop}
App.after(ms, fn)                                         // setTimeout that runs at once in still screenshots
App.shot · App.reducedMotion · App.mode                   // 'live' | 'film' | 'shot' | 'audit'
```
Modes: `?shot=1` / audit render **still frames** (`html.still`: CSS animations at their end state, `App.after` immediate);
`?film=<s>` (used by `proto.py frames`) runs real motion on one clock frozen at `<s>` seconds. See `motion-recipes.md`.

**Pattern: render from state** — this is what makes add/delete/filter real. Keep a render function per list, call it
from `App.ready`, from `onEnter`, and after every mutation.
```js
App.state.plants = [
  { id: 'p1', name: '몬스테라', room: '거실', every: 7, last: '2026-10-08', icon: 'potted_plant' },
  { id: 'p2', name: '스투키', room: '침실', every: 21, last: '2026-09-30', icon: 'grass' },
];
App.state.filter = 'all';
function renderPlants() {
  var list = document.getElementById('plant-list');
  var rows = App.state.plants.filter(function (p) { return App.state.filter === 'all' || p.room === App.state.filter; });
  list.innerHTML = rows.map(function (p) {
    return '<button class="list-item two" data-go="plant" data-action="openPlant" data-id="' + p.id + '">' +
      '<span class="avatar"><span class="ms">' + p.icon + '</span></span>' +
      '<span class="body"><span class="headline">' + p.name + '</span><span class="supporting">' + p.room + ' · ' + p.every + '일마다</span></span>' +
      '<span class="trail">D-' + daysLeft(p) + '</span></button>';
  }).join('');
  document.getElementById('plant-empty').hidden = rows.length > 0;     // empty state
}
App.actions.openPlant = function (el) { App.state.current = el.getAttribute('data-id'); };   // then data-go navigates
App.onEnter('plant', function (s) { var p = find(App.state.current); s.querySelector('.title').textContent = p.name; /* … */ });
App.actions.deletePlant = function () {
  var gone = find(App.state.current), i = App.state.plants.indexOf(gone);
  App.state.plants.splice(i, 1); App.close(); App.back(); renderPlants();
  App.snack(gone.name + ' 삭제됨', '실행취소', function () { App.state.plants.splice(i, 0, gone); renderPlants(); });
};
App.ready = renderPlants;
```
Rendered elements can use all `data-*` attributes — the click handler is delegated. Don't duplicate rows as static
HTML: render in `App.ready`; the audit and screenshots run it.

Escape user-entered text before inserting with `innerHTML` (`.replace(/[&<>"]/g, …)`) or build nodes with `textContent`.

## 5. Component markup

**Icons** — Material Symbols Rounded, by ligature name (fonts.google.com/icons): `<span class="ms">favorite</span>`;
`.fill` for filled, `.sm` 18 / `.lg` 32 / `.xl` 48, or `style="--ms-size:20px"`. One icon style per app.

**Buttons**
```html
<button class="btn">저장</button>  <button class="btn tonal">임시저장</button>  <button class="btn outlined">취소</button>
<button class="btn text">건너뛰기</button>  <button class="btn elevated">…</button>  <button class="btn danger">삭제</button>
<button class="btn"><span class="ms">add</span>추가</button>     .lg (56dp)  .block (full width)  disabled
<button class="icon-btn"><span class="ms">share</span></button>   .filled .tonal .outlined   .on (selected/toggled)
<button class="fab"><span class="ms">edit</span></button>   .extended (icon + label)  .small .large  .primary .secondary .tertiary
```
Emphasis: one filled button per view; tonal for secondary; text for low emphasis/dismiss.

**Lists**
```html
<div class="list">                                   <!-- .divided adds hairlines between items -->
  <button class="list-item two" data-go="chat">       <!-- 1-line (default) / .two / .three -->
    <span class="avatar">지민</span>                  <!-- or <span class="ms">…</span>, <img class="thumb" src> -->
    <span class="body"><span class="overline">어제</span><span class="headline">김지민</span><span class="supporting ellipsis">내일 몇 시에 볼까?</span></span>
    <span class="trail">오후 3:12</span>
  </button>
</div>
<div class="section-title">이번 주<button class="btn text">전체</button></div>
<div class="divider inset"></div>
```
**Cards and media**
```html
<button class="card" data-go="course"><div class="media" data-icon="hiking" style="--h:140px"></div>
  <div class="card-body"><div class="t-title-m">북한산 둘레길 3코스</div><div class="t-body-m muted">4.2km · 1시간 40분</div></div></button>
.card (elevated) · .card.filled · .card.outlined   ·   <div class="carousel"> cards… </div> horizontal snap scroller
```
`.media` is a tonal block with a large symbol (`data-icon`), colour via `--media-bg/--media-fg`. Use it — or inline
SVG/CSS shapes — instead of random stock photos. Photos are fine only when the content is photos (e.g. food, places):
then use one consistent treatment.

**Chips, tabs, segmented**
```html
<div class="chip-row" data-single><button class="chip selected" data-chip data-action="setFilter" data-v="all">전체</button>…</div>
<div class="chip-wrap"><button class="chip" data-chip>…</button></div>      <!-- wrapping instead of scrolling -->
<span class="chip"><span class="ms">event</span>10월 14일</span>           <!-- assist/info chip -->
<div class="tabs"><button class="tab active" data-panel="p-day">일</button><button class="tab" data-panel="p-week">주</button></div>
<div><div class="tab-panel" id="p-day">…</div><div class="tab-panel" id="p-week" hidden>…</div></div>
<div class="segmented"><button class="selected">목록</button><button>지도</button></div>    <!-- data-multi for multi-select -->
```
**Inputs**
```html
<label class="field"><input name="title" placeholder=" " required><span class="label">제목</span><span class="support">최대 20자</span></label>
<label class="field outlined has-lead"><span class="ms lead">mail</span><input type="email" placeholder=" "><span class="label">이메일</span></label>
<label class="field"><textarea placeholder=" "></textarea><span class="label">메모</span></label>
<div class="search-bar"><span class="ms">search</span><input placeholder="장소, 코스 검색"><button class="icon-btn"><span class="ms">mic</span></button></div>
<label class="check-row"><span class="body">알림 받기</span><span class="switch"><input type="checkbox" checked><span class="track"></span></span></label>
<label class="check-row"><input type="checkbox"><span class="body">매일 반복</span></label>
<input type="range" min="0" max="10">
```
`placeholder=" "` (a single space) is required for the floating label to work.

**Overlays**
```html
<div class="sheet" id="sort-sheet">
  <div class="sheet-title">정렬</div>
  <div class="sheet-body"><div class="list">…</div></div>
  <div class="sheet-actions"><button class="btn text" data-close>취소</button><span class="grow"></span><button class="btn" data-close data-action="applySort">적용</button></div>
</div>
<div class="dialog" id="confirm-leave">
  <span class="ms d-icon">logout</span><div class="d-title">모임에서 나갈까요?</div>
  <p class="d-text">나가면 채팅 기록을 볼 수 없어요.</p>
  <div class="d-actions"><button class="btn text" data-close>취소</button><button class="btn text" data-close data-action="leave">나가기</button></div>
</div>
<div class="menu" id="home-menu"><button class="menu-item" data-close data-go="settings"><span class="ms">settings</span>설정</button></div>
```
**Feedback / status**: `.badge` (inside `.pill`/`.icon-btn`, `.dot` variant) · `.tag` (`--tag-bg/--tag-fg`) ·
`<div class="progress" style="--v:62%"><i></i></div>` · `.spinner` · `.skeleton` (loading blocks) ·
`<div class="empty-state"><span class="ms xl">…</span><div class="t-title-m">…</div><p>…</p><button class="btn">…</button></div>`

**Layout helpers**: `.pad` (16dp sides) · `.stack` (column, `--gap`) · `.row` (`--gap`) · `.grow` · `.spacer` (`--h`) ·
type classes `.t-display-l … .t-label-s` · `.muted` · `.num` (tabular numbers) · `.ellipsis` · `.clamp-2`.

## 6. Tokens for app CSS

Colour roles: `--primary --on-primary --primary-container --on-primary-container` (same for secondary, tertiary, error),
`--surface --surface-container-lowest/low/(none)/high/highest --on-surface --on-surface-variant --outline --outline-variant
--inverse-surface --inverse-on-surface --inverse-primary`. Pair every background role with its `on-` role.
Type: `font: var(--title-m)` etc. · fonts `--font-display --font-body`. Shape: `--r-xs 4 --r-sm 8 --r-md 12 --r-lg 16 --r-xl 28 --r-full`
plus `--btn-radius --card-radius --sheet-radius --fab-radius`. Elevation `--elev-1..3`. Spacing: use 4/8/12/16/24/32.

## 7. Gotchas

- Big files: split into parts with `<!-- @include parts/screen-pick.html -->` (relative to the source file); `build` inlines them.
- Unique `id`s across screens and overlays — they share one document. Prefix (`plant-title`, `cal-title`).
- One `.content` per screen; put sticky things (tabs, chip rows, search) above it, bottom bars below it.
- Don't put `position:fixed` inside screens; use `position:absolute` relative to the screen (as `.fab` does).
- Long text: give list bodies `min-width:0` (already set) and use `.ellipsis`/`.clamp-2` deliberately — the audit
  reports overflow either way.
- Rendered-by-JS screens must render in `App.ready`/`App.onEnter`, not on click only — otherwise screenshots show them empty.
- Don't edit `shell.css`/`shell.js`. If the shell truly lacks something, add it in `<style id="app">` / your script.
