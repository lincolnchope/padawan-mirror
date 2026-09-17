/* ============================================================
   MUSIC page — Padawan Mirror
   Paste into index.html script section. Self-contained IIFE.
   Parent integration:
     showLayout('music') -> show #music-body, call loadMusic()
   API (:2008, verified):
     GET  /api/spotify/status -> { needs_auth, item:{name, artists:[{name}], is_playing} | null }
     POST /api/spotify/play|pause|next|prev  (no body)  -> re-GET status ~900ms later
   ============================================================ */
(function musicPage() {
  'use strict';

  var SP_STATUS = 'http://localhost:2008/api/spotify/status';
  var SP_LOGIN = 'http://localhost:2008/api/spotify/login';
  var SP_API = 'http://localhost:2008/api/spotify/';
  var POLL_MS = 5000;
  var REGET_MS = 900;

  var el = {
    card: null, label: null, track: null, artist: null, meta: null,
    transport: null, play: null, playIco: null, prev: null, next: null,
    auth: null, error: null
  };

  var playing = false;      // last known transport state
  var hasItem = false;      // last known "has a track" state
  var authNeeded = false;   // last known auth state
  var timer = null;         // poll timer
  var pageVisible = false;  // #music-body shown
  var inflight = false;     // status request in flight

  var ICO_PLAY = '<path d="M8 5v14l11-7z"/>';
  var ICO_PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

  function $(id) { return document.getElementById(id); }

  function grab() {
    el.card = $('music-card');
    el.label = $('music-label');
    el.track = $('music-track');
    el.artist = $('music-artist');
    el.meta = $('music-meta');
    el.transport = $('music-transport');
    el.play = $('music-play');
    el.playIco = $('music-play-ico');
    el.prev = $('music-prev');
    el.next = $('music-next');
    el.auth = $('music-auth');
    el.error = $('music-error');
    for (var k in el) { if (el[k] === null) return false; }
    return true;
  }

  function showError(msg) {
    el.error.textContent = msg;
    el.error.style.display = 'block';
  }

  function clearError() {
    el.error.textContent = '';
    el.error.style.display = 'none';
  }

  function setIcon(path) { el.playIco.innerHTML = path; }

  function setAuthNeeded(on) {
    authNeeded = on;
    el.auth.style.display = on ? 'flex' : 'none';
    el.transport.style.display = on ? 'none' : 'flex';
  }

  function setDisabled(on) {
    el.transport.classList.toggle('disabled', !!on);
  }

  // Render a status payload into the card.
  function render(data) {
    clearError();

    if (data && data.needs_auth) {
      authNeeded = true;
      hasItem = false;
      playing = false;
      el.card.classList.add('idle');
      el.label.textContent = 'Spotify';
      el.track.textContent = 'Spotify not connected';
      el.artist.textContent = '';
      el.meta.textContent = '';
      setAuthNeeded(true);
      setIcon(ICO_PLAY);
      return;
    }
    authNeeded = false;
    setAuthNeeded(false);

    var item = data && data.item ? data.item : null;
    if (!item) {
      hasItem = false;
      playing = false;
      el.card.classList.add('idle');
      el.label.textContent = 'Spotify';
      el.track.textContent = 'Not playing';
      el.artist.textContent = '';
      el.meta.textContent = '';
      setDisabled(false);
      setIcon(ICO_PLAY);
      return;
    }

    hasItem = true;
    playing = !!item.is_playing;
    el.card.classList.remove('idle');
    el.label.textContent = playing ? 'Now playing' : 'Paused';
    el.track.textContent = item.name || 'Unknown track';
    var names = [];
    if (item.artists && item.artists.length) {
      for (var i = 0; i < item.artists.length; i++) {
        if (item.artists[i] && item.artists[i].name) names.push(item.artists[i].name);
      }
    }
    el.artist.textContent = names.join(', ');
    el.meta.textContent = playing ? 'Playing' : 'Paused';
    el.meta.classList.toggle('music-state-playing', playing);
    setDisabled(false);
    setIcon(playing ? ICO_PAUSE : ICO_PLAY);
  }

  // One status poll cycle.
  function poll() {
    if (inflight) return;
    inflight = true;
    fetch(SP_STATUS)
      .then(function (r) {
        if (!r.ok) throw new Error('status HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        inflight = false;
        render(data);
      })
      .catch(function (err) {
        inflight = false;
        hasItem = false;
        playing = false;
        el.card.classList.add('idle');
        el.label.textContent = 'Spotify';
        el.track.textContent = 'Not playing';
        el.artist.textContent = '';
        el.meta.textContent = '';
        setAuthNeeded(false);
        setDisabled(true);
        setIcon(ICO_PLAY);
        showError('Music unavailable: ' + (err && err.message ? err.message : 'backend not reachable'));
      });
  }

  // POST an action, then re-GET status ~900ms later (backend needs the beat).
  function act(name) {
    if (authNeeded || !hasItem) return;
    fetch(SP_API + name, { method: 'POST' })
      .then(function () { setTimeout(poll, REGET_MS); })
      .catch(function () { setTimeout(poll, REGET_MS); });
  }

  function wire() {
    if (!grab()) return;
    el.prev.addEventListener('click', function () { act('prev'); });
    el.next.addEventListener('click', function () { act('next'); });
    el.play.addEventListener('click', function () { act(playing ? 'pause' : 'play'); });

    // Poll only while the page is visible (mirror tab shown) and tab not hidden.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stopPolling(); }
      else if (pageVisible) { poll(); startPolling(); }
    });

    window.addEventListener('resize', function () { /* no-op hook for parent */ });
  }

  function startPolling() {
    if (timer !== null) return;
    timer = setInterval(poll, POLL_MS);
  }

  function stopPolling() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }

  // Called by showLayout when the music layout is shown.
  function loadMusic() {
    if (!grab()) return;
    pageVisible = true;
    poll();
    startPolling();
  }

  // Called by showLayout when leaving the music layout.
  function unloadMusic() {
    pageVisible = false;
    stopPolling();
  }

  wire();
  // Expose for the parent showLayout switch.
  window.loadMusic = loadMusic;
  window.unloadMusic = unloadMusic;
})();