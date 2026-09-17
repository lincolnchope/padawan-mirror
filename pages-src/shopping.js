  // ================= shopping (list on :2008/api/brain, items whose text starts "shop ") =================
  // Self-contained IIFE: defines loadShopping() for the showLayout wiring, plus its own wiring.
  // Exposed on window so the parent integrator can call it from showLayout: window.loadShopping().
  //
  // NOTE on done state: per contract, POST /api/brain/update {id,type} marks an item done by
  // sending type:'done'. The backend build running at the time of writing only accepts
  // idea|task|reminder and silently ignores 'done', so this page ALSO records done state in
  // localStorage ('padawan_shopping_done_v1'). Rendered done = server type 'done' OR local flag.
  // Once the backend honours 'done', its state wins automatically and the local flags self-prune.
  (function () {
    'use strict';
    const SHOP_API = 'http://localhost:2008/api/brain';
    const PREFIX = 'shop ';
    const DONE_KEY = 'padawan_shopping_done_v1';

    let items = [];        // raw brain items matching the shop prefix
    let backendDown = false;

    function el(id) { return document.getElementById(id); }
    function setText(node, s) { if (node) node.textContent = s; }

    // "shop milk and bread" -> "milk and bread" (case-insensitive prefix, prefix stripped)
    function displayText(raw) {
      const t = String(raw || '');
      return t.slice(0, PREFIX.length).toLowerCase() === PREFIX ? t.slice(PREFIX.length) : t;
    }

    function loadDoneMap() {
      try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch (e) { return {}; }
    }
    function saveDoneMap(map) {
      try { localStorage.setItem(DONE_KEY, JSON.stringify(map)); } catch (e) {}
    }
    function isDone(it, doneMap) {
      return it.type === 'done' || doneMap[it.id] === true;
    }

    function openCount(doneMap) {
      let n = 0;
      for (let i = 0; i < items.length; i++) if (!isDone(items[i], doneMap)) n++;
      return n;
    }

    function api(path, body) {
      const opts = body === undefined
        ? { method: 'GET' }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
      return fetch(SHOP_API + path, opts).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }

    function showError(msg) {
      backendDown = !!msg;
      const st = el('shop-status');
      if (!st) return;
      if (!msg) { st.style.display = 'none'; st.textContent = ''; return; }
      setText(st, msg);
      st.style.display = 'block';
    }

    function render() {
      const list = el('shop-list');
      const count = el('shop-count');
      if (!list || !count) return;
      const doneMap = loadDoneMap();
      const n = openCount(doneMap);
      setText(count, n + (n === 1 ? ' item to buy' : ' items to buy'));
      list.innerHTML = '';
      if (!items.length) {
        const e = document.createElement('div');
        e.className = 'shop-empty';
        setText(e, backendDown ? 'Shopping list unavailable' : 'No items on the list');
        list.appendChild(e);
        return;
      }
      items.forEach(it => {
        const done = isDone(it, doneMap);
        const row = document.createElement('div');
        row.className = 'shop-row' + (done ? ' done' : '');
        row.title = done ? 'Mark as to buy' : 'Mark as bought';
        const txt = document.createElement('span');
        txt.className = 'shop-text';
        setText(txt, displayText(it.text));
        const del = document.createElement('button');
        del.className = 'shop-del';
        del.title = 'Delete';
        setText(del, 'x');
        row.appendChild(txt);
        row.appendChild(del);
        // tap anywhere on the row to toggle done; the delete button ignores that
        row.addEventListener('click', function () { toggle(it); });
        del.addEventListener('click', function (ev) {
          ev.stopPropagation();
          remove(it);
        });
        list.appendChild(row);
      });
    }

    function toggle(it) {
      if (backendDown) { showError('Backend is down. Cannot update items.'); return; }
      const doneMap = loadDoneMap();
      const prev = doneMap[it.id] === true;
      const next = !prev;
      // optimistic: strike through immediately, then confirm with the backend
      doneMap[it.id] = next;
      saveDoneMap(doneMap);
      render();
      api('/update', { id: it.id, type: next ? 'done' : 'task' }).then(function () {
        load();
      }).catch(function () {
        const back = loadDoneMap();
        back[it.id] = prev; // revert to the state before the failed toggle
        saveDoneMap(back);
        showError('Could not update the item. Backend may be down.');
        load();
      });
    }

    function remove(it) {
      if (backendDown) { showError('Backend is down. Cannot delete items.'); return; }
      const doneMap = loadDoneMap();
      delete doneMap[it.id];
      saveDoneMap(doneMap);
      items = items.filter(function (x) { return x.id !== it.id; });
      render();
      api('/delete', { id: it.id }).then(load).catch(function () {
        showError('Could not delete the item. Backend may be down.');
        load();
      });
    }

    function doAdd() {
      const inp = el('shop-in');
      if (!inp) return;
      const v = inp.value.trim();
      if (!v) return;
      if (backendDown) { showError('Backend is down. Cannot add items.'); return; }
      inp.value = '';
      api('/add', { text: PREFIX + v, type: 'task' }).then(load).catch(function () {
        inp.value = v;
        showError('Could not add the item. Backend may be down.');
        load();
      });
    }

    function load() {
      return api('').then(function (data) {
        const arr = Array.isArray(data) ? data : [];
        items = arr.filter(function (it) {
          return it && typeof it.text === 'string' && it.text.slice(0, PREFIX.length).toLowerCase() === PREFIX;
        });
        // keep the local done flags tidy: drop flags for items that are gone, and
        // drop flags the server now reflects itself (server becomes source of truth)
        const doneMap = loadDoneMap();
        const alive = {};
        items.forEach(function (it) { alive[it.id] = true; });
        let dirty = false;
        Object.keys(doneMap).forEach(function (id) {
          const match = items.find(function (it) { return it.id === id; });
          if (!alive[id] || (match && ((doneMap[id] === true && match.type === 'done') || (doneMap[id] === false && match.type !== 'done')))) {
            delete doneMap[id];
            dirty = true;
          }
        });
        if (dirty) saveDoneMap(doneMap);
        showError('');
        render();
      }).catch(function () {
        items = [];
        showError('Backend is down. Shopping list unavailable.');
        render();
      });
    }
    window.loadShopping = load;

    // wiring
    (function wireShopping() {
      const inp = el('shop-in');
      const btn = el('shop-add');
      if (!inp || !btn) return;
      btn.addEventListener('click', doAdd);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doAdd();
      });
    })();
  })();