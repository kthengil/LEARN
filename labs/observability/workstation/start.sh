#!/bin/sh
# Observability lab workstation start-up (run as root by lab-entrypoint): seed the Prometheus and Alertmanager
# configuration on the volumes those services read, give them to the lab user, and start the alert receiver.
set -eu
for svc in prometheus alertmanager; do
  # First start: replace whatever the volume holds (the server image's own example configuration) with the lab's.
  if [ ! -e "/srv/$svc/.lab-seeded" ]; then
    find "/srv/$svc" -mindepth 1 -delete
    cp -r "/opt/lab/defaults/$svc/." "/srv/$svc/"
    touch "/srv/$svc/.lab-seeded"
  fi
  mkdir -p /srv/prometheus/rules
  chown -R lab:lab "/srv/$svc"
  chmod -R a+rX "/srv/$svc"
  [ -e "/home/lab/$svc" ] || su-exec lab ln -s "/srv/$svc" "/home/lab/$svc"
done
su-exec lab mkdir -p /home/lab/lab
# Webhook receiver for Alertmanager: every notification is appended to ~/alerts.log.
su-exec lab sh -c 'nohup python3 /opt/lab/alert-receiver.py >/dev/null 2>&1 &'
