// ================= TIMER (Padawan Mirror) =================
// Countdown + stopwatch. Giant MM:SS digits. Survives reloads via
// localStorage 'padawan_timer_state_v1' (endTs stored when running).
// Chime via speechSynthesis (en-AU) when countdown hits zero.
(function () {
  var LS_KEY = 'padawan_timer_state_v1';
  var DEFAULT_PRESET = 5; // minutes
  var SPEECH_TEXT = 'Time is up';
  var SPEECH_LANG = 'en-AU';

  var clockEl = document.getElementById('timer-clock');
  var statusEl = document.getElementById('timer-status');
  var startBtn = document.getElementById('timer-start');
  var stopBtn = document.getElementById('timer-stop');
  var resetBtn = document.getElementById('timer-reset');
  var presetsEl = document.getElementById('timer-presets');
  if (!clockEl || !statusEl || !startBtn || !stopBtn || !resetBtn) return;

  // ---- state ----
  var mode = 'countdown';        // 'countdown' | 'stopwatch'
  var totalSeconds = DEFAULT_PRESET * 60; // countdown duration
  var running = false;
  var tickId = null;
  var endTs = null;              // epoch ms when countdown finishes
  var startTs = null;            // epoch ms when stopwatch started
  var stopwatchElapsed = 0;      // ms banked while stopped
  var finished = false;          // countdown hit zero this run

  function fmt(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60), s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // ---- persistence ----
  function saveState() {
    var s = { mode: mode, totalSeconds: totalSeconds, running: running, v: 1 };
    if (mode === 'countdown') {
      if (running && endTs) s.endTs = endTs;
      if (finished) s.finished = true;
    } else {
      if (running && startTs) s.startTs = startTs;
      s.stopwatchElapsed = stopwatchElapsed;
    }
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function loadState() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return;
    if (d.mode === 'stopwatch') {
      mode = 'stopwatch';
      stopwatchElapsed = Number(d.stopwatchElapsed) || 0;
      startTs = Number(d.startTs) || null;
      if (startTs && startTs <= Date.now()) {
        running = true;
      } else {
        startTs = null; running = false;
      }
    } else {
      mode = 'countdown';
      totalSeconds = Number(d.totalSeconds) || DEFAULT_PRESET * 60;
      if (totalSeconds < 1) totalSeconds = DEFAULT_PRESET * 60;
      endTs = Number(d.endTs) || null;
      if (d.finished) {
        finished = true;
      } else if (endTs && endTs > Date.now()) {
        running = true; // still running: restore from wall clock
      } else if (endTs) {
        finished = true; // expired while away
      } else {
        running = false; endTs = null;
      }
    }
  }

  // ---- chime ----
  function chime() {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(SPEECH_TEXT);
      u.lang = SPEECH_LANG;
      u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---- rendering ----
  function clockClass() {
    var cls = 'timer-clock';
    if (mode === 'countdown' && finished) cls += ' done';
    else if (running) cls += ' running';
    return cls;
  }

  function statusText() {
    if (mode === 'countdown') {
      if (finished) return 'Done';
      if (running) return 'Countdown . Running';
      return 'Countdown . Ready';
    }
    if (running) return 'Stopwatch . Running';
    return 'Stopwatch . Ready';
  }

  function render() {
    if (mode === 'countdown') {
      var remaining = finished ? 0 : (running && endTs ? Math.max(0, endTs - Date.now()) : totalSeconds * 1000);
      clockEl.textContent = fmt(remaining);
    } else {
      var elapsed = stopwatchElapsed + (running && startTs ? Date.now() - startTs : 0);
      clockEl.textContent = fmt(elapsed);
    }
    clockEl.className = clockClass();
    statusEl.textContent = statusText();
    statusEl.className = 'timer-status' + (mode === 'countdown' && finished ? ' done' : '');
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    document.getElementById('timer-body').classList.toggle('mode-stopwatch', mode === 'stopwatch');
  }

  function renderPresets() {
    if (!presetsEl) return;
    presetsEl.querySelectorAll('.timer-preset').forEach(function (btn) {
      btn.classList.toggle('active', mode === 'countdown' && !running && !finished
        && Number(btn.getAttribute('data-mins')) * 60 === totalSeconds);
    });
  }

  // ---- ticking ----
  function tick() {
    if (mode === 'countdown' && running && endTs !== null && Date.now() >= endTs) {
      finished = true;
      running = false;
      endTs = null;
      if (tickId) { clearInterval(tickId); tickId = null; }
      render();
      renderPresets();
      saveState();
      chime();
      return;
    }
    render();
  }

  function startTick() {
    if (tickId) return;
    tickId = setInterval(tick, 250);
  }

  function stopTick() {
    if (tickId) { clearInterval(tickId); tickId = null; }
  }

  // ---- actions ----
  function start() {
    if (running) return;
    if (mode === 'countdown') {
      if (finished) totalSeconds = DEFAULT_PRESET * 60; // fresh start after a done state
      finished = false;
      endTs = Date.now() + totalSeconds * 1000;
    } else {
      startTs = Date.now();
    }
    running = true;
    startTick();
    render();
    renderPresets();
    saveState();
  }

  function stop() {
    if (!running) return;
    if (mode === 'countdown') {
      endTs = null;
    } else {
      stopwatchElapsed += Date.now() - (startTs || Date.now());
      startTs = null;
    }
    running = false;
    stopTick();
    render();
    renderPresets();
    saveState();
  }

  function reset() {
    running = false;
    finished = false;
    stopTick();
    if (mode === 'countdown') { endTs = null; }
    else { stopwatchElapsed = 0; startTs = null; }
    render();
    renderPresets();
    saveState();
  }

  function setMode(m) {
    if (running) stop(); // switch mode stops the current run
    mode = m === 'stopwatch' ? 'stopwatch' : 'countdown';
    finished = false;
    if (mode === 'countdown') { endTs = null; }
    else { stopwatchElapsed = 0; startTs = null; }
    document.querySelectorAll('.timer-mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tmode') === mode);
    });
    render();
    renderPresets();
    saveState();
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
  resetBtn.addEventListener('click', reset);
  presetsEl.querySelectorAll('.timer-preset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (running || finished) return; // presets only when idle
      totalSeconds = (Number(btn.getAttribute('data-mins')) || DEFAULT_PRESET) * 60;
      finished = false;
      endTs = null;
      render();
      renderPresets();
      saveState();
    });
  });
  document.querySelectorAll('.timer-mode-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(btn.getAttribute('data-tmode')); });
  });

  // ---- boot: restore persisted state, then run ----
  loadState();
  document.querySelectorAll('.timer-mode-btn').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tmode') === mode);
  });
  render();
  renderPresets();
  if (running) startTick();
})();

// loadTimer() for the mirror's showLayout case
function loadTimer() {
  // page is wired by the IIFE above; nothing else needed here
}window.loadTimer = loadTimer;
