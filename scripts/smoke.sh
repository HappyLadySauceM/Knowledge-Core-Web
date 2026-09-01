#!/usr/bin/env bash
set -euo pipefail

namespace="${APPLICATION_NAMESPACE:?APPLICATION_NAMESPACE is required}"
web_service="${WEB_SERVICE_NAME:?WEB_SERVICE_NAME is required}"
web_port="${WEB_SERVICE_PORT:?WEB_SERVICE_PORT is required}"
web_health_path="${WEB_HEALTH_PATH:?WEB_HEALTH_PATH is required}"
web_home_path="${WEB_HOME_PATH:?WEB_HOME_PATH is required}"
web_bff_path="${WEB_BFF_PATH:?WEB_BFF_PATH is required}"
gateway_service="${GATEWAY_SERVICE_NAME:?GATEWAY_SERVICE_NAME is required}"
gateway_port="${GATEWAY_SERVICE_PORT:?GATEWAY_SERVICE_PORT is required}"
gateway_api_path="${GATEWAY_API_PATH:?GATEWAY_API_PATH is required}"
public_host="${PUBLIC_HOST:?PUBLIC_HOST is required}"
public_gateway_address="${PUBLIC_GATEWAY_ADDRESS:?PUBLIC_GATEWAY_ADDRESS is required}"
public_home_path="${PUBLIC_HOME_PATH:?PUBLIC_HOME_PATH is required}"
public_api_path="${PUBLIC_API_PATH:?PUBLIC_API_PATH is required}"
public_ca_file="${PUBLIC_CA_FILE:?PUBLIC_CA_FILE is required}"
public_gateway_ip="${PUBLIC_GATEWAY_IP:-}"
web_health_status="${WEB_HEALTH_STATUS:-}"
web_home_marker="${WEB_HOME_MARKER:-}"
public_home_marker="${PUBLIC_HOME_MARKER:-}"

if [[ "$public_gateway_address" =~ ^\[([^]]+)\]:([0-9]+)$ ]]; then
  public_gateway_host="${BASH_REMATCH[1]}"
  public_port="${BASH_REMATCH[2]}"
elif [[ "$public_gateway_address" =~ ^([^:]+):([0-9]+)$ ]]; then
  public_gateway_host="${BASH_REMATCH[1]}"
  public_port="${BASH_REMATCH[2]}"
else
  echo "PUBLIC_GATEWAY_ADDRESS must be host:port or [ipv6]:port" >&2
  exit 1
fi

connect_args=()
if [[ -n "$public_gateway_ip" ]]; then
  connect_args=(--resolve "${public_host}:${public_port}:${public_gateway_ip}")
elif [[ "$public_gateway_host" != "$public_host" ]]; then
  connect_args=(--connect-to "${public_host}:${public_port}:${public_gateway_host}:${public_port}")
fi

raw() {
  local service="$1"
  local port="$2"
  local path="$3"
  kubectl get --raw "/api/v1/namespaces/${namespace}/services/http:${service}:${port}/proxy${path}"
}

health="$(raw "$web_service" "$web_port" "$web_health_path")"
if [[ -n "$web_health_status" ]]; then
  test "$(jq -r '.status' <<<"$health")" = "$web_health_status"
fi

homepage="$(raw "$web_service" "$web_port" "$web_home_path")"
if [[ -n "$web_home_marker" ]]; then
  grep -Fq -- "$web_home_marker" <<<"$homepage"
fi

direct="$(raw "$gateway_service" "$gateway_port" "$gateway_api_path")"
jq -e . >/dev/null <<<"$direct"

bff="$(raw "$web_service" "$web_port" "$web_bff_path")"
jq -e . >/dev/null <<<"$bff"

test -s "$public_ca_file"

public() {
  local path="$1"
  curl --fail --silent --show-error \
    --cacert "$public_ca_file" \
    "${connect_args[@]}" \
    "https://${public_host}:${public_port}${path}"
}

root_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --cacert "$public_ca_file" \
  "${connect_args[@]}" \
  "https://${public_host}:${public_port}/")"
case "$root_status" in
  200|307|308) ;;
  *) echo "Unexpected public root status: $root_status" >&2; exit 1 ;;
esac

public_homepage="$(public "$public_home_path")"
if [[ -n "$public_home_marker" ]]; then
  grep -Fq -- "$public_home_marker" <<<"$public_homepage"
fi

public_api="$(public "$public_api_path")"
jq -e . >/dev/null <<<"$public_api"

echo "Knowledge-Core-Web smoke passed"
