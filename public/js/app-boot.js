// Startet die App auf vorgerenderten Seiten erst nach dem ersten Paint.
// scripts/prerender.mjs ersetzt dort das App-Bundle und seine modulepreload-
// Links durch dieses Skript (data-entry, data-preload). So lädt der Browser
// zuerst HTML, CSS und Schriften und zeigt die Seite; sonst teilt sich das
// CSS die Leitung mit rund 300 KB JavaScript, und auf langsamen
// Handy-Verbindungen erscheint die Seite Sekunden später. Die SPA-Shell
// (spa.html) lädt das Bundle weiter direkt.
(function () {
  var script = document.currentScript;
  var entry = script && script.getAttribute('data-entry');
  if (!entry) return;
  var preloads = (script.getAttribute('data-preload') || '').split(' ').filter(Boolean);
  var started = false;

  function start() {
    if (started) return;
    started = true;
    preloads.forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'modulepreload';
      link.crossOrigin = '';
      link.href = href;
      document.head.appendChild(link);
    });
    var app = document.createElement('script');
    app.type = 'module';
    app.crossOrigin = '';
    app.src = entry;
    document.head.appendChild(app);
  }

  // Das Paint-Ereignis kommt mit der Anzeige des Frames; requestAnimationFrame
  // allein liefe noch davor.
  function afterPaint() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setTimeout(start, 0);
      });
    });
  }

  // Ohne Paint-Ereignis (Hintergrund-Tab, sehr langsames CSS) startet die App trotzdem.
  setTimeout(start, 3000);
  try {
    var types = PerformanceObserver.supportedEntryTypes || [];
    if (types.indexOf('paint') === -1) throw new Error('paint timing');
    new PerformanceObserver(function (list, observer) {
      if (list.getEntriesByName('first-contentful-paint').length === 0) return;
      observer.disconnect();
      afterPaint();
    }).observe({ type: 'paint', buffered: true });
  } catch (e) {
    afterPaint();
  }
})();
