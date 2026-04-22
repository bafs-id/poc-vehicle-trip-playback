#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${SSH_HOST:-knosddns.thddns.net}"
REMOTE_DIR="${REMOTE_DIR:-/home/knos/poc-vehicle-route}"
KONG_DIR="${KONG_DIR:-/home/knos/kong}"
IMAGE_TAG="${IMAGE_TAG:-poc_vehicle_route:latest}"
SERVICE_NAME="${SERVICE_NAME:-poc_vehicle_route}"
KONG_PATH="${KONG_PATH:-/poc/vehicle-trip-placback}"
PROXY_PORT="${PROXY_PORT:-9953}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\033[1;34m==> %s\033[0m\n' "$*"; }

say "Syncing source to ${SSH_HOST}:${REMOTE_DIR}"
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude .DS_Store \
  "${PROJECT_DIR}/" "${SSH_HOST}:${REMOTE_DIR}/"

say "Building image ${IMAGE_TAG} on server"
ssh "${SSH_HOST}" "cd ${REMOTE_DIR} && docker build -t ${IMAGE_TAG} ."

say "Recreating container ${SERVICE_NAME}"
ssh "${SSH_HOST}" "cd ${KONG_DIR} && docker compose up -d --force-recreate ${SERVICE_NAME}"

say "Restarting Kong to pick up declarative config"
ssh "${SSH_HOST}" "cd ${KONG_DIR} && docker compose restart kong"

say "Waiting for Kong admin to become ready"
ssh "${SSH_HOST}" '
  for i in $(seq 1 20); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:8001/status || true)
    if [ "$code" = "200" ]; then echo "kong ready after ${i}s"; exit 0; fi
    sleep 1
  done
  echo "kong admin did not become ready in 20s" >&2
  exit 1
'

say "Smoke test through Kong proxy"
ssh "${SSH_HOST}" "
  set -e
  for path in '/' '/vehicle_logs/index.json'; do
    url=\"http://localhost:${PROXY_PORT}${KONG_PATH}\${path}\"
    code=\$(curl -sS -o /dev/null -w '%{http_code}' \"\$url\")
    printf '  HTTP %s  %s\n' \"\$code\" \"\$url\"
    [ \"\$code\" = '200' ] || { echo 'smoke test failed' >&2; exit 1; }
  done
"

say "Deploy complete: ${KONG_PATH}/"
