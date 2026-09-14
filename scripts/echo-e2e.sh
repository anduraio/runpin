#!/usr/bin/env bash
# Smoke test for a running api + worker at $RUNPIN_URL:
#   1. echo job end to end
#   2. http_callback job against a local stub URL (asserts the callback body lands in the result)
#
# Local worker (npm run start:worker): defaults work as-is.
# Docker worker: the container cannot reach 127.0.0.1 on the host, so run
#   STUB_BIND=0.0.0.0 STUB_HOST=host.docker.internal ./scripts/echo-e2e.sh
set -euo pipefail
BASE="${RUNPIN_URL:-http://localhost:3000}"
KEY="${RUNPIN_API_KEY:-dev-api-key}"
STUB_PORT="${STUB_PORT:-8791}"
STUB_BIND="${STUB_BIND:-127.0.0.1}"
STUB_HOST="${STUB_HOST:-127.0.0.1}"

STUB_LOG="$(mktemp)"
STUB_PID=""
cleanup() {
  if [ -n "$STUB_PID" ]; then kill "$STUB_PID" 2>/dev/null || true; fi
  rm -f "$STUB_LOG"
}
trap cleanup EXIT

enqueue() {
  curl -s -w "\n%{http_code}" -X POST "$BASE/v1/jobs" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "$1"
}

enqueue_id() {
  local resp body code id
  resp="$(enqueue "$1")"
  body="$(printf '%s\n' "$resp" | sed '$d')"
  code="$(printf '%s\n' "$resp" | tail -n 1)"
  echo "  HTTP $code $body" >&2
  test "$code" = "202"
  id="$(printf '%s\n' "$body" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  test -n "$id"
  echo "$id"
}

wait_for_job() {
  local id="$1" want="$2" i job status
  for i in $(seq 1 30); do
    job="$(curl -s "$BASE/v1/jobs/$id" -H "Authorization: Bearer $KEY")"
    status="$(echo "$job" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
    echo "  [$i] status=$status" >&2
    if [ "$status" = "succeeded" ]; then
      echo "$job"
      return 0
    fi
    if [ "$status" = "failed" ] || [ "$status" = "cancelled" ]; then
      echo "$job"
      echo "✗ expected $want, job ended as $status" >&2
      return 1
    fi
    sleep 0.5
  done
  echo "✗ timeout waiting for $want job" >&2
  return 1
}

echo "→ Enqueue echo job"
ID=$(enqueue_id '{"type":"echo","payload":{"hello":"runpin","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}}')

echo "→ Polling job $ID"
wait_for_job "$ID" "echo" >/dev/null
echo "✓ echo job succeeded"

echo "→ Starting callback stub on $STUB_BIND:$STUB_PORT"
STUB_PORT="$STUB_PORT" STUB_BIND="$STUB_BIND" node -e '
const http = require("node:http");
const { STUB_PORT, STUB_BIND } = process.env;
const server = http.createServer((req, res) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    console.error(`${req.method} ${req.url} body=${data}`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, from: "stub" }));
  });
});
server.listen(Number(STUB_PORT), STUB_BIND, () =>
  console.error(`stub listening on ${STUB_BIND}:${STUB_PORT}`)
);
' >/dev/null 2>"$STUB_LOG" &
STUB_PID=$!
disown "$STUB_PID" 2>/dev/null || true

for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://$STUB_BIND:$STUB_PORT/ready" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

echo "→ Enqueue http_callback job → http://$STUB_HOST:$STUB_PORT/runpin"
ID=$(enqueue_id '{
  "type":"http_callback",
  "payload":{
    "callback_url":"http://'"$STUB_HOST:$STUB_PORT"'/runpin",
    "action":"compute",
    "id":"smoke-1"
  },
  "max_duration_sec":60,
  "idempotency_key":"echo-e2e-'$(date +%s)'"
}')

echo "→ Polling job $ID"
JOB=$(wait_for_job "$ID" "http_callback")
echo "$JOB" | grep -q '"status":200'
echo "$JOB" | grep -q '"ok":true'
grep -q 'POST /runpin' "$STUB_LOG"
grep -q '"action":"compute"' "$STUB_LOG"
echo "✓ http_callback job succeeded — stub got the payload minus callback_url"
echo "  stub log: $(head -n 3 "$STUB_LOG" | tr '\n' ' ')"
