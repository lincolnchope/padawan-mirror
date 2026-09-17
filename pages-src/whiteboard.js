// ================= whiteboard =================
// Draw with pointer events (mouse + touch), smooth lineTo strokes with round caps.
// Snapshot persisted as PNG dataURL in localStorage 'padawan_whiteboard_v1' on stroke end.
// Self-contained IIFE; parent wires: showLayout('whiteboard') -> loadWhiteboard().

(function () {
  'use strict';

  var STORE_KEY = 'padawan_whiteboard_v1';
  var COLORS = ['#f5f7fa', '#7ff0b8', '#fde047', '#f87171'];
  var SIZES = [4, 9, 18];
  var BG_COLOR = '#07130c';

  var canvas = null;
  var ctx = null;
  var drawing = false;
  var lastX = 0;
  var lastY = 0;
  var dirty = false;      // canvas content changed since last restore
  var saveTimer = null;
  var dirtySave = false;  // a stroke finished since the last save

  function $(id) { return document.getElementById(id); }

  function canvasEl() { return $('wb-canvas'); }

  // ---- sizing: fill the window body, honour devicePixelRatio ----
  function resizeCanvas(restore) {
    var c = canvasEl();
    if (!c || !c.parentElement) return;
    var rect = c.parentElement.getBoundingClientRect();
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);
    // hidden or collapsed: keep the current bitmap, retry when visible (ResizeObserver)
    if (w < 2 || h < 2) return;
    var dpr = window.devicePixelRatio || 1;
    if (c.width === w * dpr && c.height === h * dpr) {
      if (restore) restoreSnapshot();
      return;
    }
    // snapshot current drawing so it survives the resize
    var prev = null;
    if (dirty) {
      try { prev = c.toDataURL('image/png'); } catch (e) { prev = null; }
    }
    c.width = w * dpr;
    c.height = h * dpr;
    ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    applyTool();
    if (prev) drawDataUrl(prev);
    else if (restore) restoreSnapshot();
  }

  function drawDataUrl(dataUrl) {
    var c = canvasEl();
    if (!c) return;
    var w = c.width, h = c.height;
    // only treat as loaded if the bitmap is real (not the 1x1 hidden-state placeholder)
    if (w < 2 || h < 2) return;
    var img = new Image();
    img.onload = function () {
      if (!ctx) return;
      var dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, w / dpr, h / dpr);
      dirty = true;
    };
    img.onerror = function () { dirty = false; };
    img.src = dataUrl;
  }

  // ---- persistence ----
  function saveSnapshot() {
    var c = canvasEl();
    if (!c || !dirty) return;
    try {
      var data = c.toDataURL('image/png');
      try { localStorage.setItem(STORE_KEY, data); }
      catch (e2) { /* storage full or unavailable */ }
      dirtySave = false;
    } catch (e) { /* tainted canvas etc. */ }
  }

  function scheduleSave() {
    dirtySave = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveSnapshot();
    }, 150);
  }

  function restoreSnapshot() {
    var c = canvasEl();
    if (!c || !ctx) return;
    var data = null;
    try { data = localStorage.getItem(STORE_KEY); } catch (e) { data = null; }
    if (!data) { dirty = false; return; }
    drawDataUrl(data);
  }

  // ---- drawing ----
  function pointerPos(ev) {
    var c = canvasEl();
    var rect = c.getBoundingClientRect();
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top
    };
  }

  function strokeTo(x, y) {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
    dirty = true;
  }

  function beginStroke(ev) {
    if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === 'mouse') return;
    var p = pointerPos(ev);
    var c = canvasEl();
    c.setPointerCapture(ev.pointerId);
    drawing = true;
    lastX = p.x;
    lastY = p.y;
    ctx.beginPath();
    // single dot for taps
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    dirty = true;
  }

  function moveStroke(ev) {
    if (!drawing) return;
    var p = pointerPos(ev);
    // skip micro-moves to keep strokes smooth
    var dx = p.x - lastX;
    var dy = p.y - lastY;
    if (dx * dx + dy * dy < 0.5) return;
    strokeTo(p.x, p.y);
  }

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
    scheduleSave();
  }

  // ---- tool state ----
  var tool = { color: COLORS[0], size: SIZES[0] };

  function applyTool() {
    if (ctx) {
      ctx.strokeStyle = tool.color;
      ctx.fillStyle = tool.color;
      ctx.lineWidth = tool.size;
    }
  }

  function wireTools() {
    var swatches = document.querySelectorAll('#wb-tools .wb-swatch');
    swatches.forEach(function (b) {
      b.addEventListener('click', function () {
        swatches.forEach(function (o) { o.classList.remove('active'); });
        b.classList.add('active');
        tool.color = b.getAttribute('data-color') || COLORS[0];
        applyTool();
      });
    });
    var sizes = document.querySelectorAll('#wb-tools .wb-size');
    sizes.forEach(function (b) {
      b.addEventListener('click', function () {
        sizes.forEach(function (o) { o.classList.remove('active'); });
        b.classList.add('active');
        tool.size = parseInt(b.getAttribute('data-size'), 10) || SIZES[0];
        applyTool();
      });
    });
  }

  // ---- clear (with confirm) ----
  function wireClear() {
    var confirmBox = $('wb-confirm');
    var clearBtn = $('wb-clear');
    var yesBtn = $('wb-confirm-yes');
    var noBtn = $('wb-confirm-no');
    if (!confirmBox || !clearBtn || !yesBtn || !noBtn) return;

    clearBtn.addEventListener('click', function () { confirmBox.classList.add('open'); });
    noBtn.addEventListener('click', function () { confirmBox.classList.remove('open'); });
    confirmBox.addEventListener('click', function (ev) {
      if (ev.target === confirmBox) confirmBox.classList.remove('open');
    });

    yesBtn.addEventListener('click', function () {
      confirmBox.classList.remove('open');
      var c = canvasEl();
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      dirty = false;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      dirtySave = false;
    });
  }

  // ---- save PNG download ----
  function wireSave() {
    var saveBtn = $('wb-save');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', function () {
      var c = canvasEl();
      if (!c) return;
      var data = null;
      try { data = dirty ? c.toDataURL('image/png') : null; } catch (e) { data = null; }
      if (!data) {
        // render an empty board so the download still works
        var off = document.createElement('canvas');
        off.width = c.width;
        off.height = c.height;
        var octx = off.getContext('2d');
        octx.fillStyle = BG_COLOR;
        octx.fillRect(0, 0, off.width, off.height);
        data = off.toDataURL('png');
      }
      var a = document.createElement('a');
      a.href = data;
      a.download = 'whiteboard-' + new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      saveSnapshot();
    });
  }

  // ---- wiring ----
  function wireCanvas() {
    var c = canvasEl();
    if (!c) return;
    c.addEventListener('pointerdown', beginStroke);
    c.addEventListener('pointermove', moveStroke);
    c.addEventListener('pointerup', endStroke);
    c.addEventListener('pointercancel', endStroke);
    // pointerleave: not treated as stroke end — pointer capture keeps strokes alive
    c.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    c.addEventListener('touchstart', function (ev) { ev.preventDefault(); }, { passive: false });
  }

  function wireResize() {
    var t = null;
    window.addEventListener('resize', function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; resizeCanvas(true); }, 120);
    });
    // fires when the window body becomes visible or changes size (covers show/hide ordering)
    if (typeof ResizeObserver === 'function') {
      var wrap = canvasEl() && canvasEl().parentElement;
      if (wrap) {
        var ro = new ResizeObserver(function () { resizeCanvas(true); });
        ro.observe(wrap);
      }
    }
  }

  function loadWhiteboard() {
    canvas = canvasEl();
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    applyTool();
    if (!canvas.dataset.wbWired) {
      canvas.dataset.wbWired = '1';
      wireCanvas();
      wireTools();
      wireClear();
      wireSave();
      wireResize();
    }
    // size after the window is visible (86vw x 64vh, flex column)
    requestAnimationFrame(function () { resizeCanvas(true); });
    setTimeout(function () { resizeCanvas(true); }, 250);
  }

  window.loadWhiteboard = loadWhiteboard;
})();