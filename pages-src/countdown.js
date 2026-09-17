  // ================= countdown (SACs + exams + notable calendar events) =================
  const CNTD_SCHOOL_API = 'http://localhost:2008/api/school';
  const CNTD_CAL_API = 'http://localhost:2008/api/calendar/events?days=30';
  // routine/recurring items that are never worth counting down to
  const CNTD_BLOCKLIST = ['wake up', 'wake', 'shower', 'walk', 'clean', 'wind down', 'winddown', 'gym', 'lunch', 'dinner', 'breakfast', 'sleep', 'personal', 'medication', 'meds', 'eat', 'bins', 'homegroup', 'foundation', 'referee'];
  function cntdEscape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cntdIsRoutine(summary) {
    const s = String(summary || '').toLowerCase();
    return CNTD_BLOCKLIST.some(function (w) { return s.indexOf(w) !== -1; });
  }
  function cntdDaysUntil(dateStr) {
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return null;
    return Math.max(0, Math.ceil((t - Date.now()) / 86400000));
  }
  function cntdFmtDate(dateStr) {
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return String(dateStr || '');
    return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function cntdRow(d) {
    const numHtml = d.today ? 'TODAY' : String(d.days);
    const kindLabel = d.kind === 'sac' ? 'SAC' : d.kind === 'exam' ? 'EXAM' : 'EVENT';
    const whenText = d.today ? 'Today' : cntdFmtDate(d.date);
    return '<div class="cd-row ' + d.rowClass + '">' +
      '<div class="cd-numwrap"><div class="cd-num">' + numHtml + '</div>' +
      (d.today ? '' : '<div class="cd-unit">DAYS</div>') +
      '</div>' +
      '<div class="cd-info">' +
      '<div class="cd-kind">' + kindLabel + '</div>' +
      '<div class="cd-label">' + cntdEscape(d.label) + '</div>' +
      '<div class="cd-when">' + whenText + '</div>' +
      '</div></div>';
  }
  function cntdEmpty(big, small) {
    return '<div class="cd-empty"><div class="cd-empty-big">' + cntdEscape(big) + '</div>' +
      (small ? '<div class="cd-empty-small">' + cntdEscape(small) + '</div>' : '') + '</div>';
  }
  async function loadCountdown() {
    const list = document.getElementById('cd-list');
    if (!list) return;
    let sacs = [], exams = [], events = [];
    try {
      const r = await fetch(CNTD_SCHOOL_API);
      const data = await r.json();
      sacs = Array.isArray(data && data.sacs) ? data.sacs : [];
      exams = Array.isArray(data && data.exams) ? data.exams : [];
    } catch (e) {}
    try {
      const r = await fetch(CNTD_CAL_API);
      const data = await r.json();
      events = Array.isArray(data) ? data : (Array.isArray(data && data.items) ? data.items : []);
    } catch (e) {}
    const items = [];
    (sacs || []).forEach(function (s) {
      if (!s || !s.date) return;
      items.push({ kind: 'sac', label: s.name || s.title || 'SAC', date: s.date, t: new Date(s.date).getTime() });
    });
    (exams || []).forEach(function (x) {
      if (!x || !x.date) return;
      items.push({ kind: 'exam', label: x.name || x.title || 'Exam', date: x.date, t: new Date(x.date).getTime() });
    });
    const notable = (events || []).filter(function (ev) {
      return ev && ev.summary && ev.start && !cntdIsRoutine(ev.summary);
    }).slice(0, 4);
    notable.forEach(function (ev) {
      items.push({ kind: 'event', label: ev.summary, date: ev.start, t: new Date(ev.start).getTime() });
    });
    const upcoming = items.filter(function (it) { return !isNaN(it.t); })
      .sort(function (a, b) { return a.t - b.t; });
    list.innerHTML = '';
    if (!upcoming.length) {
      list.innerHTML = cntdEmpty('Nothing to count down to', 'No SACs, exams or events on the horizon');
      return;
    }
    const nextDateKey = String(upcoming[0].date).slice(0, 10);
    list.innerHTML = upcoming.map(function (it) {
      const days = Math.max(0, Math.ceil((it.t - Date.now()) / 86400000));
      const today = days === 0;
      let rowClass = it.kind === 'sac' ? 'cd-kind-sac' : it.kind === 'exam' ? 'cd-kind-exam' : 'cd-kind-event';
      if (today) rowClass += ' cd-today';
      else if (String(it.date).slice(0, 10) === nextDateKey) rowClass += ' cd-next';
      return cntdRow({ days: days, today: today, kind: it.kind, label: it.label, date: it.date, rowClass: rowClass });
    }).join('');
  }
  (function wireCountdown() {
    const cd = document.getElementById('countdown-body');
    if (!cd || cd.dataset.wired) return;
    cd.dataset.wired = '1';
    setInterval(function () { if (document.body.classList.contains('countdown')) loadCountdown(); }, 600000);
  })();  window.loadCountdown = loadCountdown;
