#!/usr/bin/env bash
set -euo pipefail

namespace="${APPLICATION_NAMESPACE:-knowledge-core-dev}"
web_service="knowledge-core-web"
gateway_service="knowledge-core-gateway"
public_host="${PUBLIC_HOST:-knowledge-core.happyladysauce.local}"
public_gateway_address="${PUBLIC_GATEWAY_ADDRESS:-127.0.0.1:30443}"
public_ca_file="${PUBLIC_CA_FILE:-}"

raw() {
  local service="$1"
  local port="$2"
  local path="$3"
  kubectl get --raw "/api/v1/namespaces/${namespace}/services/http:${service}:${port}/proxy${path}"
}

health="$(raw "$web_service" 3000 /api/health)"
test "$(jq -r '.status' <<<"$health")" = "ok"

homepage="$(raw "$web_service" 3000 /en)"
grep -q "Pages worth reading" <<<"$homepage"

direct="$(raw "$gateway_service" 8080 '/api/v1/documents?limit=1')"
jq -e . >/dev/null <<<"$direct"

bff="$(raw "$web_service" 3000 '/api/bff/gateway/api/v1/documents?limit=1')"
jq -e . >/dev/null <<<"$bff"

gateway_ip="${public_gateway_address%:*}"
gateway_port="${public_gateway_address##*:}"
test -n "$gateway_ip" && test -n "$gateway_port"
test -s "$public_ca_file"

public() {
  local path="$1"
  curl --fail --silent --show-error \
    --cacert "$public_ca_file" \
    --resolve "${public_host}:${gateway_port}:${gateway_ip}" \
    "https://${public_host}:${gateway_port}${path}"
}

root_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --cacert "$public_ca_file" \
  --resolve "${public_host}:${gateway_port}:${gateway_ip}" \
  "https://${public_host}:${gateway_port}/")"
case "$root_status" in
  200|307|308) ;;
  *) echo "Unexpected public root status: $root_status" >&2; exit 1 ;;
esac

public_homepage="$(public /zh-CN)"
grep -q "最新文章" <<<"$public_homepage"

public_api="$(public '/api/v1/documents?limit=1')"
jq -e . >/dev/null <<<"$public_api"

echo "Knowledge-Core-Web smoke passed"
