/* SOLUM — shared behaviour. Loaded in <head> (tiny, blocking) so the
   .js class is set before first paint and nothing flashes. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  root.classList.add('js');

  // Hamburger layout ("compact") below 50rem. Set before first paint so the
  // page never flashes the wrong bar; later changes fade (see sync() below).
  var compactMQ = window.matchMedia ? matchMedia('(max-width: 49.99rem)') : { matches: false };
  if (compactMQ.matches) root.classList.add('compact');

  // Arriving from another page of this site (a page switch): the glows are on
  // from the first frame, so the background doesn't change under the transition.
  var arriving = false;
  try { arriving = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
  if (arriving) root.classList.add('arriving');

  // Resolves once the page transition into this page (if any) has finished, so
  // the text rises in on a settled page instead of underneath the crossfade.
  var transitionDone = new Promise(function (resolve) {
    if (!('onpagereveal' in window)) { resolve(); return; }
    window.addEventListener('pagereveal', function (e) {
      if (e.viewTransition && e.viewTransition.finished) e.viewTransition.finished.then(resolve, resolve);
      else resolve();
    });
    setTimeout(resolve, 2000);   // never wait longer than this
  });

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Colours of the background tones, in RGB. Same tokens as site.css.
  var TONES = { ink: [30, 30, 27], ocean: [44, 61, 79], slate: [61, 65, 69] };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function init() {
    // ── SCROLL-DRIVEN BACKGROUND + GLOWS ────────────────────
    // Each [data-tone] section has a tone (and optionally a data-glow).
    // The colour blends between neighbouring sections as you scroll
    // normally. Nothing intercepts the wheel or touch.
    // (body only: <html data-tone> just sets the first-paint colour)
    var secs = Array.prototype.slice.call(doc.querySelectorAll('body [data-tone]'));
    var glows = {};
    Array.prototype.forEach.call(doc.querySelectorAll('.glow[data-glow]'), function (g) {
      glows[g.getAttribute('data-glow')] = g;
    });
    var bounds = [], ticking = false, glowsOn = false;

    // Boundaries are the tops of sections 1..n. Each tone change is spread
    // over a fixed scroll distance (a bit more than a screen) centred on
    // its boundary, so short pages blend gently instead of snapping.
    function measure() {
      var y = window.pageYOffset;
      bounds = secs.map(function (s) { return y + s.getBoundingClientRect().top; });
    }

    var lastY = window.pageYOffset;
    function paint() {
      ticking = false;
      var yy = window.pageYOffset, dy = yy - lastY;
      if (yy < 120 || dy < -6 || root.classList.contains('menu-open')) { root.classList.remove('hide-bar'); lastY = yy; }
      else if (dy > 6) { root.classList.add('hide-bar'); lastY = yy; }
      if (!secs.length) return;

      var vh = window.innerHeight;
      var maxY = Math.max(Math.max(root.scrollHeight, doc.body.scrollHeight) - vh, 1);
      var pr = clamp(yy / maxY);
      var REF0 = vh * 0.6;                       // reading line at the top of the page
      var ref = yy + vh * (0.6 + 0.4 * pr * pr); // slides down so the last tone is reachable
      var W = vh * 1.3;                          // scroll distance of one blend

      // Walk the sections, moving the colour toward each one in turn. No blend
      // may start before you scroll, so the page always opens on its first
      // tone: exactly the colour the CSS painted before this script ran.
      var col = (TONES[secs[0].getAttribute('data-tone')] || TONES.ink).slice();
      var w = {};                         // glow weights
      var g0 = secs[0].getAttribute('data-glow'); if (g0) w[g0] = 1;
      var prevS = REF0, prevE = REF0;
      for (var i = 1; i < secs.length; i++) {
        var st = Math.max(bounds[i] - W / 2, i === 1 ? REF0 + 1 : prevS + (prevE - prevS) * 0.5);
        var en = Math.max(bounds[i] + W / 2, st + W * 0.6);
        prevS = st; prevE = en;
        var t = smooth(clamp((ref - st) / (en - st)));
        if (t <= 0) break;
        var to = TONES[secs[i].getAttribute('data-tone')] || col;
        col = [lerp(col[0], to[0], t), lerp(col[1], to[1], t), lerp(col[2], to[2], t)];
        var gi = secs[i].getAttribute('data-glow');
        Object.keys(w).forEach(function (k) { w[k] *= (1 - t); });
        if (gi) w[gi] = (w[gi] || 0) + t;
      }
      root.style.setProperty('--bg', 'rgb(' + Math.round(col[0]) + ',' + Math.round(col[1]) + ',' + Math.round(col[2]) + ')');
      if (glowsOn) {
        Object.keys(glows).forEach(function (k) { glows[k].style.opacity = (w[k] || 0).toFixed(3); });
      }
    }

    function request() {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }

    function remeasure() { measure(); request(); }

    measure();
    paint();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(doc.body);

    // ── FADE-IN ─────────────────────────────────────────────
    var anims = doc.querySelectorAll('[data-anim], .fading-rule');

    // Stagger children of [data-stagger]
    Array.prototype.forEach.call(doc.querySelectorAll('[data-stagger]'), function (g) {
      Array.prototype.forEach.call(g.querySelectorAll('[data-anim]'), function (el, n) {
        // quicker on a page switch, and capped so long lists don't drag
        el.style.setProperty('--d', Math.min(n * (arriving ? 0.07 : 0.12), 0.7).toFixed(2) + 's');
      });
    });

    function start() {
      glowsOn = true;
      paint();
      if (reduce || !('IntersectionObserver' in window)) {
        Array.prototype.forEach.call(anims, function (el) { el.classList.add('on'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('on'); io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      Array.prototype.forEach.call(anims, function (el) { io.observe(el); });
    }

    // Start the rise only when the fonts have really loaded (document.fonts.ready
    // can report "ready" before Safari has even begun to fetch them, and a font
    // swapping in mid-rise looks like the animation restarting) and the page
    // transition is over.
    var started = false;
    function go() { if (!started) { started = true; requestAnimationFrame(start); } }
    if (arriving) { glowsOn = true; paint(); }   // glows are there from the first frame
    var fontsLoaded = (doc.fonts && doc.fonts.load)
      ? Promise.all([
          doc.fonts.load('200 1em Fahkwang'), doc.fonts.load('300 1em Fahkwang'), doc.fonts.load('400 1em Fahkwang'),
          doc.fonts.load('400 1em Lora'), doc.fonts.load('italic 400 1em Lora')
        ]).catch(function () {})
      : Promise.resolve();
    var fallback = setTimeout(go, 2500);   // failsafe: never leave the page hidden
    Promise.all([fontsLoaded, transitionDone]).then(function () { clearTimeout(fallback); go(); });

    // ── MOBILE MENU ─────────────────────────────────────────
    var btn = doc.querySelector('.menu-btn');
    var nav = doc.getElementById('site-nav');
    if (!btn || !nav) return;

    var inertTargets = doc.querySelectorAll('main, .site-footer, .brand');

    Array.prototype.forEach.call(nav.querySelectorAll('li'), function (li, n) {
      li.style.setProperty('--i', n);
    });

    function setOpen(open, returnFocus) {
      root.classList.toggle('menu-open', open);
      if (open) nav.scrollTop = 0;               // always open at the top, not where it was last scrolled
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      Array.prototype.forEach.call(inertTargets, function (el) {
        if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert');
      });
      if (open) {
        var first = nav.querySelector('a');
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
      } else if (returnFocus) {
        btn.focus({ preventScroll: true });
      }
    }

    btn.setAttribute('aria-label', 'Open menu');
    btn.addEventListener('click', function () {
      setOpen(!root.classList.contains('menu-open'), true);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) setOpen(false, true);
    });
    // Same-page link (e.g. current page): just close.
    nav.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && a.getAttribute('aria-current') === 'page') setOpen(false, false);
    });
    // Crossing the breakpoint: the old bar (links, or hamburger) fades out,
    // then the new one fades in, instead of one popping out and the other in.
    var swapTimer, doneTimer;
    var FADE_MS = reduce ? 0 : 260;
    function sync() {
      clearTimeout(swapTimer);
      var want = compactMQ.matches, have = root.classList.contains('compact');
      root.classList.remove('to-compact', 'to-wide');
      if (want === have) return;
      if (!want) setOpen(false, false);          // widening: close an open menu
      root.classList.add(want ? 'to-compact' : 'to-wide');
      swapTimer = setTimeout(function () {
        root.classList.add('no-anim');           // the layout itself flips with no transitions
        root.classList.toggle('compact', compactMQ.matches);
        root.classList.remove('to-compact', 'to-wide');
        root.classList.add('swapped');           // ...and the new bar fades in
        void root.offsetWidth;
        requestAnimationFrame(function () { root.classList.remove('no-anim'); });
        clearTimeout(doneTimer);
        doneTimer = setTimeout(function () { root.classList.remove('swapped'); }, 700);
      }, FADE_MS);
    }
    if (compactMQ.addEventListener) compactMQ.addEventListener('change', sync);
    else if (compactMQ.addListener) compactMQ.addListener(sync);
    // Coming back via the back button (bfcache): menu should be shut.
    window.addEventListener('pageshow', function (e) { if (e.persisted) setOpen(false, false); });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
