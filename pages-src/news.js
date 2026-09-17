  // ================= news (headlines via :2009/api/news, 10-min cache) =================
  // Shape: { ok, items: [{ title, source, link }] }
  (function () {
    'use strict';
    var NEWS_API = 'http://localhost:2009/api/news';
    var NEWS_CACHE_KEY = 'padawan_news_v1';
    var NEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    function el(id) { return document.getElementById(id); }

    function readCache() {
      try {
        var raw = localStorage.getItem(NEWS_CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.items) || typeof parsed.ts !== 'number') return null;
        return parsed;
      } catch (e) { return null; }
    }

    function writeCache(items) {
      try {
        localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: items }));
      } catch (e) { /* storage unavailable; fetch live next time */ }
    }

    // Stable source-tag colour: 8 palette slots, picked by hashing the source name.
    function srcClass(source) {
      var s = String(source || '').trim();
      if (!s) return 'news-src s0';
      var h = 0;
      for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return 'news-src s' + (h % 8);
    }

    function shortSource(source) {
      var s = String(source || '').trim();
      if (!s) return '';
      return s.length > 22 ? s.slice(0, 21) + '\u2026' : s;
    }

    function safeUrl(url) {
      var u = String(url || '').trim();
      return /^(https?:)\/\//i.test(u) ? u : null;
    }

    function fmtClock(ts) {
      var d = new Date(ts);
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    }

    function render(items, ts, cachedNote) {
      var list = el('news-list');
      var updEl = el('news-updated');
      var statusEl = el('news-status');
      if (!list || !updEl || !statusEl) return;
      list.innerHTML = '';
      statusEl.style.display = 'none';
      statusEl.textContent = '';
      statusEl.className = '';
      if (!items.length) {
        var empty = document.createElement('div');
        empty.className = 'news-empty';
        empty.textContent = 'No headlines available';
        list.appendChild(empty);
      } else {
        items.forEach(function (it) {
          var url = safeUrl(it && it.link);
          if (!url) return; // no usable link: skip the row entirely
          var a = document.createElement('a');
          a.className = 'news-row';
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          var tag = document.createElement('span');
          tag.className = srcClass(it && it.source);
          tag.textContent = shortSource(it && it.source);
          var headline = document.createElement('span');
          headline.className = 'news-headline';
          headline.textContent = String(it && it.title || '').trim() || 'Untitled';
          a.appendChild(tag);
          a.appendChild(headline);
          list.appendChild(a);
        });
        if (!list.children.length) {
          var none = document.createElement('div');
          none.className = 'news-empty';
          none.textContent = 'No headlines available';
          list.appendChild(none);
        }
      }
      updEl.textContent = ts ? ('Updated ' + fmtClock(ts) + (cachedNote ? ' (cached)' : '')) : '';
    }

    function showMessage(msg, offline) {
      var list = el('news-list');
      var statusEl = el('news-status');
      var updEl = el('news-updated');
      if (!list || !statusEl) return;
      list.innerHTML = '';
      var empty = document.createElement('div');
      empty.className = 'news-empty';
      empty.textContent = offline ? 'News service offline' : msg;
      list.appendChild(empty);
      statusEl.textContent = offline ? 'News service offline' : msg;
      statusEl.className = offline ? 'offline' : '';
      statusEl.style.display = 'block';
      if (updEl) updEl.textContent = '';
    }

    var newsLoading = false;

    async function loadNews(force) {
      var body = el('news-body');
      if (!body || newsLoading) return;
      newsLoading = true;
      try {
        var cached = readCache();
        var fresh = cached && (Date.now() - cached.ts) < NEWS_CACHE_TTL;

        if (!force && fresh) {
          render(cached.items, cached.ts, true);
          return;
        }

        var data = null;
        try {
          var res = await fetch(NEWS_API);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          data = await res.json();
        } catch (e) {
          // fetch failed: show stale cache if present, else plain offline message
          if (cached && cached.items.length) {
            render(cached.items, cached.ts, true);
            var statusEl = el('news-status');
            if (statusEl) {
              statusEl.textContent = 'Could not update. Showing cached headlines.';
              statusEl.className = '';
              statusEl.style.display = 'block';
            }
          } else {
            showMessage('', true);
          }
          return;
        }

        var items = (data && data.ok !== false && Array.isArray(data.items)) ? data.items : null;
        if (!items) {
          showMessage('News service returned no headlines. Try Refresh again in a moment.', false);
          return;
        }

        var clean = items.filter(function (it) { return it && safeUrl(it && it.link); });
        writeCache(clean);
        render(clean, Date.now(), false);
      } finally {
        newsLoading = false;
      }
    }

    // wire-up (guard against double-binding)
    (function wireNews() {
      var btn = el('news-refresh');
      var body = el('news-body');
      if (btn && body && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.addEventListener('click', function () { loadNews(true); });
      }
    })();

    // Expose for the parent integrator: showLayout('news') -> loadNews()
    window.loadNews = loadNews;
  })();