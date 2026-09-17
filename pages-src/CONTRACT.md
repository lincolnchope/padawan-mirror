# MIRROR BUILD — AGENT INTEGRATION CONTRACT

All agents build ONE page each for the Padawan Mirror (/home/master/padawan-mirror/index.html).
Do NOT edit index.html directly — write standalone deliverables; the parent agent integrates.

## Pattern every page follows (mirror how existing pages work)
- CSS block: `body.<name> #clockbox {...}` etc. (copy pattern from body.meds or body.fitness in index.html)
- HTML: `<div id="<name>-body" style="display:none">...</div>` inside #window-body
- JS: a `load<Name>()` function + wire-up IIFE; shown via showLayout case
- Window style: meds-style window (86vw x 64vh, centered) unless noted

## Verified API shapes (use exactly these)
- Weather: GET https://api.open-meteo.com/v1/forecast?latitude=-37.87&longitude=145.35&current=temperature_2m,weather_code,appertature,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Australia%2FSydney&forecast_days=5
  (fix the typo above: apparent_temperature; verified working, CORS open, no key)
  current: {time, temperature_2m, weather_code, apparent_temperature}
  daily: {time[], temperature_2m_max[], temperature_2m_min[], precipitation_probability_max[], weather_code[]}
- Countdown: :2008 /api/school -> {sacs:[{name,date}],exams:[{name,date}]} (both empty now — page must handle empty), :2008 /api/calendar/events?days=30 -> [{id,summary,start,end,time,location}]
- Shopping: :2008 /api/brain (GET) -> [{id,type,text,ts}]; /api/brain/add {text,type} -> {id,...}; /api/brain/update {id,type} toggles task/done; /api/brain/delete {id} -> {ok}
  Shopping items marked by text starting "shop " (lowercase, strip prefix on display)
- Habits: localStorage only, key 'padawan_habits_v1'
- Timer: localStorage only, key 'padawan_timer_state_v1'
- Whiteboard: canvas, localStorage PNG snapshot 'padawan_whiteboard_v1'
- Music: :2008 GET /api/spotify/status -> {needs_auth:false, item:{name, artists:[{name}], is_playing}} (item null when idle)
  actions: POST /api/spotify/play|pause|next|prev (no body) then re-GET status ~900ms later
- News: NOT buildable standalone — backend RSS proxy endpoint will be added by parent later; render from
  fetch('http://localhost:2009/api/news') -> {ok, items:[{title, source, link}]}  (agent builds frontend only)

## Global style rules (user requirements)
- BIG readable type, big touch targets (user asks to enlarge everything)
- No emojis anywhere
- Dark theme vars: --card, --card-border, --text, --muted, --accent (green #6ee7b7 family), match existing pages
- en-AU, AEST

## Output files (write to /home/master/padawan-mirror/pages-src/)
- <page>.css     CSS block only (scoped with body.<page> prefixes)
- <page>.html    the window-body div block only
- <page>.js      IIFE: load<Page>() + wiring, self-contained, no external deps
- Verify JS with node --check before finishing; verify no id collisions with existing ids