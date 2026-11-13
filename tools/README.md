# tools/

Helpers for maintaining the site. Nothing here is published: `_config.yml`
in the repo root excludes this folder from GitHub Pages.

## gallery.py: the photo gallery

Needs Python 3 and ImageMagick (the `magick` command). Run it from anywhere:

    tools/gallery.py                 # add the photos waiting in originals/
    tools/gallery.py new "Amps"      # create a new section

### The idea

The gallery page (`gallery/index.html`) is plain HTML. The script doesn't
edit it photo by photo; it **rebuilds the whole photo area from the folders
every time it runs**. So the folders are the truth and the page follows them.

    originals/<section>/                    inbox: drop pictures here (git-ignored)
    originals/<section>/done/               your originals, moved here once processed
    assets/img/gallery/<section>/           what the site shows (committed)
    gallery/index.html                      rebuilt from the line above

### Adding photos

1. Copy pictures into `originals/guitars/` (or `pedals/`, or any other section).
2. Run `tools/gallery.py`.
3. Check the page in the local preview.
4. Commit and push.

For each picture the script makes two WebP copies (800 px for the grid, 1600 px
for the viewer), fixes the rotation, **strips all metadata (including GPS
location)**, saves them in `assets/img/gallery/<section>/`, and moves your
original into `done/`. Originals are never copied into the repo.

Pictures dropped into a folder that isn't a section are skipped, with a message
telling you how to create the section.

### Sections

The sections are the ones listed in `gallery/index.html`. That list is the only
thing the script reads from the page. Each section looks like this:

    <section class="gallery-section" id="guitars">
      <h2 class="section-title" data-anim>Guitars</h2>
      <div class="gallery"> ...photos... </div>
    </section>

- **Add one:** `tools/gallery.py new "Amps"`.
- **Reorder sections:** move the `<section>` blocks in `gallery/index.html`
  (the whole block, between the two `sections:` marker comments).
- **Rename a heading:** edit the text inside `<h2>`. Keep the `id`.
- **Delete a section:** remove its block from the page and delete its folders.

### Captions and order

- **Caption** = the file name: `strat-neck-reset.jpg` becomes "Strat neck reset".
  Camera names (`IMG_4821.jpg`, `PXL_...`) get no caption.
- **Order** = newest first. Start a name with a number to pin it near the top:
  `1 strat-neck-reset.jpg`, `2-les-paul.jpg`. Pinned photos come first in number
  order, the rest follow, newest first. Adding photos never moves old ones.
  If two photos share a pin number, they sort by file name.

Published files are named so the order is part of the name, for example
`01-strat-neck-reset-800.webp` (pinned) or
`20261112-203015-999-strat-neck-reset-800.webp` (added 12 Nov 2026, 20:30:15).

### Changing or removing a photo

The page is rebuilt from `assets/img/gallery/<section>/`, so edit there, then
run `tools/gallery.py`:

- **Remove:** delete both files of the photo (`...-800.webp` and `...-1600.webp`).
- **Change the caption:** rename both files, changing only the words after the
  prefix. Keep the `-800` / `-1600` endings and the prefix.
- **Re-pin or unpin:** rename both files, changing the number prefix.

### Things to know

- **Don't hand-edit inside the photo area** of `gallery/index.html` (between
  `<!-- sections:start -->` and `<!-- sections:end -->`, and between
  `<!-- nav:start -->` and `<!-- nav:end -->`). It is overwritten on every run.
  Edit the rest of the page freely, but keep those marker comments.
- **Running it twice is safe.** With nothing in the inboxes it just rebuilds the
  page from what's already published.
- **How it finds each photo's address:** the page's links are generated from the
  file names in `assets/img/gallery/<section>/`. Nothing else is stored, so
  there is nothing to keep in sync.
- **The picture sizes** (800 and 1600) and the other settings are constants at
  the top of `gallery.py`.
