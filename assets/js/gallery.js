/* SOLUM — gallery lightbox. Without JS, each photo is simply a link to the
   large image.
   Open: quick fade-in. Next/previous: the photo slides out and the new one
   slides in. Close: fade-out. */
(function () {
  'use strict';
  var all = Array.prototype.slice.call(document.querySelectorAll('.photo-link'));
  if (!all.length || typeof HTMLDialogElement === 'undefined') return;

  // Section links: clicking one shows only that section ("All" shows everything).
  // Links to empty sections are hidden, and the row disappears when fewer than
  // two sections are in use. Without JS the links simply jump down the page.
  var nav = document.querySelector('.gallery-nav');
  if (nav) {
    var sections = Array.prototype.slice.call(document.querySelectorAll('.gallery-section'))
      .filter(function (sec) { return sec.querySelector('.photo'); });
    var links0 = Array.prototype.slice.call(nav.querySelectorAll('a'));
    links0.forEach(function (a) {
      var sec = document.querySelector(a.getAttribute('href'));
      a.hidden = !(sec && sec.querySelector('.photo'));
    });
    if (sections.length < 2) {
      nav.classList.add('one');
    } else {
      var allLink = document.createElement('a');
      allLink.href = '#all';
      allLink.textContent = 'All';
      nav.insertBefore(allLink, nav.firstChild);

      var wrapEl = document.querySelector('.gallery-all');
      var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var swapTimer, doneTimer;
      var show = function (id, push, instant) {
        var valid = sections.some(function (sec) { return sec.id === id; });
        var which = valid ? id : 'all';
        Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
          var on = a.getAttribute('href') === '#' + which;
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
        if (push && window.history && history.replaceState) {
          history.replaceState(null, '', which === 'all' ? location.pathname + location.search : '#' + which);
        }
        var apply = function () {
          sections.forEach(function (sec) { sec.hidden = !(which === 'all' || sec.id === which); });
        };
        clearTimeout(swapTimer); clearTimeout(doneTimer);
        if (instant || calm || !wrapEl) { apply(); return; }
        // fade what is showing out, swap the sections, fade the new view in
        wrapEl.classList.remove('swap-in');
        wrapEl.classList.add('swap-out');
        swapTimer = setTimeout(function () {
          apply();
          wrapEl.classList.remove('swap-out');
          void wrapEl.offsetWidth;
          wrapEl.classList.add('swap-in');
          doneTimer = setTimeout(function () { wrapEl.classList.remove('swap-in'); }, 600);
        }, 260);
      };
      nav.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        show(a.getAttribute('href').slice(1), true);
      });
      window.addEventListener('hashchange', function () { show(location.hash.slice(1), false); });
      show(location.hash.slice(1), false, true);   // open straight onto #pedals, say
    }
  }

  // The viewer steps through the photos of one section at a time.
  var links = all;

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SLIDE = reduce ? 0 : 380;   // ms; matches the CSS transition
  var FADE = reduce ? 0 : 350;

  var dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Photo viewer');
  dlg.innerHTML =
    '<button class="lb-close" type="button" aria-label="Close">&#10005;</button>' +
    '<button class="lb-nav lb-prev" type="button" aria-label="Previous photo">&#8592;</button>' +
    '<button class="lb-nav lb-next" type="button" aria-label="Next photo">&#8594;</button>' +
    '<figure class="lb-fig"><img class="lb-img" alt="" /><figcaption class="lb-cap"></figcaption></figure>' +
    '<p class="lb-count" aria-hidden="true"></p>';
  document.body.appendChild(dlg);

  var fig = dlg.querySelector('.lb-fig');
  var img = dlg.querySelector('.lb-img');
  var cap = dlg.querySelector('.lb-cap');
  var count = dlg.querySelector('.lb-count');
  var cur = 0, seq = 0, closing = false;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function wrap(i) { return (i + links.length) % links.length; }

  // Put photo i into the viewer; calls done() once the image can be shown.
  function load(i, done) {
    cur = wrap(i);
    var a = links[cur];
    var thumb = a.querySelector('img');
    var text = a.parentNode.querySelector('figcaption');
    cap.textContent = text ? text.textContent : '';
    count.textContent = pad(cur + 1) + ' / ' + pad(links.length);
    img.alt = thumb ? thumb.alt : '';
    img.width = +a.getAttribute('data-w') || 0;
    img.height = +a.getAttribute('data-h') || 0;
    var finished = false;
    function fin() { if (!finished) { finished = true; done(); } }
    img.onload = fin; img.onerror = fin;
    img.src = a.href;
    if (img.complete) fin();
    setTimeout(fin, 1500);   // never leave the viewer waiting
    // warm the neighbours
    [cur - 1, cur + 1].forEach(function (n) { var p = new Image(); p.src = links[wrap(n)].href; });
  }

  function open(i) {
    var my = ++seq;
    closing = false;
    dlg.classList.remove('closing', 'ready');
    fig.className = 'lb-fig';
    load(i, function () { if (my === seq) dlg.classList.add('ready'); });
    if (!dlg.open) dlg.showModal();
    root.classList.add('lb-open');
  }

  // dir: +1 next (current slides out left, new one arrives from the right)
  function go(dir) {
    if (closing) return;
    var my = ++seq;
    var from = dir > 0 ? 'l' : 'r';      // side the old photo leaves toward
    var into = dir > 0 ? 'r' : 'l';      // side the new photo arrives from
    fig.classList.remove('pre-l', 'pre-r');
    fig.classList.add('out-' + from);
    setTimeout(function () {
      if (my !== seq) return;
      load(cur + dir, function () {
        if (my !== seq) return;
        fig.classList.remove('out-l', 'out-r');
        fig.classList.add('pre-' + into);
        void fig.offsetWidth;            // commit the start position
        fig.classList.remove('pre-' + into);
      });
    }, SLIDE * 0.7);
  }

  function close() {
    if (!dlg.open || closing) return;
    closing = true;
    seq++;
    dlg.classList.add('closing');
    setTimeout(function () {
      dlg.close();
      dlg.classList.remove('closing', 'ready');
      closing = false;
    }, FADE);
  }

  all.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let "open in new tab" work
      e.preventDefault();
      var group = a.closest('.gallery');
      links = group ? Array.prototype.slice.call(group.querySelectorAll('.photo-link')) : all;
      open(links.indexOf(a));
    });
  });

  dlg.addEventListener('close', function () { root.classList.remove('lb-open'); });
  // Esc: fade out instead of vanishing
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  dlg.querySelector('.lb-close').addEventListener('click', close);
  dlg.querySelector('.lb-prev').addEventListener('click', function () { go(-1); });
  dlg.querySelector('.lb-next').addEventListener('click', function () { go(1); });
  // click on the dark area (not the photo or buttons) closes
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === fig) close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  // swipe
  var x0 = null, y0 = 0;
  dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  dlg.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
