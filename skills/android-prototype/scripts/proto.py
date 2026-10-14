#!/usr/bin/env python3
"""Android prototype toolkit — dependency-free (Python 3.8+, Google Chrome/Chromium for rendering).

  proto.py new     app.src.html --name "Sprout" [--lang ko]       scaffold a source file from the starter
  proto.py palette --seed "#2f6b4f" [--exact] [--style tonal|vibrant|muted] [--dark] [--write app.src.html]
  proto.py build   app.src.html [-o app.html]                      inline the shell -> one self-contained HTML
  proto.py audit   app.src.html|app.html [--json] [--all]          open every screen/overlay in Chrome, report layout problems
  proto.py shots   app.html [--out shots] [--scale 1]              PNG of every screen + overlay, plus contact.png
  proto.py check   app.src.html [--out shots]                      build + audit + shots in one go  (the main loop)
  proto.py board   a.src.html b.src.html c.src.html [--labels "A · Calm" ...] [--screen home ...] -o directions.png
  proto.py frames  app.src.html --screen splash [--at 0.3 1 2 4] [-o splash-frames.png]   motion filmstrip (real timing)

Source files may pull in parts with <!-- @include parts/screen-name.html --> (path relative to the source file).

Source files (*.src.html) link the shell via <link data-shell>/<script data-shell>; `build` inlines them so the
delivered prototype is a single file that opens anywhere. Exit code of audit/check is 1 when errors are found.
"""
import argparse
import concurrent.futures as cf
import html as htmllib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"
W, H = 412, 915

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]
CHROME_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser", "chrome"]


# ----------------------------------------------------------------------------- chrome
def find_chrome():
    env = os.environ.get("PROTO_CHROME")
    if env and Path(env).exists():
        return env
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    for n in CHROME_NAMES:
        p = shutil.which(n)
        if p:
            return p
    return None


def chrome_cmd(extra, url, window):
    chrome = find_chrome()
    if not chrome:
        sys.exit("No Chrome/Chromium found. Install Google Chrome or set PROTO_CHROME=/path/to/chrome.")
    return [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
            "--disable-extensions", "--mute-audio", "--allow-file-access-from-files",
            "--window-size=%d,%d" % window] + extra + [url]


def run_chrome(extra, url, window, timeout=90):
    last = None
    for _ in range(2):  # a busy machine occasionally makes the first launch fail
        prof = tempfile.mkdtemp(prefix="proto-chrome-")
        try:
            r = subprocess.run(chrome_cmd(["--user-data-dir=" + prof] + extra, url, window),
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
            return r.stdout.decode("utf-8", "replace")
        except subprocess.TimeoutExpired as e:
            last = e
        finally:
            shutil.rmtree(prof, ignore_errors=True)
    raise RuntimeError("Chrome timed out: %s" % last)


def file_url(path, query="", frag=""):
    u = Path(path).resolve().as_uri()
    if query:
        u += "?" + query
    if frag:
        u += "#" + frag
    return u


# ----------------------------------------------------------------------------- build
SHELL_LINK = re.compile(r"<link\b[^>]*\bdata-shell\b[^>]*>", re.I)
SHELL_SCRIPT = re.compile(r"<script\b[^>]*\bdata-shell\b[^>]*>\s*</script>", re.I)


INCLUDE = re.compile(r"<!--\s*@include\s+(\S+)\s*-->")


def is_source(text):
    return bool(SHELL_LINK.search(text) or SHELL_SCRIPT.search(text) or INCLUDE.search(text))


def expand_includes(text, base, depth=0):
    def sub(m):
        p = (base / m.group(1)).resolve()
        if not p.exists():
            raise RuntimeError("@include not found: %s" % p)
        if depth > 4:
            raise RuntimeError("@include nested too deeply at %s" % p)
        return expand_includes(p.read_text(encoding="utf-8"), p.parent, depth + 1)
    return INCLUDE.sub(sub, text)


def built_path(src):
    src = Path(src)
    name = src.name
    if name.endswith(".src.html"):
        return src.with_name(name[: -len(".src.html")] + ".html")
    return src.with_name(src.stem + ".built.html")


def build(src, out=None, quiet=False):
    src = Path(src)
    text = src.read_text(encoding="utf-8")
    if not is_source(text):
        return src  # already self-contained
    text = expand_includes(text, src.parent)
    css = (ASSETS / "shell.css").read_text(encoding="utf-8")
    js = (ASSETS / "shell.js").read_text(encoding="utf-8")
    text = SHELL_LINK.sub(lambda m: "<style data-shell>\n" + css + "\n</style>", text, count=1)
    text = SHELL_SCRIPT.sub(lambda m: "<script data-shell>\n" + js + "\n</script>", text, count=1)
    out = Path(out) if out else built_path(src)
    out.write_text(text, encoding="utf-8")
    if not quiet:
        print("built %s  (%d KB, self-contained)" % (out, round(out.stat().st_size / 1024)))
    return out


def ensure_built(path):
    p = Path(path)
    if not p.exists():
        sys.exit("No such file: %s" % p)
    return build(p, quiet=True) if is_source(p.read_text(encoding="utf-8")) else p


# ----------------------------------------------------------------------------- new
def cmd_new(a):
    out = Path(a.path)
    if not out.name.endswith(".src.html"):
        sys.exit("Name the source file *.src.html (e.g. app.src.html); `build` writes app.html next to it.")
    if out.exists() and not a.force:
        sys.exit("%s exists (use --force to overwrite)." % out)
    out.parent.mkdir(parents=True, exist_ok=True)
    t = (ASSETS / "starter.src.html").read_text(encoding="utf-8")
    t = (t.replace("{{APP_NAME}}", htmllib.escape(a.name)).replace("{{LANG}}", a.lang)
          .replace("{{SHELL_CSS}}", (ASSETS / "shell.css").resolve().as_uri())
          .replace("{{SHELL_JS}}", (ASSETS / "shell.js").resolve().as_uri()))
    out.write_text(t, encoding="utf-8")
    print("created %s — replace every STARTER screen; run `proto.py palette --write` for colours." % out)
    notes = out.parent / "DESIGN_NOTES.md"
    if not notes.exists() and not a.no_notes:
        notes.write_text((ASSETS / "design-notes.template.md").read_text(encoding="utf-8").replace("{{APP_NAME}}", a.name), encoding="utf-8")
        print("created %s — fill it in as each flow is approved." % notes)


# ----------------------------------------------------------------------------- palette (CIE LCh tones ≈ Material tones)
def _srgb_to_lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _lin_to_srgb(c):
    c = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return c * 255.0


def hex_to_rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        sys.exit("Bad colour: %r (use #rrggbb)" % h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return "#" + "".join("%02x" % max(0, min(255, int(round(v)))) for v in rgb)


WHITE = (0.95047, 1.0, 1.08883)


def rgb_to_lch(rgb):
    r, g, b = (_srgb_to_lin(v) for v in rgb)
    x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b

    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x / WHITE[0]), f(y / WHITE[1]), f(z / WHITE[2])
    L, A, B = 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
    return L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360


def _lch_to_rgb_raw(L, C, h):
    A, B = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    fy = (L + 16) / 116
    fx, fz = fy + A / 500, fy - B / 200

    def finv(t):
        return t ** 3 if t ** 3 > 216 / 24389 else (116 * t - 16) / (24389 / 27)
    x, y, z = finv(fx) * WHITE[0], finv(fy) * WHITE[1], finv(fz) * WHITE[2]
    r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
    g = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
    b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    return r, g, b


def lch_to_rgb(L, C, h):
    """Keep tone (L*) and hue exact; reduce chroma until the colour fits sRGB."""
    lo, hi = 0.0, C
    best = _lch_to_rgb_raw(L, 0, h)
    for _ in range(24):
        mid = (lo + hi) / 2
        rgb = _lch_to_rgb_raw(L, mid, h)
        if all(-1e-4 <= v <= 1 + 1e-4 for v in rgb):
            best, lo = rgb, mid
        else:
            hi = mid
    return tuple(_lin_to_srgb(max(0.0, min(1.0, v))) for v in best)


def tone(h, c, t):
    return rgb_to_hex(lch_to_rgb(t, c, h))


def rel_lum(rgb):
    r, g, b = (_srgb_to_lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(h1, h2):
    a, b = rel_lum(hex_to_rgb(h1)), rel_lum(hex_to_rgb(h2))
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


STYLES = {  # chroma for primary / secondary / tertiary / neutral / neutral-variant
    "tonal": (None, 16, 24, 4, 8),
    "vibrant": (None, 28, 36, 8, 12),
    "muted": (24, 8, 14, 2, 4),
}


def make_palette(seed, style="tonal", exact=False, sec_hue=None, ter_hue=None, ter_shift=60, neutral_chroma=None):
    L, C, h = rgb_to_lch(hex_to_rgb(seed))
    pc, sc, tc, nc, nvc = STYLES[style]
    pc = pc if pc is not None else max(C, 36) if style == "vibrant" else max(min(C, 64), 28)
    if neutral_chroma is not None:
        nc, nvc = neutral_chroma, neutral_chroma * 2
    sh = h if sec_hue is None else sec_hue
    th = (h + ter_shift) % 360 if ter_hue is None else ter_hue

    def roles(dark):
        P = lambda t: tone(h, pc, t)
        S = lambda t: tone(sh, sc, t)
        Tt = lambda t: tone(th, tc, t)
        E = lambda t: tone(25, 80, t)
        N = lambda t: tone(h, nc, t)
        NV = lambda t: tone(h, nvc, t)
        if not dark:
            r = {"primary": P(40), "on-primary": P(100), "primary-container": P(90), "on-primary-container": P(10),
                 "secondary": S(40), "on-secondary": S(100), "secondary-container": S(90), "on-secondary-container": S(10),
                 "tertiary": Tt(40), "on-tertiary": Tt(100), "tertiary-container": Tt(90), "on-tertiary-container": Tt(10),
                 "error": E(40), "on-error": E(100), "error-container": E(90), "on-error-container": E(10),
                 "surface": N(98), "surface-dim": N(87), "surface-bright": N(98), "surface-container-lowest": N(100),
                 "surface-container-low": N(96), "surface-container": N(94), "surface-container-high": N(92),
                 "surface-container-highest": N(90), "on-surface": N(10), "on-surface-variant": NV(30),
                 "outline": NV(50), "outline-variant": NV(80), "inverse-surface": N(20), "inverse-on-surface": N(95),
                 "inverse-primary": P(80)}
            if exact:
                r["primary"] = rgb_to_hex(hex_to_rgb(seed))
                r["on-primary"] = "#ffffff" if contrast("#ffffff", r["primary"]) >= 4.5 else P(10)
        else:
            r = {"primary": P(80), "on-primary": P(20), "primary-container": P(30), "on-primary-container": P(90),
                 "secondary": S(80), "on-secondary": S(20), "secondary-container": S(30), "on-secondary-container": S(90),
                 "tertiary": Tt(80), "on-tertiary": Tt(20), "tertiary-container": Tt(30), "on-tertiary-container": Tt(90),
                 "error": E(80), "on-error": E(20), "error-container": E(30), "on-error-container": E(90),
                 "surface": N(6), "surface-dim": N(6), "surface-bright": N(24), "surface-container-lowest": N(4),
                 "surface-container-low": N(10), "surface-container": N(12), "surface-container-high": N(17),
                 "surface-container-highest": N(22), "on-surface": N(90), "on-surface-variant": NV(80),
                 "outline": NV(60), "outline-variant": NV(30), "inverse-surface": N(90), "inverse-on-surface": N(20),
                 "inverse-primary": P(40)}
        return r
    return roles(False), roles(True), (L, C, h)


def palette_css(light, dark, comment, with_dark):
    def block(sel, r):
        items = list(r.items())
        lines = []
        for i in range(0, len(items), 4):
            lines.append("  " + ";".join("--%s:%s" % kv for kv in items[i:i + 4]) + ";")
        return sel + "{\n" + "\n".join(lines) + "\n}"
    css = "/* @theme:start — %s */\n" % comment + block(":root", light)
    if with_dark:
        css += "\n" + block(":root.dark", dark)
    return css + "\n/* @theme:end */"


THEME_BLOCK = re.compile(r"/\* @theme:start.*?@theme:end \*/", re.S)


def cmd_palette(a):
    light, dark, (L, C, h) = make_palette(a.seed, a.style, a.exact, a.secondary_hue, a.tertiary_hue, a.tertiary_shift, a.neutral_chroma)
    name = a.name or "seed-%s" % a.seed.lstrip("#").lower()
    comment = "generated: proto.py palette --seed %s --style %s%s" % (a.seed, a.style, " --exact" if a.exact else "")
    css = palette_css(light, dark, comment, a.dark)
    print(css)
    print("\nseed L*=%.0f C=%.0f h=%.0f°  |  primary/on-primary %.1f:1  on-surface/surface %.1f:1  on-surface-variant/surface %.1f:1"
          % (L, C, h, contrast(light["primary"], light["on-primary"]), contrast(light["on-surface"], light["surface"]),
             contrast(light["on-surface-variant"], light["surface"])), file=sys.stderr)
    if 245 <= h <= 290 and C > 25:
        print("note: purple/violet seed — the stock 'AI app' colour. Make sure the brief justifies it.", file=sys.stderr)
    if a.write:
        p = Path(a.write)
        t = p.read_text(encoding="utf-8")
        if not THEME_BLOCK.search(t):
            sys.exit("%s has no /* @theme:start */ … /* @theme:end */ block." % p)
        t = THEME_BLOCK.sub(lambda m: css, t, count=1)
        t = re.sub(r'(<html\b[^>]*\bdata-theme=")[^"]*(")', lambda m: m.group(1) + htmllib.escape(name) + m.group(2), t, count=1)
        p.write_text(t, encoding="utf-8")
        print("wrote theme '%s' into %s" % (name, p), file=sys.stderr)


# ----------------------------------------------------------------------------- audit
AUDIT_RE = re.compile(r'<script type="application/json" id="__audit">(.*?)</script>', re.S)


def run_audit(path):
    built = ensure_built(path)
    dom = run_chrome(["--virtual-time-budget=20000", "--run-all-compositor-stages-before-draw", "--dump-dom"],
                     file_url(built, "audit=1"), (800, 1200))
    m = AUDIT_RE.search(dom)
    if not m:
        raise RuntimeError("Audit produced no result — the page probably failed to load or threw before the shell booted. "
                           "Open %s in a browser and check the console." % built)
    data = json.loads(m.group(1))
    if data.get("fatal"):
        raise RuntimeError("Audit crashed inside the page:\n" + data["fatal"])
    data["file"] = str(built)
    Path(str(built)[:-5] + ".audit.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data


def print_report(data, show_all=False):
    issues = data["issues"]
    sev = {"error": [], "warn": [], "info": []}
    for i in issues:
        sev.setdefault(i["severity"], []).append(i)
    print("AUDIT  %s — %d screens, %d overlays, start #%s, theme '%s'" % (
        Path(data["file"]).name, len(data["screens"]), len(data["overlays"]), data.get("start"), data.get("theme") or "UNSET"))
    print("  %d errors · %d warnings · %d notes" % (len(sev["error"]), len(sev["warn"]), len(sev["info"])))
    labels = {"error": "ERRORS (fix before showing anyone)", "warn": "WARNINGS (fix, or have a reason)", "info": "NOTES"}
    for s in ("error", "warn", "info"):
        if not sev[s]:
            continue
        print("\n" + labels[s])
        by_kind = {}
        for i in sev[s]:
            by_kind.setdefault(i["kind"], []).append(i)
        for kind, items in by_kind.items():
            lim = len(items) if show_all else 6
            for i in items[:lim]:
                el = ("  " + i["el"]) if i["el"] else ""
                print("  [%s] %s%s — %s" % (kind, i["where"], el, i["detail"]))
            if len(items) > lim:
                print("  [%s] … %d more (use --all)" % (kind, len(items) - lim))
    print("\nscreens: " + ", ".join("#%s%s" % (s["id"], "*" if s["start"] else "") for s in data["screens"]))
    if data["overlays"]:
        print("overlays: " + ", ".join("@%s(%s on #%s)" % (o["id"], o["kind"], o["host"]) for o in data["overlays"]))
    return len(sev["error"])


def cmd_audit(a):
    data = run_audit(a.file)
    if a.json:
        print(json.dumps(data, ensure_ascii=False, indent=1))
        return 1 if any(i["severity"] == "error" for i in data["issues"]) else 0
    return 1 if print_report(data, a.all) else 0


# ----------------------------------------------------------------------------- shots
def shoot(built, frag, png, scale):
    run_chrome(["--virtual-time-budget=10000", "--force-device-scale-factor=%s" % scale, "--screenshot=%s" % Path(png).resolve()],
               file_url(built, "shot=1", frag), (W, H))
    if not Path(png).exists():
        raise RuntimeError("Chrome produced no screenshot for #%s" % frag)
    return png


def take_shots(built, data, out_dir, scale=1, overlays=True):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    jobs = []
    for n, s in enumerate(data["screens"], 1):
        jobs.append((s["id"], "%02d-%s.png" % (n, s["id"]), s["title"]))
    if overlays:
        idx = {s["id"]: n for n, s in enumerate(data["screens"], 1)}
        for o in data["overlays"]:
            jobs.append(("%s/%s" % (o["host"], o["id"]), "%02d-%s--%s.png" % (idx.get(o["host"], 0), o["host"], o["id"]), "%s (%s)" % (o["id"], o["kind"])))
    results = []
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(shoot, built, frag, out / name, scale): (frag, name, title) for frag, name, title in jobs}
        for f in cf.as_completed(futs):
            frag, name, title = futs[f]
            try:
                f.result()
                results.append((name, frag, title))
            except Exception as e:  # keep going; report at the end
                print("  ! %s: %s" % (frag, e), file=sys.stderr)
    order = {name: i for i, (_, name, _) in enumerate(jobs)}
    idx = {s["id"]: n for n, s in enumerate(data["screens"])}
    def key(r):  # host screen first, then its overlays
        host = r[1].split("/")[0]
        return (idx.get(host, 999), "/" in r[1], order[r[0]])
    results.sort(key=key)
    return results


def contact_sheet(out_dir, results, title):
    out = Path(out_dir)
    n = len(results)
    if not n:
        return None
    cols = min(5, n) if n > 8 else min(4, n)
    tw, th = 260, round(260 * H / W)
    gap, pad, cap = 28, 32, 44
    rows = math.ceil(n / cols)
    width = pad * 2 + cols * tw + (cols - 1) * gap
    height = pad * 2 + 56 + rows * (th + cap) + (rows - 1) * gap
    figs = "".join(
        '<figure><img src="%s"><figcaption><b>%s</b><span>#%s</span></figcaption></figure>'
        % (htmllib.escape(name), htmllib.escape(t), htmllib.escape(frag)) for name, frag, t in results)
    page = ("<!doctype html><meta charset=utf-8><style>body{margin:0;padding:%dpx;background:#ecebe7;font:13px/1.3 system-ui,sans-serif;color:#222}"
            "h1{font:600 18px/1 system-ui;margin:0 0 30px}h1 span{color:#888;font-weight:400;margin-left:10px}"
            ".g{display:grid;grid-template-columns:repeat(%d,%dpx);gap:%dpx}figure{margin:0}"
            "img{width:%dpx;max-height:%dpx;height:auto;object-fit:contain;border-radius:14px;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 6px 18px -6px rgba(0,0,0,.25);display:block}"
            "figcaption{display:flex;justify-content:space-between;gap:8px;padding:8px 4px 0;white-space:nowrap;overflow:hidden}"
            "figcaption b{font-weight:600;overflow:hidden;text-overflow:ellipsis}figcaption span{color:#888}</style>"
            "<h1>%s<span>%d views</span></h1><div class=g>%s</div>") % (pad, cols, tw, gap, tw, th, htmllib.escape(title), n, figs)
    sheet = out / "contact.html"
    sheet.write_text(page, encoding="utf-8")
    png = out / "contact.png"
    run_chrome(["--virtual-time-budget=5000", "--screenshot=%s" % png.resolve()], file_url(sheet), (width, height))
    return png


def cmd_shots(a):
    built = ensure_built(a.file)
    data = run_audit(built)
    out = Path(a.out) if a.out else built.parent / (built.stem + "-shots")
    res = take_shots(built, data, out, a.scale, not a.no_overlays)
    png = contact_sheet(out, res, data.get("app") or built.stem)
    print("%d screenshots in %s/" % (len(res), out))
    if png:
        print("contact sheet: %s" % png)


def cmd_build(a):
    build(a.file, a.out)


def cmd_check(a):
    built = build(a.file, a.o) if is_source(Path(a.file).read_text(encoding="utf-8")) else Path(a.file)
    data = run_audit(built)
    errors = print_report(data, a.all)
    out = Path(a.out) if a.out else built.parent / (built.stem + "-shots")
    res = take_shots(built, data, out, a.scale, True)
    png = contact_sheet(out, res, data.get("app") or built.stem)
    print("\nprototype:     %s" % built)
    print("screenshots:   %s/  (%d)" % (out, len(res)))
    if png:
        print("contact sheet: %s   <- open it and LOOK before saying anything is done" % png)
    return 1 if errors else 0


# ----------------------------------------------------------------------------- board (checkpoint image)
def cmd_board(a):
    files = [ensure_built(f) for f in a.files]
    labels = a.labels or []
    tmp = Path(tempfile.mkdtemp(prefix="proto-board-"))
    cols = []
    for i, f in enumerate(files):
        data = run_audit(f)
        wanted = a.screen or [data["start"]]
        ids = {s["id"] for s in data["screens"]}
        shots = []
        for sid in wanted:
            frag = sid if sid in ids else data["start"]
            png = tmp / ("%d-%s.png" % (i, frag.replace("/", "--")))
            shoot(f, frag, png, 1)
            shots.append(png)
        errs = sum(1 for x in data["issues"] if x["severity"] == "error")
        cols.append({"label": labels[i] if i < len(labels) else "%s · %s" % (chr(65 + i), f.stem),
                     "shots": shots, "tokens": data["tokens"], "errors": errs})
    tw, th = 300, round(300 * H / W)
    n, rows = len(cols), max(len(c["shots"]) for c in cols)
    gap, pad = 36, 36
    width = pad * 2 + n * tw + (n - 1) * gap
    height = pad * 2 + 60 + rows * (th + 16) + 80
    sw_keys = ["primary", "primary-container", "secondary-container", "tertiary-container", "surface", "on-surface"]

    def font_name(v):
        return (v or "").split(",")[0].strip().strip('"\'') or "default"
    parts = []
    for c in cols:
        imgs = "".join('<img src="%s">' % p.as_uri() for p in c["shots"])
        sw = "".join('<i style="background:%s" title="%s"></i>' % (htmllib.escape(c["tokens"].get(k, "")), k) for k in sw_keys)
        meta = "%s / %s" % (font_name(c["tokens"].get("font-display")), font_name(c["tokens"].get("font-body")))
        warn = '<em>%d layout errors</em>' % c["errors"] if c["errors"] else ""
        parts.append('<section><h2>%s</h2>%s<div class=sw>%s</div><p>%s %s</p></section>' % (htmllib.escape(c["label"]), imgs, sw, htmllib.escape(meta), warn))
    page = ("<!doctype html><meta charset=utf-8><style>body{margin:0;padding:%dpx;background:#ecebe7;font:13px/1.4 system-ui,sans-serif;color:#222}"
            ".b{display:grid;grid-template-columns:repeat(%d,%dpx);gap:%dpx}h2{font:600 17px/1.2 system-ui;margin:0 0 14px}"
            "img{display:block;width:%dpx;max-height:%dpx;height:auto;object-fit:contain;border-radius:16px;margin-bottom:16px;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 10px 24px -8px rgba(0,0,0,.3)}"
            ".sw{display:flex;gap:6px;margin:4px 0 8px}.sw i{width:30px;height:30px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}"
            "p{margin:0;color:#555}em{color:#b3261e;font-style:normal;margin-left:6px}</style><div class=b>%s</div>"
            ) % (pad, n, tw, gap, tw, th, "".join(parts))
    sheet = tmp / "board.html"
    sheet.write_text(page, encoding="utf-8")
    out = Path(a.o)
    out.parent.mkdir(parents=True, exist_ok=True)
    run_chrome(["--virtual-time-budget=5000", "--screenshot=%s" % out.resolve()], file_url(sheet), (width, height))
    shutil.rmtree(tmp, ignore_errors=True)
    print("board: %s  (%d directions × %d screen%s)" % (out, n, rows, "s" if rows > 1 else ""))


# ----------------------------------------------------------------------------- frames (motion filmstrip)
def cmd_frames(a):
    built = ensure_built(a.file)
    times = a.at or [0.3, 0.8, 1.5, 2.5, 4.0]
    out = Path(a.o) if a.o else built.parent / ("%s-%s-frames.png" % (built.stem, a.screen.replace("/", "--")))
    tmp = Path(tempfile.mkdtemp(prefix="proto-frames-"))
    shots = []

    def one(i_t):
        i, t = i_t
        png = tmp / ("%02d.png" % i)
        run_chrome(["--virtual-time-budget=%d" % int(t * 1000 + 4000), "--screenshot=%s" % png.resolve()],
                   file_url(built, "film=%g" % t, a.screen), (W, H))
        return png, t
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        shots = list(ex.map(one, enumerate(times)))
    tw, th = 240, round(240 * H / W)
    n = len(shots)
    figs = "".join('<figure><img src="%s"><figcaption>%.1fs</figcaption></figure>' % (p.as_uri(), t) for p, t in shots if p.exists())
    page = ("<!doctype html><meta charset=utf-8><style>body{margin:0;padding:28px;background:#ecebe7;font:13px system-ui,sans-serif;color:#333}"
            "h1{font:600 16px system-ui;margin:0 0 18px}.r{display:flex;gap:18px}figure{margin:0}"
            "img{display:block;width:%dpx;height:auto;border-radius:14px;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 6px 18px -6px rgba(0,0,0,.25)}"
            "figcaption{padding-top:6px;color:#666}</style><h1>#%s — motion over time</h1><div class=r>%s</div>") % (tw, htmllib.escape(a.screen), figs)
    sheet = tmp / "frames.html"
    sheet.write_text(page, encoding="utf-8")
    run_chrome(["--virtual-time-budget=4000", "--screenshot=%s" % out.resolve()], file_url(sheet), (56 + n * tw + (n - 1) * 18, 56 + 34 + th + 30))
    shutil.rmtree(tmp, ignore_errors=True)
    print("frames: %s  (%s s)" % (out, ", ".join("%.1f" % t for t in times)))


# ----------------------------------------------------------------------------- cli
def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("new", help="scaffold a *.src.html from the starter")
    s.add_argument("path"); s.add_argument("--name", required=True); s.add_argument("--lang", default="en", help="UI language (html lang); use ko for Korean users"); s.add_argument("--force", action="store_true")
    s.add_argument("--no-notes", action="store_true", help="don't create DESIGN_NOTES.md")
    s.set_defaults(fn=cmd_new)

    s = sub.add_parser("palette", help="Material-style colour roles from one seed colour")
    s.add_argument("--seed", required=True); s.add_argument("--style", choices=sorted(STYLES), default="tonal")
    s.add_argument("--exact", action="store_true", help="use the seed itself as --primary (brand colour)")
    s.add_argument("--secondary-hue", type=float); s.add_argument("--tertiary-hue", type=float)
    s.add_argument("--tertiary-shift", type=float, default=60); s.add_argument("--neutral-chroma", type=float)
    s.add_argument("--dark", action="store_true", help="also emit :root.dark roles"); s.add_argument("--name", help="theme name for html[data-theme]")
    s.add_argument("--write", help="replace the @theme block in this source file")
    s.set_defaults(fn=cmd_palette)

    s = sub.add_parser("build", help="inline the shell into a single HTML file")
    s.add_argument("file"); s.add_argument("-o", "--out"); s.set_defaults(fn=cmd_build)

    s = sub.add_parser("audit", help="layout + navigation audit in headless Chrome")
    s.add_argument("file"); s.add_argument("--json", action="store_true"); s.add_argument("--all", action="store_true"); s.set_defaults(fn=cmd_audit)

    s = sub.add_parser("shots", help="screenshot every screen and overlay")
    s.add_argument("file"); s.add_argument("--out"); s.add_argument("--scale", default="1"); s.add_argument("--no-overlays", action="store_true")
    s.set_defaults(fn=cmd_shots)

    s = sub.add_parser("check", help="build + audit + shots")
    s.add_argument("file"); s.add_argument("-o", help="built file path"); s.add_argument("--out", help="screenshot folder")
    s.add_argument("--scale", default="1"); s.add_argument("--all", action="store_true"); s.set_defaults(fn=cmd_check)

    s = sub.add_parser("board", help="side-by-side direction board for the checkpoint")
    s.add_argument("files", nargs="+"); s.add_argument("--labels", nargs="+"); s.add_argument("--screen", action="append")
    s.add_argument("-o", required=True); s.set_defaults(fn=cmd_board)

    s = sub.add_parser("frames", help="filmstrip of one screen's motion at several moments")
    s.add_argument("file"); s.add_argument("--screen", required=True, help="screen id (or screen/overlay)")
    s.add_argument("--at", nargs="+", type=float, help="seconds after load (default 0.3 0.8 1.5 2.5 4)")
    s.add_argument("-o"); s.set_defaults(fn=cmd_frames)

    a = p.parse_args()
    try:
        rc = a.fn(a)
    except RuntimeError as e:
        sys.exit("error: %s" % e)
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
