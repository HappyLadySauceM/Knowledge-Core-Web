#!/usr/bin/env bash
# Serve Next.js standalone the same way the production image does: copy static
# assets next to server.js, then listen on PORT/HOSTNAME.
# 按生产镜像同样把静态资源拷到 server.js 旁边，再监听 PORT/HOSTNAME。
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ ! -f .next/standalone/server.js ]]; then
  echo "standalone server is missing; run pnpm build first" >&2
  exit 1
fi
if [[ ! -d .next/static ]]; then
  echo "Next.js static assets are missing; run pnpm build first" >&2
  exit 1
fi

mkdir -p .next/standalone/.next/static .next/standalone/public
cp -R .next/static/. .next/standalone/.next/static/
if [[ -d public ]]; then
  cp -R public/. .next/standalone/public/
fi

cd .next/standalone
exec node server.js
