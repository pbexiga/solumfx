#!/usr/bin/env python3
"""Solum gallery helper.

    tools/gallery.py                 # add the photos waiting in originals/
    tools/gallery.py new "Amps"      # create a new section

THE SECTIONS are the ones listed in gallery/index.html (Guitars, Pedals, ...).
Each has an inbox folder, originals/<section>/, and a published folder,
assets/img/gallery/<section>/. The published folder is what the site shows.

ADDING PHOTOS: drop pictures into originals/guitars/ (or pedals/ ...) and run
the script. For each one it makes two WebP sizes (800 and 1600 px wide), fixes
the rotation, STRIPS ALL METADATA (GPS included), puts them in the section's
published folder, and moves your original into originals/<section>/done/. Then
it rebuilds gallery/index.html. Review it, then commit and push.

CAPTIONS come from the file name: "strat-neck-reset.jpg" -> "Strat neck reset".
Camera names like IMG_4821.jpg get no caption.

ORDER: newest first. To pin a photo near the top, start its name with a number:
"1 strat-neck-reset.jpg", "2-les-paul.jpg". Numbered photos come first, in
number order; the rest follow, newest first. New photos never move old ones.

REMOVING a photo: delete its two files from assets/img/gallery/<section>/ and
run the script (it rebuilds the page). Needs ImageMagick (`magick`).
"""
import html, re, shutil, subprocess, sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ORIG = REPO / "originals"
OUT = REPO / "assets" / "img" / "gallery"
PAGE = REPO / "gallery" / "index.html"
EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
SIZES = (800, 1600)
CAMERA = re.compile(r"^(img|dsc|pxl|mvimg|photo|image|screenshot)?[- _]?\d[\d_\- .]*$", re.I)
SECTION_RE = re.compile(r'<section class="gallery-section" id="([a-z0-9-]+)">\s*<h2[^>]*>(.*?)</h2>', re.S)
PINNED = re.compile(r"^(\d{1,3})-(.+)-800\.webp$")             # 01-strat-neck-800.webp
DATED = re.compile(r"^(\d{8})-(\d{6})-(\d{3})-(.+)-800\.webp$")  # 20261112-203015-999-strat-neck-800.webp


def run(*a):
    return subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()


def natural(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "x"


def read_page():
    page = PAGE.read_text()
    for m in ("<!-- sections:start -->", "<!-- sections:end -->", "<!-- nav:start -->", "<!-- nav:end -->"):
        if m not in page:
            sys.exit("gallery/index.html is missing the marker %s" % m)
    region = page.split("<!-- sections:start -->", 1)[1].split("<!-- sections:end -->", 1)[0]
    return page, [(s, t) for s, t in SECTION_RE.findall(region)]


def put(text, a, b, inner):
    pre, rest = text.split(a, 1)
    _, post = rest.split(b, 1)
    return pre + a + inner + b + post


def sort_key(name):
    m = PINNED.match(name)
    if m:
        return (0, int(m.group(1)), name)
    m = DATED.match(name)
    if m:
        return (1, -int(m.group(1) + m.group(2) + m.group(3)), name)
    return (2, 0, name)


def name_part(name):
    m = PINNED.match(name)
    if m:
        return m.group(2)
    m = DATED.match(name)
    if m:
        return m.group(4)
    return re.sub(r"-800\.webp$", "", name)


def figure(slug, title, f):
    base = f.name[:-len("-800.webp")]
    small = OUT / slug / ("%s-800.webp" % base)
    big = OUT / slug / ("%s-1600.webp" % base)
    sw, sh = map(int, run("magick", "identify", "-format", "%w %h", str(small)).split())
    bw, bh = map(int, run("magick", "identify", "-format", "%w %h", str(big)).split())
    slugged = name_part(f.name)
    caption = "" if CAMERA.match(slugged.replace("-", " ")) else html.escape(slugged.replace("-", " ").capitalize())
    return (
        '            <figure class="photo" data-anim>\n'
        '              <a class="photo-link" href="/assets/img/gallery/{s}/{b}-1600.webp" data-w="{bw}" data-h="{bh}">\n'
        '                <span class="photo-frame"><img src="/assets/img/gallery/{s}/{b}-800.webp" width="{sw}" height="{sh}" alt="{a}" loading="lazy" decoding="async" /></span>\n'
        '              </a>\n'
        '{cap}'
        '            </figure>'.format(s=slug, b=base, bw=bw, bh=bh, sw=sw, sh=sh, a=caption or title,
                                       cap=('              <figcaption>%s</figcaption>\n' % caption) if caption else ''))


def add_photos(slug, title):
    inbox = ORIG / slug
    inbox.mkdir(parents=True, exist_ok=True)
    dest = OUT / slug
    dest.mkdir(parents=True, exist_ok=True)
    pics = sorted((p for p in inbox.iterdir() if p.is_file() and p.suffix.lower() in EXT and not p.name.startswith(".")),
                  key=lambda p: natural(p.name))
    if not pics:
        return 0
    taken = {name_part(f.name) for f in dest.glob("*-800.webp")}
    now = datetime.now()
    done = inbox / "done"
    done.mkdir(exist_ok=True)
    for i, f in enumerate(pics):
        m = re.match(r"^(\d{1,3})[\s._-]+(.+)$", f.stem)
        if m:
            prefix, raw = "%02d" % int(m.group(1)), m.group(2)
        else:
            # within one batch the first name comes out on top (sorted newest first)
            prefix, raw = "%s-%03d" % (now.strftime("%Y%m%d-%H%M%S"), 999 - i), f.stem
        name = slugify(raw)
        n = 2
        while name in taken:
            name = "%s-%d" % (slugify(raw), n)
            n += 1
        taken.add(name)
        base = "%s-%s" % (prefix, name)
        for w in SIZES:
            run("magick", str(f) + "[0]", "-auto-orient", "-strip", "-colorspace", "sRGB",
                "-resize", "%dx>" % w, "-quality", "80", "-define", "webp:method=6",
                str(dest / ("%s-%d.webp" % (base, w))))
        target = done / f.name
        if target.exists():
            target = done / ("%s-%s%s" % (f.stem, now.strftime("%H%M%S"), f.suffix))
        shutil.move(str(f), str(target))
        print("  added %-45s -> %s" % (f.name, base))
    return len(pics)


def rebuild(sections):
    page, _ = read_page()
    blocks, nav = [], []
    for slug, title in sections:
        files = sorted((OUT / slug).glob("*-800.webp"), key=lambda p: sort_key(p.name)) if (OUT / slug).is_dir() else []
        figs = [figure(slug, title, f) for f in files]
        blocks.append(
            '        <section class="gallery-section" id="%s">\n'
            '          <h2 class="section-title" data-anim>%s</h2>\n'
            '          <div class="gallery">\n%s\n          </div>\n'
            '        </section>\n' % (slug, title, "\n".join(figs)))
        nav.append('            <a href="#%s">%s</a>\n' % (slug, title))
        print("%-10s %d photo(s)" % (html.unescape(title), len(figs)))
    page = put(page, "<!-- sections:start -->", "<!-- sections:end -->", "\n" + "".join(blocks) + "        ")
    page = put(page, "<!-- nav:start -->", "<!-- nav:end -->", "\n" + "".join(nav) + "            ")
    PAGE.write_text(page)


def main():
    page, sections = read_page()
    if len(sys.argv) >= 2 and sys.argv[1] == "new":
        if len(sys.argv) != 3:
            sys.exit('usage: tools/gallery.py new "Section name"')
        title = sys.argv[2].strip()
        slug = slugify(title)
        if slug in [s for s, _ in sections]:
            sys.exit("Section '%s' already exists." % slug)
        sections.append((slug, html.escape(title[:1].upper() + title[1:])))
        (ORIG / slug).mkdir(parents=True, exist_ok=True)
        (OUT / slug).mkdir(parents=True, exist_ok=True)
        print("created section '%s'. Put pictures in originals/%s/ and run tools/gallery.py" % (slug, slug))
    elif len(sys.argv) > 1:
        sys.exit(__doc__)
    else:
        known = {s for s, _ in sections}
        if ORIG.is_dir():
            for d in sorted(ORIG.iterdir()):
                if d.is_dir() and not d.name.startswith(".") and d.name not in known and any(p.suffix.lower() in EXT for p in d.iterdir()):
                    print("! originals/%s/ is not a section, skipped. Sections: %s. Create one with: tools/gallery.py new \"%s\"" % (d.name, ", ".join(sorted(known)), d.name))
        for slug, title in sections:
            add_photos(slug, html.unescape(title))
    rebuild(sections)
    print("done. Review gallery/index.html, then commit.")


if __name__ == "__main__":
    main()
