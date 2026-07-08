#!/usr/bin/env bash
# Provisionamento bare-metal da E2.1.Micro — roda como transient unit
# (systemd-run) pra sobreviver a quedas de SSH. Log: /var/log/paddock-provision.log
set -euo pipefail

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "1/4 pacotes do sistema (weak deps off, um grupo por vez)"
dnf install -y --setopt=install_weak_deps=False python3.12 python3.12-pip
dnf install -y --setopt=install_weak_deps=False redis
# WeasyPrint: libs de renderização
dnf install -y --setopt=install_weak_deps=False pango gdk-pixbuf2 shared-mime-info

log "2/4 redis enxuto"
sed -i 's/^# maxmemory <bytes>/maxmemory 48mb/;s/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf || true
systemctl enable --now redis

log "3/4 caddy (binário estático)"
curl -fsSL -o /tmp/caddy.tar.gz "https://github.com/caddyserver/caddy/releases/latest/download/caddy_linux_amd64.tar.gz" 2>/dev/null \
  || curl -fsSL -o /usr/local/bin/caddy "https://caddyserver.com/api/download?os=linux&arch=amd64"
if [ -f /tmp/caddy.tar.gz ]; then tar -xzf /tmp/caddy.tar.gz -C /usr/local/bin caddy; fi
chmod +x /usr/local/bin/caddy
mkdir -p /etc/caddy

log "4/4 diretório da app"
mkdir -p /opt/paddock
chown opc:opc /opt/paddock

log "PROVISION_DONE"
