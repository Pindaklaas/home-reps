/* Líbano: consentimiento de cookies, píxeles, formulario y botón fijo. Sin dependencias. */
(function () {
  'use strict';

  // El build sustituye estos valores por las variables de entorno.
  var META_ID = '__META_PIXEL_ID__';
  var TIKTOK_ID = '__TIKTOK_PIXEL_ID__';
  var CONSENT_KEY = 'libano.consent';
  var LEAD_KEY = 'libano.lead';

  function isSet(id) { return !!id && id.indexOf('__') !== 0; }
  function store(type) { try { return window[type]; } catch (e) { return null; } }
  function get(type, key) { try { return store(type).getItem(key); } catch (e) { return null; } }
  function set(type, key, value) { try { store(type).setItem(key, value); } catch (e) {} }
  function remove(type, key) { try { store(type).removeItem(key); } catch (e) {} }

  /* ---------- Píxeles: solo se cargan con consentimiento ---------- */
  var pixelsLoaded = false;

  function loadPixels() {
    if (pixelsLoaded) return;
    pixelsLoaded = true;

    if (isSet(META_ID)) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', META_ID);
      window.fbq('track', 'PageView');
    }

    if (isSet(TIKTOK_ID)) {
      !function (w, d, t) {
        w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
        ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.load = function (e, n) {
          var r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
          ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r; ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {};
          var s = d.createElement('script'); s.type = 'text/javascript'; s.async = !0; s.src = r + '?sdkid=' + e + '&lib=' + t;
          var x = d.getElementsByTagName('script')[0]; x.parentNode.insertBefore(s, x);
        };
        ttq.load(TIKTOK_ID); ttq.page();
      }(window, document, 'ttq');
    }

    trackLeadIfPending();
  }

  /* El evento Lead se dispara en la página de gracias, una vez por envío. */
  function trackLeadIfPending() {
    if (!document.body.hasAttribute('data-thanks')) return;
    if (get('sessionStorage', LEAD_KEY) !== '1') return;
    remove('sessionStorage', LEAD_KEY);
    if (window.fbq) window.fbq('track', 'Lead');
    if (window.ttq) window.ttq.track('Lead');
  }

  /* ---------- Aviso de cookies ---------- */
  function showBanner() {
    if (document.getElementById('cookies')) return;
    var el = document.createElement('div');
    el.id = 'cookies';
    el.className = 'cookies';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Aviso de cookies');
    el.innerHTML =
      '<p>Usamos cookies de Meta y TikTok para medir si nuestros anuncios funcionan. Solo se activan si aceptas. ' +
      '<a href="privacidad.html#cookies">Más información</a></p>' +
      '<div class="cookies-actions">' +
      '<button type="button" class="btn btn-ghost" data-consent="denied">Rechazar</button>' +
      '<button type="button" class="btn btn-dark" data-consent="granted">Aceptar</button>' +
      '</div>';
    el.addEventListener('click', function (ev) {
      var choice = ev.target.getAttribute && ev.target.getAttribute('data-consent');
      if (!choice) return;
      set('localStorage', CONSENT_KEY, choice);
      el.remove();
      document.body.classList.remove('has-cookies');
      if (choice === 'granted') loadPixels();
    });
    document.body.appendChild(el);
    document.body.classList.add('has-cookies');
  }

  var consent = get('localStorage', CONSENT_KEY);
  if (consent === 'granted') loadPixels();
  else if (consent !== 'denied') showBanner();

  // Enlace "Cookies" del pie: permite cambiar la decisión.
  document.addEventListener('click', function (ev) {
    var link = ev.target.closest && ev.target.closest('[data-cookie-settings]');
    if (!link) return;
    ev.preventDefault();
    remove('localStorage', CONSENT_KEY);
    showBanner();
  });

  /* ---------- Formulario ---------- */
  var form = document.getElementById('lead-form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var button = form.querySelector('button[type="submit"]');
      var error = document.getElementById('form-error');
      var isLocal = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);
      error.hidden = true;
      button.disabled = true;
      button.textContent = 'Enviando…';

      function done() {
        set('sessionStorage', LEAD_KEY, '1');
        location.href = 'gracias.html';
      }
      function fail() {
        if (isLocal) return done(); // en local no hay servidor que reciba el formulario
        button.disabled = false;
        button.textContent = 'Quiero mi diseño gratis';
        error.hidden = false;
      }

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(function (res) { res.ok ? done() : fail(); }).catch(fail);
    });
  }

  /* ---------- Botón fijo en móvil ---------- */
  var sticky = document.getElementById('sticky-cta');
  var hero = document.getElementById('hero');
  var contact = document.getElementById('contacto');
  if (sticky && hero && contact && 'IntersectionObserver' in window) {
    var heroVisible = true, contactVisible = false;
    var update = function () { sticky.classList.toggle('is-visible', !heroVisible && !contactVisible); };
    new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; update(); }).observe(hero);
    new IntersectionObserver(function (e) { contactVisible = e[0].isIntersecting; update(); }, { threshold: 0.15 }).observe(contact);
  }
})();
