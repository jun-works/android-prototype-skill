# Motion recipes

Tested building blocks for signature moments. All work inside the shell, render correctly in still screenshots
(`App.shot`), and can be checked over time with `proto.py frames`. A full working flow lives in
`examples/umteum/app.src.html` (character state machine, tossed seeds, sprouting).

## Contents
1. Shell helpers for motion
2. Liquid / metaball (SVG filter)
3. Button born from an input
4. Assembling splash
5. Orb sphere (canvas)
6. Character avatars (SVG symbol + life)
7. Chat sequence with typing indicator
8. Reveal / stagger
9. Checking motion
10. Android mapping

## 1. Shell helpers

| Helper | Use |
|---|---|
| `App.loop(screenId, draw)` | rAF loop that runs only while that screen shows. `draw(dt, t)` in seconds (dt capped at 50ms). Returns `{start, stop}`. |
| `App.after(ms, fn)` | `setTimeout` that runs **immediately** in still screenshots, so sequences render complete. |
| `App.shot` | `true` in still screenshots/audit — skip waits, show the meaningful end state. |
| `App.reducedMotion` | User asked for less motion: show end states, stop loops after one frame. |
| `App.onEnter(id, fn)` / `App.onLeave(id, fn)` | Start/replay on enter, clean up timers on leave. |
| `html.still` (CSS) | Present in still screenshots: CSS animations jump to their end state. Use it to freeze idle loops (`html.still .avatar .eyes{animation:none}`). |
| `filter:url(#goo)`, `#goo-c`, `#goo-s`, `#grain` | Injected by the shell. Don't redefine them unless you need different values. |

Write CSS animations with `both`/`forwards` fill so their end state is the intended still frame.

## 2. Liquid / metaball

Blur, then a steep alpha threshold, so shapes that touch merge like liquid. Text must stay **outside** the filtered layer.
```html
<div class="blobs" style="filter:url(#goo-c)" aria-hidden="true"><i></i><i></i><i></i></div>
```
- `#goo`: classic (colours can muddy where shapes meet). `#goo-c`: re-draws the source on top (`atop`) → crisp colours,
  liquid outline. `#goo-s`: small things (typing dots, chips).
- Tune: blur `stdDeviation` 6–8 for ~40–100px shapes; threshold row `0 0 0 20 -8`. Bigger blur = stickier.
- Lessons: plain blur+threshold muddies colours → use `atop`; filtered layers shouldn't contain text or icons;
  **never use transparency under a goo filter** — the alpha threshold erases semi-transparent shapes. Fade by mixing the
  colour toward the background instead (see the orb sphere recipe).

## 3. Button born from an input

Instead of a disabled button: the action grows out of the field when input becomes valid.
```html
<div class="goo-field" id="f">
  <div class="goo-layer" style="filter:url(#goo)" aria-hidden="true"><i class="pill"></i><i class="drop"></i></div>
  <input id="name" placeholder="닉네임 입력" data-js>
  <button class="go" type="submit" aria-label="다음"><span class="ms">arrow_forward</span></button>
</div>
```
```css
.goo-field{position:relative;height:56px}
.goo-layer{position:absolute;inset:-16px;pointer-events:none}
.goo-layer .pill{position:absolute;left:16px;right:16px;top:16px;height:56px;border-radius:28px;background:var(--on-surface);
  transition:right .45s cubic-bezier(.3,1.3,.5,1)}
.goo-layer .drop{position:absolute;right:24px;top:24px;width:40px;height:40px;border-radius:50%;background:var(--primary)}
.goo-field.ready .pill{right:76px}            /* the pill pulls back; the drop stays and separates like liquid */
.goo-field input{position:relative;width:calc(100% - 76px);height:56px;padding:0 24px;border:0;background:none;color:var(--surface);outline:none}
.goo-field .go{position:absolute;right:8px;top:8px;width:40px;height:40px;border-radius:50%;color:var(--on-primary);opacity:0;transition:opacity .2s .25s}
.goo-field.ready .go{opacity:1}
```
Toggle `.ready` from an `input` listener; keep validation messages as text below. Keep everything inside the field's
box — moving the drop *outward* pushes it off-screen (the audit reports `clipped-off-screen`).

## 4. Assembling splash

Brand pieces drift in and merge, then the wordmark fades up. Pure CSS keyframes inside a `#goo-c` layer:
```css
.sp i{position:absolute;border-radius:50%;animation:2.4s cubic-bezier(.5,0,.2,1) both}
.sp i:nth-child(1){background:#e2553a;animation-name:sp1}  /* … one keyframe per blob: far → overlap → settle */
@keyframes sp1{0%{transform:translate(-62px,30px) scale(.5)}55%{transform:translate(-14px,6px) scale(1)}100%{transform:translate(-30px,12px) scale(.86)}}
.wordmark{animation:fadeUp .6s 1.4s both}
```
Auto-advance with `App.onEnter('splash', …setTimeout…)` guarded by `if (App.shot) return;`; also let a tap skip it.

## 5. Orb sphere (canvas)

Points on a sphere (Fibonacci distribution), rotated and projected with depth, drawn back-to-front, under `#goo-c`.
```js
var cv = document.getElementById('orbs'), ctx = cv.getContext('2d'), S = 720, C = S / 2, R = 292;  // canvas 720×720, CSS 360×360
var N = 210, ga = Math.PI * (3 - Math.sqrt(5)), pts = [];
for (var i = 0; i < N; i++) { var y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), th = ga * i; pts.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
var rot = 0, INK = [194, 65, 12], BG = [255, 248, 245];             // dot colour, screen background
function mix(a, b, f) { return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * f); }).join(',') + ')'; }
App.loop('orbs', function (dt, t) {
  rot += dt * .34; ctx.clearRect(0, 0, S, S);
  var cr = Math.cos(rot), sr = Math.sin(rot), list = [];
  pts.forEach(function (v) {
    var x = v[0] * cr - v[2] * sr, z = v[0] * sr + v[2] * cr, d = (z + 1) / 2;       // depth 0 (back) … 1 (front)
    list.push({ x: C + x * R, y: C + v[1] * R, z: z, s: 11 * (.45 + .7 * d), c: mix(INK, BG, (1 - d) * .6) });
  });
  list.sort(function (a, b) { return a.z - b.z; });
  list.forEach(function (o) { ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, o.s, 0, 6.283); ctx.fill(); });
});
```
Make the motion **mean** something: tie each phase to a real step of what the app does — e.g. step 1 sweeps a
highlight across the dots (reading), step 2 lerps points ~40% toward their cluster centre (sorting), step 3 lerps ~85%
so clusters merge into solid groups (result). Ease state
changes with `k += (target - k) * Math.min(1, dt * 2.2)`. Add a tap → `scatter` impulse that decays. In `App.shot`,
set the most explanatory step so the still frame tells the story.

## 6. Character avatars

One `<symbol>` per character in an inline SVG `<defs>`; reuse with `<svg class="bot"><use href="#bot-a"/></svg>`.
- Shape language = role (one character per job, each with its own silhouette). Radial gradient for volume, `filter:url(#grain)` for a
  soft plush edge.
- Life: `breathe` (scale 1.03/.97, 3.2s), `blink` (scaleY to .1 for 2% of 4–6s), `look` (eyes translate ±3px).
  Offset delays between characters so they never blink together. Freeze in `html.still`.

## 7. Chat sequence

```js
var run = 0;
function say(msg, myRun, done) {
  if (App.shot) { add(row(msg)); return done(); }                    // still: render everything at once
  add(typingRow(msg.who));                                           // three dots under #goo-s
  setTimeout(function () {
    if (myRun !== run) return;                                       // replay pressed meanwhile
    removeTyping(); add(row(msg)); scrollToEnd();
    setTimeout(done, 420);
  }, 650 + Math.min(1300, plainText(msg).length * 22));              // reading-speed delay
}
function play() { var r = ++run, i = 0; clear(); (function next() { if (r !== run) return; if (i < SCRIPT.length) say(SCRIPT[i++], r, next); else finish(); })(); }
App.onEnter('guide', play);
```
- Group consecutive messages from the same speaker (avatar once, name once).
- Emphasise the one sentence that matters (dark "key" bubble).
- End with quick-reply chips that answer the worries the message creates; enable the CTA only after the script ends;
  offer replay.

## 8. Reveal / stagger

```css
.reveal>*{animation:fadeUp .5s cubic-bezier(.2,0,0,1) both}
.reveal>*:nth-child(2){animation-delay:.08s} .reveal>*:nth-child(3){animation-delay:.16s}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
```
Use once per screen, for the content that should be read in order. Not on every list row.

## 9. Checking motion

```bash
proto.py frames app.src.html --screen splash --at 0.1 0.6 1.2 1.8 2.6
proto.py frames app.src.html --screen guide --at 0.5 2 4 7 11
```
The filmstrip shows the screen at each moment (JS timers and CSS animations share one frozen clock). Look for: a
clear beginning → middle → end, nothing popping in unannounced, text readable at every frame, the end state matching
the still screenshot. In film mode one timer-driven clock runs JS timers, rAF (emulated at 60fps) and CSS/WAAPI
animations, so animations started late (after a timeout or a tap simulated in `App.ready`) are captured correctly.
Load text fonts with `display=swap` (the starter does): with `display=block`, glyphs added later can stay invisible
in a frozen frame while their font subset loads. Keep `display=block` only for Material Symbols.

## 10. Android mapping (write into DESIGN_NOTES)

| Web | Android |
|---|---|
| SVG blur + alpha threshold (goo) | `RenderEffect.createBlurEffect` + `createColorFilterEffect(ColorMatrixColorFilter)` via `Modifier.graphicsLayer { renderEffect = … }` (API 31+); AGSL `RuntimeShader` (33+); below 31: plain shapes or Canvas metaballs |
| Canvas rAF loop | Compose `Canvas` + `LaunchedEffect { while (true) withFrameNanos { … } }`; stop when not visible |
| CSS keyframes | `Animatable` / `rememberInfiniteTransition` / `updateTransition`; springs for droplet overshoot |
| Reduced motion | `Settings.Global.ANIMATOR_DURATION_SCALE == 0` → static end state |
| SVG characters | `ImageVector`/vector drawable + `graphicsLayer` scale for breathing; Lottie only if designers own the asset |
