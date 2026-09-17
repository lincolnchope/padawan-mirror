#!/usr/bin/env bash
# Padawan Mirror v2 - the rebuild site on :2023.
#
# Same static-page model as v1 (:2022), and it talks to the SAME backends
# (padawan :2008, a2ui :2009, fiba-rag :8091, rules model :8080). Those are not
# duplicated here, so there is exactly one source of live data.
#
#   ./start.sh          start the page server, then report backend health
#   ./start.sh --no-ui  start the page server only (headless)
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
PORT=2023
PADAWAN="$HOME/padawan-solutions/Padawan-solutions--main"
VENV_PY="$HOME/.hermes/hermes-agent/venv/bin/python"   # has httpx + google libs + yaml
LOG="$HERE/logs"
mkdir -p "$LOG"

say() { printf '%-42s %s\n' "$1" "$2"; }

# port -> "command|workdir|interpreter"  (only started if the port is silent)
start_bg() {  # name port cmd workdir
  local name="$1" port="$2" cmd="$3" dir="$4"
  if curl -s -m 2 -o /dev/null "http://localhost:$port/"; then
    say "$name (:$port)" "already up"
    return 0
  fi
  ( cd "$dir" && nohup bash -c "$cmd" > "$LOG/$name.log" 2>&1 & )
  say "$name (:$port)" "starting"
}

echo "Padawan Mirror v2 - page server"
start_bg "mirror-v2"   2023 "python3 -m http.server 2023"                                   "$HERE"

# The live data comes from the v1 stack. These are NOT v2's to own, but a missing
# one leaves a whole widget empty, so bring them up too and prove each answered.
echo
echo "Shared backends"
start_bg "padawan"     2008 "$VENV_PY padawan_backend.py 2008"                              "$PADAWAN"
start_bg "a2ui"        2009 "python3 a2ui_backend.py 2009"                                  "$PADAWAN"
start_bg "fiba-rag"    8091 "python3 fiba_rag.py --port 8091"                               "$HOME/train-data/referee"

# Wait for each to actually answer, not just to have been launched. The padawan
# backend takes ~5s to answer its first calendar call (Google round trip), so the
# timeout here is generous on purpose.
wait_for() {  # name port url expect
  local name="$1" port="$2" url="$3" expect="$4" i
  for i in $(seq 1 30); do
    if curl -s -m 15 "$url" | grep -q "$expect"; then say "$name (:$port)" "ready"; return 0; fi
    sleep 1
  done
  say "$name (:$port)" "NOT RESPONDING - see $LOG/$name.log"
  return 1
}

echo
echo "Health"
wait_for "mirror-v2" 2023 "http://localhost:2023/"                             "Padawan"
wait_for "padawan"   2008 "http://localhost:2008/api/calendar/events?days=1"   "^\[{"
wait_for "a2ui"      2009 "http://localhost:2009/api/a2ui/status"              "ok"
wait_for "fiba-rag"  8091 "http://localhost:8091/health"                       "ok"

# the referee chat also needs the rules model on :8080
if curl -s -m 2 -o /dev/null "http://localhost:8080/health"; then
  say "referee model (:8080)" "running"
else
  say "referee model (:8080)" "down - rules page will not answer"
fi

echo
if [ "${1:-}" = "--no-ui" ]; then
  echo "Page up. Open http://localhost:2023/ when you want the mirror."
  exit 0
fi
echo "Open http://localhost:2023/ - v1 stays on :2022 for comparison."
