#!/usr/bin/env bash
# Readiness check for the Observability course lab (Linux and macOS). It installs nothing. The only file it writes is
# .env (read by Docker Compose) from LAB_PORT in config.env.
# Usage: ./check.sh        (or: bash check.sh)
# Exit code 0: ready (warnings may remain). Exit code 1: at least one check failed.

DEFAULT_LAB_PORT=28207
MIN_RAM_GB=2
REC_RAM_GB=4
MIN_DISK_GB=5
LAB_PROJECT="observability-lab"

cd "$(dirname "$0")" || exit 1
fails=0; warns=0
if [ -t 1 ]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'; else G=; Y=; R=; B=; N=; fi
ok()   { printf '  %sOK%s    %s\n' "$G" "$N" "$1"; }
warn() { printf '  %sWARN%s  %s\n' "$Y" "$N" "$1"; [ -n "$2" ] && printf '        %s\n' "$2"; warns=$((warns + 1)); }
fail() { printf '  %sFAIL%s  %s\n' "$R" "$N" "$1"; [ -n "$2" ] && printf '        %s\n' "$2"; fails=$((fails + 1)); }

printf '%sObservability lab: readiness check%s\n\n' "$B" "$N"

# 1. Lab contents
if [ -f docker-compose.yml ] && [ -f lab.yaml ] && [ -f shared/workstation/Containerfile ]; then
  ok "Lab files present"
else
  fail "Lab files missing" "Run this script from the unzipped observability-lab folder, and unzip the whole archive."
fi

# 2. Settings: read LAB_PORT from config.env, validate it, and write .env for Compose
BOM=$(printf '\357\273\277')
setting() {
  v=""
  if [ -f config.env ]; then
    v=$(sed -e "1s/^$BOM//" -e 's/\r$//' config.env | awk -v k="$1" '
      /^[[:space:]]*#/ { next }
      { line = $0; key = line; sub(/=.*/, "", key); gsub(/[[:space:]]/, "", key)
        if (key == k && index(line, "=")) { val = substr(line, index(line, "=") + 1); sub(/[[:space:]]+#.*$/, "", val); gsub(/^[[:space:]]+|[[:space:]]+$/, "", val); gsub(/^["\047]|["\047]$/, "", val); found = val } }
      END { print found }')
  fi
  if [ -n "$v" ]; then printf '%s' "$v"; else printf '%s' "$2"; fi
}
valid_port() { case "$1" in ''|*[!0-9]*) return 1 ;; esac; [ "$1" -ge 1024 ] && [ "$1" -le 65535 ]; }
[ -f config.env ] || warn "config.env not found" "Using the default lab port $DEFAULT_LAB_PORT."
LAB_PORT=$(setting LAB_PORT "$DEFAULT_LAB_PORT")
settings_ok=1
if ! valid_port "$LAB_PORT"; then
  fail "config.env: LAB_PORT=$LAB_PORT is not a valid port" "Use a number from 1024 to 65535."
  settings_ok=0
fi
if [ "$settings_ok" = 1 ]; then
  header='# Written from config.env by check.sh / check.ps1. Edit config.env instead, then run the check again.'
  if printf '%s\n# Local image names (localhost/lab/...): the images are built on this machine, never pulled.\nLAB_REGISTRY=localhost\nLAB_PORT=%s\n' "$header" "$LAB_PORT" > .env; then
    ok "Settings applied from config.env: lab port $LAB_PORT"
  else
    fail "Could not write .env" "Check that the lab folder is writable."
  fi
fi

# 3. Docker CLI and engine
if ! command -v docker >/dev/null 2>&1; then
  fail "Docker is not installed" "Install Docker Desktop (macOS, Windows) or Docker Engine (Linux): https://docs.docker.com/get-started/get-docker/"
  printf '\n%sNot ready:%s install Docker, then run this check again.\n' "$R" "$N"; exit 1
fi
ok "Docker CLI: $(docker --version 2>/dev/null)"
if ! info_err=$(docker info --format '{{.ServerVersion}}' 2>&1); then
  case "$info_err" in
    *"permission denied"*) hint="Your user may not use the Docker socket. Linux: sudo usermod -aG docker \$USER, then log out and in." ;;
    *) hint="Start Docker Desktop, or on Linux: sudo systemctl start docker" ;;
  esac
  fail "Docker engine is not reachable" "$hint"
  printf '\n%sNot ready:%s start the Docker engine, then run this check again.\n' "$R" "$N"; exit 1
fi
ok "Docker engine: $info_err"

# 4. Compose v2 (2.17 or newer: the lab uses build additional_contexts) and Buildx
cv=$(docker compose version --short 2>/dev/null | sed 's/^v//')
if [ -z "$cv" ]; then
  fail "Docker Compose v2 is missing" "Install the Compose plugin (docker compose, not docker-compose): https://docs.docker.com/compose/install/"
else
  major=${cv%%.*}; rest=${cv#*.}; minor=${rest%%.*}
  if [ "$major" -gt 2 ] 2>/dev/null || { [ "$major" -eq 2 ] && [ "$minor" -ge 17 ]; } 2>/dev/null; then ok "Docker Compose $cv"
  else fail "Docker Compose $cv is too old" "Version 2.17 or newer is needed."; fi
fi
if docker buildx version >/dev/null 2>&1; then ok "Docker Buildx: $(docker buildx version | awk '{print $2}')"
else fail "Docker Buildx is missing" "Compose builds the lab images with Buildx. Install the docker-buildx plugin."; fi

# 5. Engine platform, cgroups, CPU and memory
os=$(docker info --format '{{.OSType}}' 2>/dev/null); arch=$(docker info --format '{{.Architecture}}' 2>/dev/null)
if [ "$os" != "linux" ]; then
  fail "The engine runs $os containers" "Switch Docker Desktop to Linux containers."
else
  case "$arch" in
    x86_64|amd64|aarch64|arm64) ok "Engine platform: linux/$arch" ;;
    *) warn "Engine platform linux/$arch is not tested" "The lab is tested on amd64 and arm64." ;;
  esac
fi
cg=$(docker info --format '{{.CgroupVersion}}' 2>/dev/null)
if [ "$cg" = "2" ]; then ok "cgroup v2"
else warn "cgroup version '$cg'" "The lab machines run systemd and are tested on cgroup v2 (every current Linux and Docker Desktop)."; fi
cpus=$(docker info --format '{{.NCPU}}' 2>/dev/null)
if [ "${cpus:-0}" -ge 2 ] 2>/dev/null; then ok "CPUs available to Docker: $cpus"
else warn "CPUs available to Docker: ${cpus:-unknown}" "2 or more make the first build and the lab faster."; fi
mem=$(docker info --format '{{.MemTotal}}' 2>/dev/null)
mem_gb=$(awk -v m="${mem:-0}" 'BEGIN { printf "%.1f", m / 1073741824 }')
if awk -v g="$mem_gb" -v r="$REC_RAM_GB" 'BEGIN { exit !(g >= r - 0.3) }'; then ok "Memory available to Docker: ${mem_gb} GB"
elif awk -v g="$mem_gb" -v r="$MIN_RAM_GB" 'BEGIN { exit !(g >= r - 0.3) }'; then
  warn "Memory available to Docker: ${mem_gb} GB" "${REC_RAM_GB} GB or more is recommended (Docker Desktop: Settings > Resources)."
else
  fail "Memory available to Docker: ${mem_gb} GB" "At least ${MIN_RAM_GB} GB is needed (Docker Desktop: Settings > Resources)."
fi

# 6. Disk space where Docker keeps images
root=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null)
if [ -n "$root" ] && [ -d "$root" ]; then
  free_gb=$(df -Pk "$root" 2>/dev/null | awk 'NR == 2 { printf "%d", $4 / 1048576 }')
  if [ "${free_gb:-0}" -ge "$MIN_DISK_GB" ] 2>/dev/null; then ok "Free disk for Docker ($root): ${free_gb} GB"
  else warn "Free disk for Docker ($root): ${free_gb:-unknown} GB" "About ${MIN_DISK_GB} GB is needed for the images."; fi
else
  warn "Free disk for Docker: not checked" "The engine keeps its data in a VM (Docker Desktop). Make sure about ${MIN_DISK_GB} GB is free there."
fi

# 7. Port availability
port_in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
check_port() {
  owner=$(docker ps --filter "publish=$1" --format '{{.Names}}' 2>/dev/null | head -1)
  if [ -n "$owner" ]; then
    case "$owner" in "$LAB_PROJECT"-*) ok "Port $1 ($2): already used by this lab ($owner)" ;;
      *) fail "Port $1 ($2) is used by container $owner" "$3" ;; esac
  elif port_in_use "$1"; then fail "Port $1 ($2) is already in use" "$3"
  else ok "Port $1 ($2) is free"; fi
}
if [ "$settings_ok" = 1 ]; then
  check_port "$LAB_PORT" "lab" "Stop what uses it, or set another LAB_PORT in config.env and run the check again."
fi

# 8. Registries the first build pulls from
if command -v curl >/dev/null 2>&1; then
  for reg in registry-1.docker.io quay.io; do
    code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "https://$reg/v2/")
    case "$code" in 200|401) ok "Registry reachable: $reg" ;;
      *) warn "Registry not reachable: $reg (HTTP ${code:-none})" "The first start pulls base images from it. Behind a proxy, configure Docker's proxy settings." ;; esac
  done
else
  warn "Registries not checked (curl not found)" "The first start needs internet access to docker.io and quay.io."
fi

printf '\n'
if [ "$fails" -gt 0 ]; then
  printf '%sNot ready:%s %d check(s) failed, %d warning(s). Fix the failures and run ./check.sh again.\n' "$R" "$N" "$fails" "$warns"
  exit 1
fi
printf '%sReady%s (%d warning(s)). Next:\n' "$G" "$N" "$warns"
printf '  docker compose up -d                 start (or restart) the Observability lab\n'
printf '  open http://localhost:%s          browser terminals and web UIs (/grafana/, /prometheus/, /alertmanager/)' "$LAB_PORT"
[ "$LAB_PORT" != "$DEFAULT_LAB_PORT" ] && printf ' (the lessons show the default port, %s)' "$DEFAULT_LAB_PORT"
printf '\n'

exit 0
