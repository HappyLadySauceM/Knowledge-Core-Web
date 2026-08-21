#!/usr/bin/env bash
set -euo pipefail

namespace="${APPLICATION_NAMESPACE:-knowledge-core-dev}"
web_service="knowledge-core-web"
gateway_service="knowledge-core-gateway"

raw() {
  local service="$1"
  local port="$2"
  local path="$3"
  kubectl get --raw "/api/v1/namespaces/${namespace}/services/http:${service}:${port}/proxy${path}"
}

health="$(raw "$web_service" 3000 /api/health)"
test "$(jq -r '.status' <<<"$health")" = "ok"

homepage="$(raw "$web_service" 3000 /en)"
grep -q "Make ideas legible" <<<"$homepage"

direct="$(raw "$gateway_service" 8080 '/api/v1/documents?limit=1')"
jq -e . >/dev/null <<<"$direct"

bff="$(raw "$web_service" 3000 '/api/gateway/api/v1/documents?limit=1')"
jq -e . >/dev/null <<<"$bff"

echo "Knowledge-Core-Web smoke passed"
