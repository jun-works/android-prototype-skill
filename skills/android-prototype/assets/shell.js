/* Android prototype shell runtime — router, overlays, interactions, and the layout audit.
   Don't edit per app. App logic goes in the app's own <script> via the App API:
     App.go(id) App.tab(id) App.back() App.sheet(id) App.dialog(id) App.menu(id, anchorEl) App.close()
     App.snack(text, actionLabel?, fn?)  App.actions.name = (el, event) => {...}  App.onEnter(id, fn)  App.state
   Markup conventions are documented in references/components.md. */
(function () {
  'use strict';
  var qs = function (s, r) { return (r || document).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var params = new URLSearchParams(location.search);
  // live = normal · film = bare device, real-time motion (proto.py frames) · shot/audit = bare device, animations at end state
  var MODE = params.has('audit') ? 'audit' : params.has('shot') ? 'shot' : params.has('film') ? 'film' : 'live';
  var html = document.documentElement;
  if (MODE !== 'live') html.classList.add('shot');
  if (MODE === 'shot' || MODE === 'audit') html.classList.add('still');
  if (MODE === 'film') filmClock(parseFloat(params.get('film')) || 0);

  /* film=<seconds>: one deterministic clock for JS timers, rAF and CSS animations, frozen at that moment
     so `proto.py frames` captures exactly t seconds after the page booted. */
  function filmClock(stopAt) {
    // Headless virtual time starves requestAnimationFrame after ~1s, so film mode drives everything from timers,
    // which virtual time advances deterministically: a 16ms ticker syncs CSS/WAAPI animations, and rAF is emulated.
    var st = window.setTimeout, frozen = false, t0 = performance.now(), born = new WeakMap();
    window.setTimeout = function (fn, ms) { var args = Array.prototype.slice.call(arguments, 2); return st(function () { if (!frozen && typeof fn === 'function') fn.apply(null, args); }, ms); };
    window.requestAnimationFrame = function (fn) { return st(function () { if (!frozen) fn(performance.now()); }, 16); };
    window.cancelAnimationFrame = function (id) { clearTimeout(id); };
    function sync(el) {
      document.getAnimations().forEach(function (a) {
        if (!born.has(a)) { born.set(a, el); a.pause(); }
        try { a.currentTime = Math.max(0, el - born.get(a)); } catch (e) { /* finished/removed */ }
      });
    }
    function freeze() { if (frozen) return; sync(stopAt * 1000); frozen = true; html.setAttribute('data-film-done', String(stopAt)); }
    st(freeze, stopAt * 1000);
    (function tick() {
      if (frozen) return;
      var el = performance.now() - t0;
      if (el >= stopAt * 1000) return freeze();
      sync(el);
      st(tick, 16);
    })();
  }

  if (params.get('dark') === '1') html.classList.add('dark');
  var jsErrors = [];
  window.addEventListener('error', function (e) { jsErrors.push((e.message || 'error') + (e.lineno ? ' (line ' + e.lineno + ')' : '')); });
  var KO = /^ko/i.test(html.lang || navigator.language || '');
  var T = KO
    ? { root: '첫 화면이에요 — 여기서 뒤로 가면 앱이 닫혀요', missing: '없는 화면: ', todo: '아직 준비 중인 기능이에요', back: '◀ 뒤로', hint: 'Esc 또는 화면 왼쪽 가장자리에서 오른쪽으로 끌기 = 뒤로', screens: '화면' }
    : { root: 'This is the first screen — back would close the app', missing: 'Missing screen: ', todo: 'Not built yet', back: '◀ Back', hint: 'Esc, or drag from the left edge = back', screens: 'Screens' };

  var device, overlaysEl, scrim, snackEl, statusBar, gestureBar;
  var overlayStack = [];
  var ACTION_ATTRS = ['data-go', 'data-tab', 'data-back', 'data-sheet', 'data-dialog', 'data-menu', 'data-close', 'data-snack',
    'data-chip', 'data-panel', 'data-toggle', 'data-action', 'data-todo', 'data-js', 'data-links', 'onclick'];
  var ACTION_SEL = ACTION_ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');

  var App = window.App = window.App || {};
  App.stack = []; App.state = App.state || {}; App.actions = App.actions || {}; App._enter = App._enter || {};
  App._leave = App._leave || {};
  App.mode = MODE;
  App.shot = MODE === 'shot' || MODE === 'audit';   // still screenshot: show the finished state, skip waits
  App.reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  App.onEnter = function (id, fn) { (App._enter[id] = App._enter[id] || []).push(fn); };
  App.onLeave = function (id, fn) { (App._leave[id] = App._leave[id] || []).push(fn); };
  /* setTimeout that runs immediately in still screenshots, so sequences (chat, reveals) render complete */
  App.after = function (ms, fn) { if (App.shot) { fn(); return 0; } return setTimeout(fn, ms); };
  /* requestAnimationFrame loop that runs only while screen #id is showing. draw(dt, t) in seconds. */
  App.loop = function (id, draw) {
    var raf = 0, last = 0, t = 0;
    function tick(now) { var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt; draw(dt, t); raf = requestAnimationFrame(tick); }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    App.onEnter(id, start); App.onLeave(id, stop);
    return { start: start, stop: stop };
  };
  App.current = function () { return App.stack[App.stack.length - 1]; };

  function screens() { return qsa('.screen', device); }
  function byId(id) { return id ? document.getElementById(id) : null; }
  function isScreen(el) { return !!el && el.classList.contains('screen'); }
  function startId() { var s = qs('.screen[data-start]', device) || screens()[0]; return s && s.id; }
  function navBars() { return qsa('.nav-bar', device); }
  function rootsOf(nav) {
    var list = (nav.getAttribute('data-for') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!list.length) list = qsa('[data-tab]', nav).map(function (b) { return b.getAttribute('data-tab'); });
    return list;
  }
  function tabRoots() { var s = {}; navBars().forEach(function (n) { rootsOf(n).forEach(function (id) { s[id] = true; }); }); return s; }

  /* ---------- chrome around the active screen ---------- */
  function layoutChrome(screen) {
    var anyNav = false;
    navBars().forEach(function (nav) {
      var on = rootsOf(nav).indexOf(screen.id) >= 0 || (screen.getAttribute('data-nav') || '') === (nav.id || '#');
      nav.hidden = !on;
      if (on) {
        anyNav = true;
        qsa('[data-tab]', nav).forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === screen.id); });
      }
    });
    screen.classList.toggle('has-nav', anyNav);
    var light = screen.getAttribute('data-status') === 'light';
    if (statusBar) statusBar.classList.toggle('light', light);
    if (gestureBar) gestureBar.classList.toggle('light', light && !anyNav);
    var inset = getComputedStyle(screen).getPropertyValue('--inset-b');
    var fab = qs('.fab', screen);
    device.style.setProperty('--active-inset', fab && !fab.hidden ? 'calc(' + inset + ' + 72px)' : inset);
    qsa('.review button[data-jump]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-jump') === screen.id); });
  }

  function show(id, anim) {
    var next = byId(id);
    if (!isScreen(next)) { console.warn('No screen #' + id); App.snack(T.missing + id); return false; }
    var prev = qs('.screen.active', device);
    if (prev === next) return true;
    if (prev) (App._leave[prev.id] || []).forEach(function (f) { try { f(prev); } catch (e) { console.error(e); } });
    next.hidden = false;
    next.classList.add('active');
    layoutChrome(next);
    if (prev) {
      prev.classList.remove('active');
      if (anim && MODE === 'live') {
        var inC = 'anim-' + anim + '-in', outC = 'anim-' + anim + '-out';
        next.classList.add(inC); prev.classList.add(outC);
        setTimeout(function () {
          next.classList.remove(inC); prev.classList.remove(outC);
          if (!prev.classList.contains('active')) prev.hidden = true;
        }, 320);
      } else prev.hidden = true;
    }
    qsa('.content', next).forEach(function (c) { var bar = qs('.top-app-bar', next); if (bar) bar.classList.toggle('scrolled', c.scrollTop > 0); });
    (App._enter[id] || []).forEach(function (f) { try { f(next); } catch (e) { console.error(e); } });
    if (MODE === 'live') try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// in some browsers */ }
    return true;
  }

  App.go = function (id) {
    var roots = tabRoots(), cur = App.current();
    if (roots[id] && (!cur || roots[cur])) return App.tab(id);
    closeAll();
    if (cur === id) return true;
    var ok = show(id, 'push');
    if (ok) App.stack.push(id);
    return ok;
  };
  App.tab = function (id) {
    closeAll();
    var ok = show(id, 'fade');
    if (ok) App.stack = [id];
    return ok;
  };
  App.back = function () {
    if (overlayStack.length) return closeTop();
    if (App.stack.length > 1) { App.stack.pop(); show(App.current(), 'pop'); return true; }
    var s = startId();
    if (App.current() !== s && tabRoots()[App.current()]) return App.tab(s);
    App.snack(T.root);
    return false;
  };
  App.reset = function (id) {
    closeAll();
    var s = startId();
    App.stack = (id === s || tabRoots()[id]) ? [id] : [s, id];
    show(id);
  };

  /* ---------- overlays ---------- */
  function openOverlay(id, anchor) {
    var el = byId(id);
    if (!el) { App.snack(T.missing + id); return false; }
    if (overlayStack.indexOf(el) >= 0) return true;
    var isMenu = el.classList.contains('menu');
    if (isMenu && anchor) placeMenu(el, anchor);
    overlayStack.push(el);
    el.classList.add('open');
    scrim.classList.toggle('clear', isMenu);
    scrim.classList.add('on');
    el.style.zIndex = 2 + overlayStack.length;
    scrim.style.zIndex = 1 + overlayStack.length;
    el.dispatchEvent(new CustomEvent('open', { bubbles: true }));
    return true;
  }
  function placeMenu(menu, anchor) {
    var d = device.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    menu.style.visibility = 'hidden'; menu.style.display = 'block';
    var w = menu.offsetWidth || 200, h = menu.offsetHeight || 200;
    menu.style.display = ''; menu.style.visibility = '';
    var left = Math.min(Math.max(8, a.right - d.left - w), d.width - w - 8);
    var top = a.bottom - d.top;
    if (top + h > d.height - 32) top = Math.max(40, a.top - d.top - h);
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
  }
  function closeTop() {
    var el = overlayStack.pop();
    if (!el) return false;
    el.classList.remove('open');
    if (!overlayStack.length) scrim.classList.remove('on');
    else { scrim.style.zIndex = 1 + overlayStack.length; scrim.classList.toggle('clear', overlayStack[overlayStack.length - 1].classList.contains('menu')); }
    el.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    return true;
  }
  function closeAll() { while (overlayStack.length) closeTop(); }
  App.sheet = function (id) { return openOverlay(id); };
  App.dialog = function (id) { return openOverlay(id); };
  App.menu = function (id, anchor) { return openOverlay(id, anchor); };
  App.close = closeTop;
  App.closeAll = closeAll;

  var snackTimer;
  App.snack = function (text, actionLabel, fn) {
    if (!snackEl) return;
    clearTimeout(snackTimer);
    snackEl.innerHTML = '';
    var t = document.createElement('span'); t.className = 'snack-text'; t.textContent = text; snackEl.appendChild(t);
    if (actionLabel) {
      var b = document.createElement('button'); b.className = 'snack-action'; b.textContent = actionLabel; b.setAttribute('data-js', '');
      b.onclick = function (e) { e.stopPropagation(); snackEl.classList.remove('on'); if (typeof fn === 'function') fn(); else if (App.actions[fn]) App.actions[fn](b, e); };
      snackEl.appendChild(b);
    }
    snackEl.classList.add('on');
    snackTimer = setTimeout(function () { snackEl.classList.remove('on'); }, actionLabel ? 6000 : 3500);
  };

  /* ---------- interactions ---------- */
  function onClick(e) {
    var sub = e.target.closest('button,input[type=submit]');
    if (sub && sub.form && (sub.type === 'submit')) sub.form.noValidate = true;  // validate in onSubmit with M3 error styling
    var el = e.target.closest(ACTION_SEL + ',.segmented>button');
    while (el && el.tagName === 'FORM') el = el.parentElement && el.parentElement.closest(ACTION_SEL + ',.segmented>button');  // forms act on submit only
    if (!el || !device.contains(el)) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    var a = function (n) { return el.getAttribute(n); };
    if (el.matches('a[href^="#"]')) e.preventDefault();

    if (el.parentElement && el.parentElement.classList.contains('segmented')) {
      var seg = el.parentElement;
      if (seg.hasAttribute('data-multi')) el.classList.toggle('selected');
      else qsa(':scope>button', seg).forEach(function (b) { b.classList.toggle('selected', b === el); });
    }
    if (el.hasAttribute('data-action')) {
      var fn = App.actions[a('data-action')];
      if (!fn) console.warn('No App.actions.' + a('data-action'));
      else if (fn(el, e) === false) return;
    }
    if (el.hasAttribute('data-chip')) {
      var row = el.closest('[data-single]');
      if (row) qsa('[data-chip]', row).forEach(function (c) { c.classList.toggle('selected', c === el); });
      else el.classList.toggle('selected');
    }
    if (el.hasAttribute('data-panel')) {
      var tabs = el.closest('.tabs') || el.parentElement;
      qsa('[data-panel]', tabs).forEach(function (t) { t.classList.toggle('active', t === el); });
      var panel = byId(a('data-panel'));
      if (panel) {
        qsa(':scope>.tab-panel', panel.parentElement).forEach(function (p) { p.hidden = p !== panel; });
        var c = panel.closest('.content'); if (c) c.scrollTop = 0;
      }
    }
    if (el.hasAttribute('data-toggle')) {
      var sel = a('data-toggle'), cls = a('data-toggle-class');
      var targets = sel ? qsa(sel, device) : [el];
      targets.forEach(function (t) { if (cls) t.classList.toggle(cls); else t.hidden = !t.hidden; });
    }
    if (el.hasAttribute('data-close')) closeTop();
    if (el.hasAttribute('data-snack')) App.snack(a('data-snack'), a('data-snack-action'), a('data-snack-do'));
    if (el.hasAttribute('data-todo')) App.snack(a('data-todo') || T.todo);
    if (el.hasAttribute('data-back')) { App.back(); return; }
    if (el.hasAttribute('data-tab')) { App.tab(a('data-tab')); return; }
    if (el.hasAttribute('data-go')) { App.go(a('data-go')); return; }
    if (el.hasAttribute('data-sheet')) { openOverlay(a('data-sheet')); return; }
    if (el.hasAttribute('data-dialog')) { openOverlay(a('data-dialog')); return; }
    if (el.hasAttribute('data-menu')) { openOverlay(a('data-menu'), el); return; }
  }
  function onSubmit(e) {
    var form = e.target;
    if (!device.contains(form)) return;
    e.preventDefault();
    var bad = qsa('input,textarea,select', form).filter(function (i) { return !i.checkValidity(); });
    qsa('.field', form).forEach(function (f) { var i = qs('input,textarea,select', f); f.classList.toggle('error', !!i && bad.indexOf(i) >= 0); });
    if (bad.length) { bad[0].focus(); return; }
    var name = form.getAttribute('data-action');
    if (name && App.actions[name]) App.actions[name](form, e);
    if (form.hasAttribute('data-go')) App.go(form.getAttribute('data-go'));
    if (form.hasAttribute('data-back')) App.back();
    if (form.hasAttribute('data-snack')) App.snack(form.getAttribute('data-snack'));
  }
  function ripple(e) {
    var host = e.target.closest('button,.list-item,.card,.chip,a,[data-go],[data-tab],[data-action]');
    if (!host || !device.contains(host) || host.closest('.switch') || host.matches('input')) return;
    var target = host.classList.contains('nav-item') ? (qs('.pill', host) || host) : host;
    var r = target.getBoundingClientRect();
    var size = Math.max(r.width, r.height) * 2;
    var s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = size + 'px';
    s.style.left = (e.clientX - r.left - size / 2) + 'px';
    s.style.top = (e.clientY - r.top - size / 2) + 'px';
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.classList.add('rpl-clip');
    target.appendChild(s);
    setTimeout(function () { s.remove(); target.classList.remove('rpl-clip'); }, 460);
  }
  function edgeSwipe() {
    var sx = null, sy = 0;
    device.addEventListener('pointerdown', function (e) {
      var d = device.getBoundingClientRect();
      sx = (e.clientX - d.left < 20) ? e.clientX : null; sy = e.clientY;
    });
    device.addEventListener('pointerup', function (e) {
      if (sx !== null && e.clientX - sx > 60 && Math.abs(e.clientY - sy) < 80) App.back();
      sx = null;
    });
  }

  /* ---------- boot ---------- */
  function buildFrame() {
    device = qs('.device');
    if (!device) { console.error('prototype: no .device element'); return false; }
    if (!qs('.status-bar', device)) {
      device.insertAdjacentHTML('afterbegin', '<div class="status-bar"><span class="num">' + (device.getAttribute('data-time') || '9:30') +
        '</span><span class="sb-icons"><span class="ms fill">signal_cellular_alt</span><span class="ms fill">wifi</span><span class="ms fill">battery_full</span></span></div>');
    }
    statusBar = qs('.status-bar', device);
    if (!document.getElementById('goo')) document.body.insertAdjacentHTML('afterbegin',
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      // goo: blur + alpha threshold so touching shapes merge like liquid; goo-c keeps colours crisp; goo-s for small things
      '<filter id="goo" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter>' +
      '<filter id="goo-c" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter>' +
      '<filter id="goo-s" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"/></filter>' +
      '<filter id="grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>' +
      '</defs></svg>');
    if (!qs('.gesture-bar', device)) device.insertAdjacentHTML('beforeend', '<div class="gesture-bar"></div>');
    gestureBar = qs('.gesture-bar', device);
    overlaysEl = qs('.overlays', device);
    if (!overlaysEl) { overlaysEl = document.createElement('div'); overlaysEl.className = 'overlays'; device.appendChild(overlaysEl); }
    qsa('.sheet,.dialog,.menu', device).forEach(function (o) { if (o.parentElement !== overlaysEl) overlaysEl.appendChild(o); });
    scrim = document.createElement('div'); scrim.className = 'scrim';
    overlaysEl.insertBefore(scrim, overlaysEl.firstChild);
    scrim.addEventListener('click', closeTop);
    snackEl = document.createElement('div'); snackEl.className = 'snackbar'; device.appendChild(snackEl);
    screens().forEach(function (s) { s.hidden = true; s.classList.remove('active'); });
    qsa('form', device).forEach(function (f) { f.noValidate = true; });
    return true;
  }
  function buildReview() {
    if (MODE !== 'live') return;
    var stage = device.parentElement;
    if (!stage || !stage.classList.contains('stage')) return;
    var p = document.createElement('aside'); p.className = 'review';
    var h = '<button class="rv-back" data-rv-back>' + T.back + '</button><h2>' + T.screens + '</h2>';
    screens().forEach(function (s) {
      var t = s.getAttribute('data-title') || (qs('.top-app-bar .title', s) || {}).textContent || s.id;
      h += '<button data-jump="' + s.id + '">' + escapeHtml(String(t).trim()) + ' <span style="opacity:.5">#' + s.id + '</span></button>';
    });
    p.innerHTML = h + '<p class="hint">' + T.hint + '</p>';
    stage.appendChild(p);
    p.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-rv-back')) App.back(); else App.reset(b.getAttribute('data-jump'));
    });
  }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function boot() {
    if (!buildFrame()) return;
    var hash = decodeURIComponent(location.hash.slice(1)).split('/');
    var id = isScreen(byId(hash[0])) ? hash[0] : startId();
    if (typeof App.ready === 'function') try { App.ready(); } catch (e) { console.error(e); }
    if (MODE === 'audit') { window.addEventListener('load', function () { setTimeout(runAudit, 30); }); return; }
    App.reset(id);
    if (hash[1]) { var anchor = qs('[data-menu="' + hash[1] + '"]', byId(id)); openOverlay(hash[1], anchor); }
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    device.addEventListener('pointerdown', ripple);
    device.addEventListener('scroll', function (e) {
      var c = e.target; if (!c.classList || !c.classList.contains('content')) return;
      var bar = qs('.top-app-bar', c.closest('.screen')); if (bar) bar.classList.toggle('scrolled', c.scrollTop > 0);
    }, true);
    document.addEventListener('keydown', function (e) {
      var typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
      if (e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft') || (e.key === 'Backspace' && !typing)) { e.preventDefault(); App.back(); }
    });
    edgeSwipe();
    buildReview();
    if (qs('.screen.active', device)) layoutChrome(qs('.screen.active', device));
    document.dispatchEvent(new CustomEvent('app:ready'));
  }

  /* =================================================================================
     AUDIT (?audit=1) — opens every screen and overlay, measures the real layout, and
     writes JSON into <script id="__audit">. Run via scripts/proto.py audit.
     ================================================================================= */
  function runAudit() {
    var fontsToCheck = [];
    var iconFamily = '"Material Symbols Rounded"';
    var rootCS = getComputedStyle(html);
    ['--font-display', '--font-body'].forEach(function (v) {
      var first = (rootCS.getPropertyValue(v) || '').split(',')[0].trim();
      if (first && !/^(system-ui|sans-serif|serif|monospace|-apple-system|inherit|var\()/i.test(first)) fontsToCheck.push(first);
    });
    var loads = [document.fonts.load('24px ' + iconFamily, 'home')].concat(fontsToCheck.map(function (f) { return document.fonts.load('16px ' + f, 'Aa가'); }));
    Promise.all(loads.map(function (p) { return p.catch(function () { return []; }); }))
      .then(function () { return document.fonts.ready; })
      .then(function () { try { audit(fontsToCheck, iconFamily); } catch (e) { writeAudit({ fatal: String(e && e.stack || e) }); } });
  }
  function writeAudit(res) {
    var s = document.createElement('script');
    s.type = 'application/json'; s.id = '__audit';
    s.textContent = JSON.stringify(res).replace(/</g, '\\u003c');
    document.body.appendChild(s);
    document.title = 'AUDIT_DONE';
  }

  function audit(fontsToCheck, iconFamily) {
    var issues = [];
    var D = device.getBoundingClientRect();
    var roots = tabRoots(), start = startId();
    var rootCS = getComputedStyle(html);
    var add = function (sev, kind, where, el, detail) {
      issues.push({ severity: sev, kind: kind, where: where, el: el ? describe(el) : '', detail: detail || '' });
    };

    jsErrors.forEach(function (m) { add('error', 'js-error', 'global', null, m); });
    /* fonts & theme */
    if (!document.fonts.check('24px ' + iconFamily)) add('error', 'icon-font-missing', 'global', null, 'Material Symbols did not load (offline or missing <link>) — icons render as words.');
    fontsToCheck.forEach(function (f) { if (!document.fonts.check('16px ' + f)) add('warn', 'font-missing', 'global', null, f + ' did not load — add its Google Fonts <link> or fix the family name.'); });
    var theme = html.getAttribute('data-theme');
    if (!theme || theme === 'UNSET') add('warn', 'theme-unset', 'global', null, 'html[data-theme] is unset — this is still the default shell theme, not a designed direction.');
    var tokens = {};
    ['primary', 'on-primary', 'primary-container', 'secondary', 'secondary-container', 'tertiary', 'tertiary-container', 'surface', 'surface-container',
      'on-surface', 'on-surface-variant', 'outline-variant', 'font-display', 'font-body', 'btn-radius', 'card-radius'].forEach(function (k) { tokens[k] = rootCS.getPropertyValue('--' + k).trim(); });
    var prim = parseColor(getComputedStyle(device).getPropertyValue('--primary').trim() || tokens.primary);
    if (prim) {
      var hsl = rgbToHsl(prim);
      if (hsl[0] >= 245 && hsl[0] <= 290 && hsl[1] > 0.25) add('info', 'purple-primary', 'global', null, 'Primary is purple/violet (hue ' + Math.round(hsl[0]) + '°) — the default "AI app" look. Keep only if the brand truly calls for it.');
      if (Math.abs(prim[0] - 0x67) < 6 && Math.abs(prim[1] - 0x50) < 6 && Math.abs(prim[2] - 0xa4) < 6) add('warn', 'baseline-m3-purple', 'global', null, 'Primary is the stock Material baseline #6750A4.');
    }

    /* navigation graph (static) */
    var all = screens();
    var ids = {}; all.forEach(function (s) { ids[s.id] = s; });
    var overlays = qsa('.sheet,.dialog,.menu', device);
    var oids = {}; overlays.forEach(function (o) { oids[o.id] = o; });
    var edges = {}; var hosts = {};
    var link = function (from, to) { (edges[from] = edges[from] || {})[to] = true; };
    var ownerOf = function (el) { var s = el.closest('.screen'); if (s) return [s.id]; var o = el.closest('.sheet,.dialog,.menu'); if (o) return ['@' + o.id]; var n = el.closest('.nav-bar'); if (n) return rootsOf(n); return []; };
    qsa('[data-go],[data-tab],[data-sheet],[data-dialog],[data-menu],[data-links]', device).forEach(function (el) {
      var from = ownerOf(el);
      [['data-go', ''], ['data-tab', ''], ['data-sheet', '@'], ['data-dialog', '@'], ['data-menu', '@']].forEach(function (pair) {
        var v = el.getAttribute(pair[0]); if (v == null) return;
        var ok = pair[1] ? !!oids[v] : !!ids[v];
        if (!ok) add('error', 'broken-link', from.join(',') || 'global', el, pair[0] + '="' + v + '" points to nothing.');
        from.forEach(function (f) { link(f, pair[1] + v); });
        if (pair[1]) from.forEach(function (f) { (hosts[v] = hosts[v] || []).push(f); });
      });
      var extra = el.getAttribute('data-links');
      if (extra) extra.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (v) {
        var key = ids[v] ? v : oids[v] ? '@' + v : null;
        if (!key) add('error', 'broken-link', from.join(',') || 'global', el, 'data-links "' + v + '" points to nothing.');
        else { from.forEach(function (f) { link(f, key); }); if (key[0] === '@') from.forEach(function (f) { (hosts[v] = hosts[v] || []).push(f); }); }
      });
    });
    var seen = {}; var queue = [start];
    while (queue.length) {
      var n = queue.shift(); if (seen[n]) continue; seen[n] = true;
      Object.keys(edges[n] || {}).forEach(function (m) { if (!seen[m]) queue.push(m); });
    }
    all.forEach(function (s) {
      if (!seen[s.id]) add('error', 'unreachable-screen', s.id, null, 'Nothing navigates to #' + s.id + ' from the start screen (add data-go/data-tab, or data-links="' + s.id + '" on the element whose JS navigates there).');
      if (s.id !== start && !roots[s.id] && !qs('[data-back]', s) && !s.hasAttribute('data-no-up'))
        add('warn', 'no-up-button', s.id, null, 'Pushed screen has no visible back/up button (top app bar arrow_back with data-back).');
    });
    overlays.forEach(function (o) { if (!seen['@' + o.id]) add('warn', 'unused-overlay', '@' + o.id, null, 'Overlay #' + o.id + ' is never opened from a reachable screen.'); });

    /* layout, per screen and per overlay */
    var report = { screens: [], overlays: [] };
    var hideAll = function () { all.forEach(function (s) { s.hidden = true; s.classList.remove('active'); }); };
    all.forEach(function (s) {
      hideAll(); s.hidden = false; s.classList.add('active'); layoutChrome(s);
      (App._enter[s.id] || []).forEach(function (f) { try { f(s); } catch (e) { add('error', 'js-error', s.id, null, 'onEnter threw: ' + e); } });
      checkRoot(s, s.id, s, add);
      qsa('[data-panel]', s).forEach(function (t) {  // inactive in-screen tabs
        var panel = byId(t.getAttribute('data-panel'));
        if (!panel) { add('error', 'broken-link', s.id, t, 'data-panel="' + t.getAttribute('data-panel') + '" points to nothing.'); return; }
        if (!panel.hidden) return;
        var sibs = qsa(':scope>.tab-panel', panel.parentElement), was = sibs.map(function (p) { return p.hidden; });
        sibs.forEach(function (p) { p.hidden = p !== panel; });
        checkRoot(panel, s.id + ' [tab: ' + (t.textContent || '').trim() + ']', s, add);
        sibs.forEach(function (p, i) { p.hidden = was[i]; });
      });
      var title = s.getAttribute('data-title') || ((qs('.top-app-bar .title', s) || {}).textContent || '').trim() || s.id;
      report.screens.push({ id: s.id, title: title, start: s.id === start, tabRoot: !!roots[s.id], controls: qsa(ACTION_SEL, s).length, textChars: (s.innerText || '').replace(/\s+/g, '').length });
      if ((s.innerText || '').replace(/\s+/g, '').length < 15) add('warn', 'empty-screen', s.id, null, 'Screen has almost no content.');
    });
    overlays.forEach(function (o) {
      var host = (hosts[o.id] || []).filter(function (h) { return ids[h]; })[0] || start;
      hideAll(); ids[host].hidden = false; ids[host].classList.add('active'); layoutChrome(ids[host]);
      var anchor = qs('[data-menu="' + o.id + '"]', ids[host]);
      openOverlay(o.id, anchor);
      checkRoot(o, '@' + o.id, ids[host], add);
      closeAll();
      report.overlays.push({ id: o.id, kind: o.classList.contains('sheet') ? 'sheet' : o.classList.contains('dialog') ? 'dialog' : 'menu', host: host });
    });

    /* de-duplicate */
    var key = {}, out = [];
    issues.forEach(function (i) { var k = i.severity + i.kind + i.where + i.el + i.detail; if (!key[k]) { key[k] = 1; out.push(i); } });
    writeAudit({ app: document.title, theme: theme || '', lang: html.lang || '', start: start, tokens: tokens, fonts: fontsToCheck,
      screens: report.screens, overlays: report.overlays, issues: out });

    function checkRoot(root, where, screen, add) {
      var els = qsa('*', root).filter(visible);
      var texts = els.filter(hasOwnText);
      var gradients = 0;
      els.forEach(function (el) {
        var cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (/gradient/.test(cs.backgroundImage) && !el.classList.contains('skeleton')) gradients++;
        /* off-screen spill */
        if ((r.right > D.right + 1 || r.left < D.left - 1) && r.width > 0 && !el.closest('[data-overlap-ok]')) {
          var clip = clippedX(el), px = Math.round(Math.max(r.right - D.right, D.left - r.left));
          if (!clip) add('error', 'spills-off-screen', where, el, 'Extends ' + px + 'px past the screen edge.');
          else if (clip === 'hidden') add('warn', 'clipped-off-screen', where, el, 'Cut off by its container: extends ' + px + 'px past the screen edge (use data-overlap-ok if it is a deliberate decorative bleed).');
        }
        /* tap targets */
        if (isControl(el)) {
          var box = el.matches('input[type=checkbox],input[type=radio]') && el.closest('label') ? el.closest('label').getBoundingClientRect() : r;
          var min = el.classList.contains('chip') || el.closest('.chip-row,.chip-wrap,.segmented') ? 32 : 40;
          if (Math.min(box.width, box.height) < min - 0.5 && !el.closest('p') && !(el.matches('.switch input')))
            add('warn', 'small-tap-target', where, el, Math.round(box.width) + '×' + Math.round(box.height) + 'dp (aim for 48, min ' + min + ').');
          if (el.hasAttribute('data-todo')) add('warn', 'todo-control', where, el, 'Placeholder interaction (data-todo) — make it real or drop the control.');
          else if (!hasBehaviour(el)) add('warn', 'dead-control', where, el, 'Looks tappable but does nothing (no data-go/tab/back/sheet/dialog/menu/action/snack…).');
        }
      });
      if (gradients > 2) add('warn', 'gradient-heavy', where, null, gradients + ' gradient backgrounds on one screen.');
      texts.forEach(function (el) {
        var cs = getComputedStyle(el);
        var txt = ownText(el);
        var fs = parseFloat(cs.fontSize);
        if (fs < 11) add('warn', 'tiny-text', where, el, fs + 'px text (M3 minimum is 11).');
        if (/\p{Extended_Pictographic}/u.test(txt)) add('warn', 'emoji', where, el, 'Emoji in UI text — use Material Symbols or real content instead.');
        if (/lorem ipsum|placeholder|^item \d+$|^title$|^subtitle$|^text$|sample text|^label$|^(제목|내용|텍스트|부제목)$|STARTER/i.test(txt.trim()))
          add('warn', 'placeholder-copy', where, el, 'Generic placeholder copy — write realistic content.');
        if (cs.display !== 'inline' && el.clientWidth > 0) {
          if (el.scrollWidth > el.clientWidth + 1) {
            if (cs.overflowX === 'visible') add('error', 'text-overflow', where, el, 'Text is ' + (el.scrollWidth - el.clientWidth) + 'px wider than its box.');
            else if (cs.textOverflow !== 'ellipsis') add('warn', 'text-clipped', where, el, 'Text is cut off without an ellipsis.');
          }
          if (cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2 && (cs.webkitLineClamp === 'none' || !cs.webkitLineClamp) && !el.classList.contains('content') && !el.matches('.sheet-body,.dialog'))
            add('warn', 'text-clipped-v', where, el, 'Text is cut off vertically.');
        }
        var cr = contrastOf(el, cs);
        if (cr && cr.ratio < (isLarge(cs) ? 3 : 4.5) && !el.closest('[disabled],[aria-disabled=true]'))
          add(cr.ratio < 3 ? 'error' : 'warn', 'low-contrast', where, el, 'Contrast ' + cr.ratio.toFixed(2) + ':1 (' + cr.fg + ' on ' + cr.bg + ').');
      });
      /* text vs text overlap */
      var boxes = texts.map(function (el) { return { el: el, r: textRect(el) }; }).filter(function (b) { return b.r && b.r.width > 0; });
      for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (a.el.closest('.badge,[data-overlap-ok]') || b.el.closest('.badge,[data-overlap-ok]')) continue;
        var ra = clipTo(a.r, clipRect(a.el)), rb = clipTo(b.r, clipRect(b.el));   // compare only what is actually visible
        if (!ra || !rb) continue;
        var ov = overlap(ra, rb);
        if (ov > 0.15 * Math.min(area(ra), area(rb))) add('error', 'text-overlap', where, a.el, 'Overlaps "' + short(ownText(b.el)) + '".');
      }
      /* text covered by something else (FAB, bars, sheets) — at top, then scrolled to the bottom */
      var covered = function (pass) {
        texts.forEach(function (el) {
          var r = textRect(el); if (!r || r.width < 1) return;
          if (getComputedStyle(el).pointerEvents === 'none') return;
          var cx = r.left + Math.min(r.width, 40) / 2, cy = r.top + r.height / 2;
          if (!pointInClip(el, cx, cy, root)) return;
          var hit = document.elementFromPoint(cx, cy);
          if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return;
          if (hit.closest('.ripple,.status-bar,.gesture-bar,.badge,[data-overlap-ok]') || el.closest('[data-overlap-ok]')) return;
          if (root.classList.contains('screen') && hit.closest('.overlays') && !hit.closest('.open')) return;
          add('warn', 'text-covered', where, el, 'Covered by ' + describe(hit) + (pass ? ' when scrolled to the bottom' : '') + '.');
        });
      };
      covered(false);
      var scrollers = qsa('.content,.sheet-body', root);
      scrollers.forEach(function (c) { c.scrollTop = c.scrollHeight; });
      if (scrollers.some(function (c) { return c.scrollTop > 0; })) covered(true);
      scrollers.forEach(function (c) { c.scrollTop = 0; });
    }
    function visible(el) {
      if (el.closest('.ms,script,style,template,.ripple,.snackbar,.scrim')) return false;
      var r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return false;
      var cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
    }
    function hasOwnText(el) { return !el.classList.contains('ms') && ownText(el).trim().length > 0; }
    function ownText(el) { var t = ''; el.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.nodeValue; }); return t; }
    function textRect(el) {
      var rects = [];
      el.childNodes.forEach(function (n) { if (n.nodeType === 3 && n.nodeValue.trim()) { var rg = document.createRange(); rg.selectNodeContents(n); var r = rg.getBoundingClientRect(); if (r.width) rects.push(r); } });
      if (!rects.length) return null;
      var l = Math.min.apply(null, rects.map(function (r) { return r.left; })), t = Math.min.apply(null, rects.map(function (r) { return r.top; }));
      var rr = Math.max.apply(null, rects.map(function (r) { return r.right; })), b = Math.max.apply(null, rects.map(function (r) { return r.bottom; }));
      return { left: l, top: t, right: rr, bottom: b, width: rr - l, height: b - t };
    }
    function clipRect(el, root) {
      var c = { left: D.left, top: D.top, right: D.right, bottom: D.bottom };
      for (var p = el.parentElement; p && p !== device.parentElement; p = p.parentElement) {
        var cs = getComputedStyle(p);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          var r = p.getBoundingClientRect();
          c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) };
        }
      }
      return c;
    }
    function clipTo(r, c) {
      var l = Math.max(r.left, c.left), t = Math.max(r.top, c.top), rr = Math.min(r.right, c.right), b = Math.min(r.bottom, c.bottom);
      return rr > l && b > t ? { left: l, top: t, right: rr, bottom: b, width: rr - l, height: b - t } : null;
    }
    function pointInClip(el, x, y, root) { var c = clipRect(el, root); return x >= c.left && x <= c.right && y >= c.top && y <= c.bottom; }
    function inView(el, r) { var c = clipRect(el); return r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom; }
    function clippedX(el) {  // 'scroll' = inside a horizontal scroller (fine), 'hidden' = silently cut off, false = spills
      var cut = false;
      for (var p = el.parentElement; p && p !== device; p = p.parentElement) {
        var ox = getComputedStyle(p).overflowX;
        if (ox === 'visible') continue;
        var r = p.getBoundingClientRect();
        if (r.right > D.right + 1 || r.left < D.left - 1) continue;
        if (ox === 'auto' || ox === 'scroll') return 'scroll';
        cut = 'hidden';
      }
      return cut;
    }
    function isControl(el) {
      return el.matches('button,a[href],select,textarea,input:not([type=hidden]),[role=button],.list-item,.chip,.card[data-go],' + ACTION_SEL) &&
        !el.matches('form,label,.field input,.field textarea,.field select,.search-bar input,[data-links]:not(button):not(a)');
    }
    function hasBehaviour(el) {
      if (el.matches('input,select,textarea,label,.switch *,.segmented>button')) return true;
      var owner = el.closest(ACTION_SEL);
      if (owner && owner.tagName !== 'FORM') return true;
      if (el.matches('button[type=submit],button:not([type])') && el.closest('form')) return true;
      return false;
    }
    function describe(el) {
      if (!el || !el.tagName) return '';
      var s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      var cls = (el.getAttribute('class') || '').split(/\s+/).filter(function (c) { return c && !/^(active|open|on|rpl-clip|has-nav)$/.test(c); }).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      var t = short((el.innerText || el.getAttribute('aria-label') || '').trim());
      return t ? s + ' "' + t + '"' : s;
    }
    function short(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > 32 ? t.slice(0, 31) + '…' : t; }
    function area(r) { return r.width * r.height; }
    function overlap(a, b) { var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0 && h > 0 ? w * h : 0; }
    function isLarge(cs) { var f = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400; return f >= 24 || (f >= 18.66 && w >= 700); }
    function contrastOf(el, cs) {
      var fg = parseColor(cs.color); if (!fg) return null;
      var layers = [];
      for (var p = el; p; p = p.parentElement) {
        var pcs = getComputedStyle(p);
        if (pcs.backgroundImage && pcs.backgroundImage !== 'none') return null;
        var bg = parseColor(pcs.backgroundColor);
        if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; }
        if (p === device) break;
      }
      var base = [255, 255, 255, 1];
      for (var i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
      var f = blend(fg, base);
      var L1 = lum(f), L2 = lum(base);
      return { ratio: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), fg: hex(f), bg: hex(base) };
    }
  }

  /* colour helpers (shared) */
  function parseColor(s) {
    if (!s) return null; s = s.trim();
    var m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) { var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = s.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      var h = m[1]; if (h.length <= 4) h = h.split('').map(function (c) { return c + c; }).join('');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    m = s.match(/^color\(srgb ([^)]+)\)$/);
    if (m) { var q = m[1].split(/[\s\/]+/).filter(Boolean).map(parseFloat); return [q[0] * 255, q[1] * 255, q[2] * 255, q.length > 3 ? q[3] : 1]; }
    return null;
  }
  function blend(top, base) { var a = top[3]; return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1]; }
  function lum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function hex(c) { return '#' + c.slice(0, 3).map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function rgbToHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) { var d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
