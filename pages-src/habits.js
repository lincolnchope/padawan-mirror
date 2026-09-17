// ================= habits (localStorage: padawan_habits_v1) =================
// Data shape: { "<name>": { dates: ["2026-09-07", ...] } }
// Streak = consecutive days ending today or yesterday.
(function () {
  'use strict';

  var LS_KEY = 'padawan_habits_v1';
  var DEFAULT_HABITS = ['Meds', 'No Smoke', 'Water', 'Study', 'Move'];

  function todayKey() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function shiftKey(key, deltaDays) {
    var p = key.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + deltaDays);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var data = raw ? JSON.parse(raw) : {};
      if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
      return data;
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { /* storage full or unavailable */ }
  }

  // Seed defaults on first run (or re-add any default the user has not removed).
  // Removal is remembered by deleting the habit AND marking it removed in meta.
  function ensureDefaults(data) {
    if (!data.__meta || typeof data.__meta !== 'object') data.__meta = { removed: [] };
    if (!Array.isArray(data.__meta.removed)) data.__meta.removed = [];
    DEFAULT_HABITS.forEach(function (name) {
      if (data.__meta.removed.indexOf(name) === -1 && !data[name]) {
        data[name] = { dates: [] };
      }
    });
    return data;
  }

  // Meta key is not a habit — filter it out wherever habits are enumerated.
  function habitNames(data) {
    return Object.keys(data).filter(function (k) {
      return k !== '__meta' && data[k] && typeof data[k] === 'object' && Array.isArray(data[k].dates);
    });
  }

  function isDone(data, name, key) {
    return !!(data[name] && data[name].dates && data[name].dates.indexOf(key) !== -1);
  }

  function streak(data, name, refKey) {
    var entry = data[name];
    if (!entry || !Array.isArray(entry.dates)) return 0;
    // today = refKey when rendering; when ticking we always use real today,
    // but the streak logic itself is key-relative so midnight rollover is natural.
    var s = 0;
    var cursor = refKey;
    // If today not done, start counting from yesterday so the streak
    // survives until the end of today (ends today OR yesterday).
    if (entry.dates.indexOf(cursor) === -1) cursor = shiftKey(refKey, -1);
    while (entry.dates.indexOf(cursor) !== -1) {
      s++;
      cursor = shiftKey(cursor, -1);
    }
    return s;
  }

  function toggleDone(data, name) {
    var key = todayKey();
    if (!data[name] || !Array.isArray(data[name].dates)) data[name] = { dates: [] };
    var i = data[name].dates.indexOf(key);
    if (i === -1) data[name].dates.push(key);
    else data[name].dates.splice(i, 1);
    save(data);
  }

  function addHabit(data, name) {
    name = name.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) return false;
    if (name === '__meta') return false;
    if (!data[name]) data[name] = { dates: [] };
    save(data);
    return true;
  }

  function removeHabit(data, name) {
    delete data[name];
    if (data.__meta && Array.isArray(data.__meta.removed) && DEFAULT_HABITS.indexOf(name) !== -1) {
      if (data.__meta.removed.indexOf(name) === -1) data.__meta.removed.push(name);
    }
    save(data);
  }

  function render() {
    var grid = document.getElementById('habits-grid');
    if (!grid) return;
    var data = ensureDefaults(load());
    save(data); // persist seeded defaults immediately
    var refKey = todayKey();
    grid.innerHTML = '';
    var names = habitNames(data);
    if (!names.length) {
      var empty = document.createElement('div');
      empty.className = 'hab-empty';
      empty.textContent = 'No habits yet. Add one above.';
      grid.appendChild(empty);
      return;
    }
    names.forEach(function (name) {
      var done = isDone(data, name, refKey);
      var s = streak(data, name, refKey);
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hab-chip' + (done ? ' done' : '') + (s === 0 ? ' streak0' : '');
      chip.setAttribute('data-name', name);

      var nm = document.createElement('span');
      nm.className = 'hab-name';
      nm.textContent = name;
      chip.appendChild(nm);

      var st = document.createElement('span');
      st.className = 'hab-streak';
      st.textContent = String(s);
      chip.appendChild(st);

      var lbl = document.createElement('span');
      lbl.className = 'hab-streak-label';
      lbl.textContent = 'day streak';
      chip.appendChild(lbl);

      var state = document.createElement('span');
      state.className = 'hab-state';
      state.textContent = done ? 'Done' : 'Not done';
      chip.appendChild(state);

      var x = document.createElement('span');
      x.className = 'hab-x';
      x.textContent = 'x';
      x.setAttribute('title', 'Remove habit');
      x.setAttribute('role', 'button');
      chip.appendChild(x);

      grid.appendChild(chip);
    });
  }

  function removeAt(el) {
    var chip = el.closest('.hab-chip');
    if (!chip) return;
    var name = chip.getAttribute('data-name');
    if (!name) return;
    var data = load();
    removeHabit(data, name);
    render();
  }

  // Wire-up (guard so re-entry does not double-bind)
  function wire() {
    var grid = document.getElementById('habits-grid');
    if (!grid || grid.dataset.wired) return;
    grid.dataset.wired = '1';

    // Tap chip body (not the x) -> toggle today
    grid.addEventListener('click', function (e) {
      if (e.target.closest('.hab-x')) return; // x handled separately
      var chip = e.target.closest('.hab-chip');
      if (!chip) return;
      var name = chip.getAttribute('data-name');
      if (!name) return;
      var data = load();
      toggleDone(data, name);
      render();
    });

    // Remove: click the small x OR long-press (~600ms) anywhere on the chip
    var lpTimer = null;
    var lpFired = false;
    function startLongPress(e) {
      if (e.target.closest('.hab-x')) return;
      lpFired = false;
      var chip = e.target.closest('.hab-chip');
      if (!chip) return;
      var x = e.clientX, y = e.clientY;
      lpTimer = setTimeout(function () {
        lpFired = true;
        if (navigator.vibrate) navigator.vibrate(30);
        removeAt(chip);
        setTimeout(function () { lpFired = false; }, 400); // self-clear if no click follows
      }, 600);
      var cancel = function () {
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
      };
      chip.addEventListener('pointerup', cancel, { once: true });
      chip.addEventListener('pointermove', function (mv) {
        if (Math.abs(mv.clientX - x) > 10 || Math.abs(mv.clientY - y) > 10) cancel();
      }, { once: true });
      chip.addEventListener('pointercancel', cancel, { once: true });
    }
    grid.addEventListener('pointerdown', startLongPress);
    grid.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.hab-chip')) e.preventDefault();
    });
    grid.addEventListener('click', function (e) {
      if (lpFired) { lpFired = false; return; } // swallow the tap that ends a long-press
      if (e.target.closest('.hab-x')) removeAt(e.target);
    });
  }

  function loadHabits() {
    render();
    wire();
  }

  // add bar wiring (guard against double-binding)
  (function wireAddBar() {
    var inp = document.getElementById('habits-in');
    var add = document.getElementById('habits-add');
    if (!inp || !add || inp.dataset.wired) return;
    inp.dataset.wired = '1';
    var doAdd = function () {
      var v = inp.value;
      inp.value = '';
      if (!v.trim()) return;
      var data = ensureDefaults(load());
      if (addHabit(data, v)) {
        // un-remember a custom habit re-added after removal
        if (data.__meta && data.__meta.removed) {
          var i = data.__meta.removed.indexOf(v.trim().replace(/\s+/g, ' ').slice(0, 24));
          if (i !== -1) { data.__meta.removed.splice(i, 1); save(data); }
        }
      }
      render();
    };
    add.addEventListener('click', doAdd);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doAdd();
    });
  })();

  // Re-render on tab focus / storage changes so midnight rollover and
  // cross-tab edits refresh naturally via date keys.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) loadHabits();
  });
  window.addEventListener('storage', function (e) {
    if (e.key === LS_KEY) loadHabits();
  });
  window.addEventListener('focus', loadHabits);

  // Expose for the parent integrator: showLayout('habits') -> loadHabits()
  window.loadHabits = loadHabits;
})();