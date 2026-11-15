/* SOLUM — single-image viewer for the Solum Builder screenshots. Uses the
   gallery's lightbox styles, without next/previous. Without JS, each
   screenshot is simply a link to the full-size image. */
(function () {
  'use strict';
  var links = Array.prototype.slice.call(document.querySelectorAll('.shot > a'));
  if (!links.length || typeof HTMLDialogElement === 'undefined') return;

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FADE = reduce ? 0 : 350;   // ms; matches the CSS animation

  var dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Screenshot viewer');
  dlg.innerHTML =
    '<button class="lb-close" type="button" aria-label="Close">&#10005;</button>' +
    '<figure class="lb-fig"><img class="lb-img" alt="" /></figure>';
  document.body.appendChild(dlg);

  var fig = dlg.querySelector('.lb-fig');
  var img = dlg.querySelector('.lb-img');
  var seq = 0, closing = false;

  function open(a) {
    var my = ++seq;
    var thumb = a.querySelector('img');
    closing = false;
    dlg.classList.remove('closing', 'ready');
    img.alt = thumb ? thumb.alt : '';
    var finished = false;
    function fin() { if (!finished && my === seq) { finished = true; dlg.classList.add('ready'); } }
    img.onload = fin; img.onerror = fin;
    img.src = a.href;
    if (img.complete) fin();
    setTimeout(fin, 1500);   // never leave the viewer waiting
    if (!dlg.open) dlg.showModal();
    root.classList.add('lb-open');
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

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let "open in new tab" work
      e.preventDefault();
      open(a);
    });
  });

  dlg.addEventListener('close', function () { root.classList.remove('lb-open'); });
  // Esc: fade out instead of vanishing
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  dlg.querySelector('.lb-close').addEventListener('click', close);
  // click on the dark area (not the image) closes
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === fig) close(); });
})();
