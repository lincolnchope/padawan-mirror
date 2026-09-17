  // ================= weather =================
  (function () {
    var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-37.87&longitude=145.35&current=temperature_2m,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Australia%2FSydney&forecast_days=5';
    var WX_CACHE_KEY = 'padawan_weather_v1';
    var WX_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    // WMO weather interpretation codes -> plain words (no emojis)
    var WMO = {
      0: 'Clear Sky',
      1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Rime Fog',
      51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
      56: 'Light Freezing Drizzle', 57: 'Freezing Drizzle',
      61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
      66: 'Light Freezing Rain', 67: 'Freezing Rain',
      71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
      80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
      85: 'Light Snow Showers', 86: 'Snow Showers',
      95: 'Thunderstorm', 96: 'Storm with Hail', 99: 'Severe Storm with Hail'
    };

    function wmoText(code) {
      var t = WMO[code];
      return t || 'Unknown';
    }

    function readCache() {
      try {
        var raw = localStorage.getItem(WX_CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.data || typeof parsed.ts !== 'number') return null;
        return parsed;
      } catch (e) { return null; }
    }

    function writeCache(data) {
      try {
        localStorage.setItem(WX_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
      } catch (e) { /* storage unavailable; fetch live next time */ }
    }

    function el(id) { return document.getElementById(id); }

    function round1(n) {
      var v = Math.round(Number(n) * 10) / 10;
      return (Object.is(v, -0) ? 0 : v);
    }

    function dayName(isoDate, idx) {
      // daily.time entries are YYYY-MM-DD in the requested timezone
      var p = String(isoDate).split('-');
      var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      if (isNaN(d.getTime())) return 'Day ' + (idx + 1);
      var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return names[d.getDay()];
    }

    function fmtClock(ts) {
      var d = new Date(ts);
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    }

    function render(data, ts) {
      var tempEl = el('wx-temp');
      var condEl = el('wx-cond');
      var feelsEl = el('wx-feels');
      var daysEl = el('wx-days');
      var errEl = el('wx-error');
      var updEl = el('wx-updated');
      if (!tempEl || !condEl || !feelsEl || !daysEl || !errEl || !updEl) return;

      var cur = data && data.current;
      var daily = data && data.daily;

      if (cur && typeof cur.temperature_2m === 'number') {
        tempEl.innerHTML = Math.round(cur.temperature_2m) + '<span class="wx-temp-deg">&deg;C</span>';
        condEl.textContent = wmoText(cur.weather_code);
        if (typeof cur.apparent_temperature === 'number') {
          feelsEl.textContent = 'Feels like ' + Math.round(cur.apparent_temperature) + '\u00B0';
        } else {
          feelsEl.textContent = '';
        }
      } else {
        tempEl.textContent = '--';
        condEl.textContent = 'Weather data unavailable';
        feelsEl.textContent = '';
      }

      daysEl.innerHTML = '';
      if (daily && Array.isArray(daily.time) && daily.time.length) {
        for (var i = 0; i < daily.time.length && i < 5; i++) {
          var card = document.createElement('div');
          card.className = 'wx-day' + (i === 0 ? ' today' : '');
          var name = document.createElement('div');
          name.className = 'wx-day-name';
          name.textContent = i === 0 ? 'Today' : dayName(daily.time[i], i);
          var cond = document.createElement('div');
          cond.className = 'wx-day-cond';
          cond.textContent = wmoText(daily.weather_code && daily.weather_code[i]);
          var range = document.createElement('div');
          range.className = 'wx-day-range';
          var maxS = document.createElement('span');
          maxS.textContent = (daily.temperature_2m_max && typeof daily.temperature_2m_max[i] === 'number') ? Math.round(daily.temperature_2m_max[i]) : '--';
          var minS = document.createElement('span');
          minS.className = 'wx-day-min';
          minS.textContent = '/ ' + ((daily.temperature_2m_min && typeof daily.temperature_2m_min[i] === 'number') ? Math.round(daily.temperature_2m_min[i]) : '--') + '\u00B0';
          range.appendChild(maxS);
          range.appendChild(minS);
          var rain = document.createElement('div');
          rain.className = 'wx-day-rain';
          var rainVal = document.createElement('span');
          rainVal.className = 'wx-rain-val';
          var pp = daily.precipitation_probability_max && daily.precipitation_probability_max[i];
          rainVal.textContent = (typeof pp === 'number' ? pp : 0) + '%';
          rain.appendChild(document.createTextNode('Rain '));
          rain.appendChild(rainVal);
          card.appendChild(name);
          card.appendChild(cond);
          card.appendChild(range);
          card.appendChild(rain);
          daysEl.appendChild(card);
        }
      } else {
        var empty = document.createElement('div');
        empty.className = 'wx-day-cond';
        empty.textContent = 'No forecast available';
        daysEl.appendChild(empty);
      }

      updEl.textContent = ts ? ('Updated ' + fmtClock(ts)) : '';
      errEl.style.display = 'none';
      errEl.textContent = '';
    }

    function showError(msg) {
      var errEl = el('wx-error');
      var daysEl = el('wx-days');
      var updEl = el('wx-updated');
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      if (daysEl) daysEl.innerHTML = '';
      if (updEl) updEl.textContent = '';
    }

    var wxLoading = false;

    async function loadWeather(force) {
      var body = el('weather-body');
      if (!body || wxLoading) return;
      wxLoading = true;
      try {
        var cached = readCache();
        var fresh = cached && (Date.now() - cached.ts) < WX_CACHE_TTL;

        if (!force && fresh) {
          render(cached.data, cached.ts);
          return;
        }

        var data = null;
        try {
          var res = await fetch(WX_URL);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          data = await res.json();
        } catch (e) {
          // network failed: fall back to stale cache if we have one
          if (!force && cached) {
            render(cached.data, cached.ts);
            return;
          }
          showError('Weather is unavailable right now. Check the internet connection and press Refresh.');
          return;
        }

        if (!data || !data.current) {
          showError('Weather service returned no data. Try Refresh again in a moment.');
          return;
        }

        writeCache(data);
        render(data, Date.now());
      } finally {
        wxLoading = false;
      }
    }

    // wire-up
    var refreshBtn = el('wx-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { loadWeather(true); });
    if (el('weather-body')) loadWeather(false);

    window.loadWeather = loadWeather;
  })();