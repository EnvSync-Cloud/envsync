#!/usr/bin/env bash
# EnvSync one-shot self-host installer.
#
# Runs the full flow end-to-end: preflight -> setup -> DNS records -> bootstrap -> deploy.
#
# Usage (cloned repo):
#   sudo bash scripts/selfhost-install.sh
#
# Usage (no clone required — hosted one-liner):
#   curl -fsSL https://envsync.cloud/install | sudo bash

set -euo pipefail

c_red=$'\033[0;31m'; c_green=$'\033[0;32m'; c_yellow=$'\033[0;33m'
c_blue=$'\033[0;34m'; c_dim=$'\033[2m'; c_bold=$'\033[1m'; c_reset=$'\033[0m'
section() { printf '\n%s==> %s%s\n' "$c_bold$c_blue" "$1" "$c_reset"; }
ok()      { printf '  %s[ ok ]%s %s\n' "$c_green" "$c_reset" "$1"; }
skip()    { printf '  %s[skip]%s %s\n' "$c_dim"   "$c_reset" "$1"; }
warn()    { printf '  %s[warn]%s %s\n' "$c_yellow" "$c_reset" "$1"; }
die()     { printf '  %s[fail]%s %s\n' "$c_red"   "$c_reset" "$1" >&2; exit 1; }

# ---------- 0. Re-attach stdin for `curl | bash` piped installs ----------
# If stdin is not a TTY (i.e. we're being piped from curl), try to re-open it
if [ ! -t 0 ]; then
  if [ -r /dev/tty ]; then
    exec </dev/tty
  else
    die "No TTY available. This installer needs interactive input.
       Try: curl -fsSL https://envsync.cloud/install -o envsync-install.sh
            sudo bash envsync-install.sh"
  fi
fi

# ---------- 0b. Root check ----------
if [ "$(id -u)" -ne 0 ]; then
  if [ -f "${BASH_SOURCE[0]:-}" ]; then
    echo "This installer needs root. Re-running under sudo..."
    exec sudo -E bash "${BASH_SOURCE[0]}" "$@"
  fi
  die "Please pipe to \`sudo bash\` instead of \`bash\`:
       curl -fsSL https://envsync.cloud/install | sudo bash"
fi

# ---------- 0c. OS detection ----------
[ -r /etc/os-release ] || die "Unsupported system: /etc/os-release not found."
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *) die "Only Ubuntu and Debian are supported (detected: ${ID:-unknown}).";;
esac
ARCH="$(dpkg --print-architecture)"
CODENAME="${VERSION_CODENAME:-}"
[ -n "$CODENAME" ] || CODENAME="$(lsb_release -cs 2>/dev/null || echo stable)"

# ---------- 1. Connectivity checks  ----------
section "Preflight connectivity checks"
pf_fail=0
pf_check() {
  local label="$1" url="$2"
  if curl -fsSL --max-time 10 "$url" >/dev/null 2>&1; then
    ok "$label reachable"
  else
    warn "$label NOT reachable ($url)"
    pf_fail=1
  fi
}
pf_check "internet (cloudflare)"   "https://1.1.1.1"
pf_check "ghcr.io"                 "https://ghcr.io"
pf_check "letsencrypt ACME v2"     "https://acme-v02.api.letsencrypt.org/directory"
pf_check "npm registry"            "https://registry.npmjs.org"
pf_check "docker apt repo"         "https://download.docker.com/linux/${ID}/gpg"
pf_check "bun.sh"                  "https://bun.sh/install"
if [ "$pf_fail" -eq 1 ]; then
  die "One or more required endpoints are unreachable — fix network/firewall and retry."
fi

# ---------- 2. Base apt packages ----------
section "Base packages"
BASE_PKGS=(ca-certificates curl gnupg lsb-release unzip git jq openssl tar dnsutils)
missing=()
for p in "${BASE_PKGS[@]}"; do
  if ! dpkg -s "$p" >/dev/null 2>&1; then missing+=("$p"); fi
done
if [ "${#missing[@]}" -eq 0 ]; then
  skip "all base packages already installed"
else
  ok "installing: ${missing[*]}"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends "${missing[@]}"
fi

# ---------- 3. Bun ----------
section "Bun"
export BUN_INSTALL="/usr/local/bun"
export PATH="$BUN_INSTALL/bin:$PATH"
if command -v bun >/dev/null 2>&1; then
  skip "bun $(bun --version) already installed"
else
  ok "installing bun to $BUN_INSTALL"
  curl -fsSL https://bun.sh/install | bash >/dev/null
  ln -sf "$BUN_INSTALL/bin/bun"  /usr/local/bin/bun
  ln -sf "$BUN_INSTALL/bin/bunx" /usr/local/bin/bunx 2>/dev/null || \
    ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bunx
  ok "bun $(bun --version)"
fi

# ---------- 4. Docker CE with buildx + compose ----------
section "Docker"
docker_ok=0
if command -v docker >/dev/null 2>&1 \
   && docker buildx version >/dev/null 2>&1 \
   && docker compose version >/dev/null 2>&1; then
  docker_ok=1
fi

if [ "$docker_ok" -eq 1 ]; then
  skip "docker + buildx + compose already installed"
else
  ok "installing Docker CE from Docker's official apt repo"
  # Remove conflicting distro packages quietly (they can't coexist with docker-ce).
  apt-get remove -y docker.io docker-doc docker-compose docker-compose-v2 \
    podman-docker containerd runc >/dev/null 2>&1 || true

  install -d -m 0755 /etc/apt/keyrings
  if [ ! -s /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" \
      -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi

  cat > /etc/apt/sources.list.d/docker.list <<EOF
deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${CODENAME} stable
EOF

  apt-get update -y
  apt-get install -y \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker >/dev/null
docker buildx version >/dev/null 2>&1 || die "docker buildx still missing after install."
ok "$(docker --version)"
ok "$(docker buildx version | head -1)"
ok "$(docker compose version)"

# ---------- 5. Host directories ----------
section "Host directories"
install -d -m 0755 /opt/envsync /opt/envsync/deploy /opt/envsync/releases /opt/envsync/backups
install -d -m 0755 /etc/envsync /var/lib/envsync/traefik
ok "/opt/envsync, /etc/envsync, /var/lib/envsync/traefik ready"

# ---------- 6. Swarm ----------
section "Docker Swarm"
if docker info 2>/dev/null | grep -q "Swarm: active"; then
  skip "swarm already active"
else
  docker swarm init >/dev/null 2>&1 || warn "swarm init returned non-zero — continuing"
  ok "swarm initialised"
fi

# ---------- 7. Public IP ----------
section "Public IP"
PUBLIC_IP="$(curl -fsSL --max-time 5 https://api.ipify.org  || true)"
[ -n "$PUBLIC_IP" ] || PUBLIC_IP="$(curl -fsSL --max-time 5 https://ifconfig.me  || true)"
[ -n "$PUBLIC_IP" ] || PUBLIC_IP="$(curl -fsSL --max-time 5 https://icanhazip.com || true)"
if [ -z "$PUBLIC_IP" ]; then
  warn "Could not auto-detect public IP."
  read -rp "Enter the public IPv4 of this host: " PUBLIC_IP
fi
ok "public IP: ${c_bold}${PUBLIC_IP}${c_reset}"

# ---------- 8. Setup (interactive; deploy-cli prompts for domain, SMTP, etc.) ----------
section "deploy-cli setup"
DEPLOY_YAML="/etc/envsync/deploy.yaml"
run_setup=1
if [ -f "$DEPLOY_YAML" ]; then
  read -rp "$DEPLOY_YAML already exists. Re-run setup and overwrite? [y/N] " re
  case "$re" in y|Y|yes) run_setup=1 ;; *) run_setup=0 ;; esac
fi
if [ "$run_setup" -eq 1 ]; then
  echo "Tip: all DNS records will point to ${c_bold}${PUBLIC_IP}${c_reset}."
  bunx @envsync-cloud/deploy-cli setup
else
  skip "keeping existing $DEPLOY_YAML"
fi
[ -f "$DEPLOY_YAML" ] || die "$DEPLOY_YAML missing after setup."

# ---------- 9. Generate DNS records ----------
section "DNS records"
ROOT_DOMAIN="$(awk '
  /^domain:/      { in_block=1; next }
  in_block && /^[^[:space:]]/ { in_block=0 }
  in_block && $1 == "root_domain:" {
    gsub(/["'\'',]/, "", $2); print $2; exit
  }' "$DEPLOY_YAML")"
[ -n "$ROOT_DOMAIN" ] || die "Could not read domain.root_domain from $DEPLOY_YAML"
ok "root domain: $ROOT_DOMAIN"

SUBS=("@" "app" "api" "auth" "obs" "s3" "console.s3")
ZONE_FILE="/etc/envsync/dns-records.txt"

# BIND zone file. Cloudflare's DNS importer accepts this format and picks up the
{
  echo "; EnvSync DNS records for ${ROOT_DOMAIN}"
  echo "; Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) — import into your DNS provider."
  echo "\$ORIGIN ${ROOT_DOMAIN}."
  echo "\$TTL 3600"
  for s in "${SUBS[@]}"; do
    printf '%-14s IN  A  %-15s ; EnvSync\n' "$s" "$PUBLIC_IP"
  done
} > "$ZONE_FILE"

cat <<EOF

${c_bold}Add these A records (all -> ${PUBLIC_IP}):${c_reset}
  ${ROOT_DOMAIN}
  app.${ROOT_DOMAIN}
  api.${ROOT_DOMAIN}
  auth.${ROOT_DOMAIN}
  obs.${ROOT_DOMAIN}
  s3.${ROOT_DOMAIN}
  console.s3.${ROOT_DOMAIN}

Import file:
  ${ZONE_FILE}

  Cloudflare UI: Zone -> DNS -> Records -> Import and Export -> Import.
  Each record carries a "; EnvSync" comment so you can filter on it later.

EOF

# ---------- 10. DNS propagation gate ----------
section "DNS propagation"
while true; do
  read -rp "Records added? [y = continue, v = verify via dig, s = skip]: " ans
  case "$ans" in
    y|Y) break ;;
    s|S) warn "Skipping DNS check; TLS issuance will fail if records are missing."; break ;;
    v|V|verify)
      allpass=1
      for s in "${SUBS[@]}"; do
        if [ "$s" = "@" ]; then host="$ROOT_DOMAIN"; else host="$s.$ROOT_DOMAIN"; fi
        got="$(dig +short "$host" A @1.1.1.1 | tail -1)"
        if [ "$got" = "$PUBLIC_IP" ]; then
          ok "$host -> $got"
        else
          warn "$host -> ${got:-<empty>} (expected $PUBLIC_IP)"
          allpass=0
        fi
      done
      [ "$allpass" -eq 1 ] && break
      ;;
  esac
done

# ---------- 11. Bootstrap ----------
section "Bootstrap"
bootstrap_completed=0
if command -v envsync-deploy >/dev/null 2>&1 || bunx -p @envsync-cloud/deploy-cli which envsync-deploy >/dev/null 2>&1; then
  if bunx @envsync-cloud/deploy-cli health --json 2>/dev/null \
      | jq -e '.bootstrap.completed == true' >/dev/null 2>&1; then
    bootstrap_completed=1
  fi
fi

if [ "$bootstrap_completed" -eq 1 ]; then
  warn "Bootstrap already completed on this host."
  warn "Re-running is DESTRUCTIVE — it rotates managed secrets and rebuilds infra."
  read -rp "Re-run bootstrap anyway? [y/N] " reboot
  case "$reboot" in
    y|Y|yes) bunx @envsync-cloud/deploy-cli bootstrap ;;
    *)       skip "keeping existing bootstrap state" ;;
  esac
else
  bunx @envsync-cloud/deploy-cli bootstrap
fi

# ---------- 12. Deploy ----------
section "Deploy"
bunx @envsync-cloud/deploy-cli deploy

# ---------- 13. Health ----------
section "Post-deploy health"
bunx @envsync-cloud/deploy-cli health || true

cat <<EOF

${c_green}${c_bold}EnvSync self-host install complete.${c_reset}

  Dashboard:  https://app.${ROOT_DOMAIN}
  API:        https://api.${ROOT_DOMAIN}
  Keycloak:   https://auth.${ROOT_DOMAIN}
  HyperDX:    https://obs.${ROOT_DOMAIN}

Next steps:
  envsync-deploy health
  envsync-deploy backup
EOF
