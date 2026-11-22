#!/bin/sh
# Build-time extras for the Observability lab workstation: promtool, amtool and logcli from Alpine's packages (older
# than the servers in the lab, but compatible for checking files and querying the APIs), plus jq and yq.
set -eu
apk add --no-cache prometheus alertmanager loki-logcli jq yq-go
# Only the command-line tools are wanted; the Prometheus and Alertmanager servers run in their own containers.
rm -f /usr/bin/prometheus /usr/bin/alertmanager
chmod 755 /opt/lab/start.sh /opt/lab/alert-receiver.py
# amtool reads the Alertmanager address from its configuration file.
mkdir -p /etc/amtool && echo 'alertmanager.url: http://alertmanager:9093' > /etc/amtool/config.yml

cat > /etc/profile.d/obslab.sh <<'PROFILE'
export PROM=http://prometheus:9090 AM=http://alertmanager:9093 LOKI=http://loki:3100 TEMPO=http://tempo:3200
export GRAFANA=http://grafana:3000/grafana LOKI_ADDR=http://loki:3100
PROFILE
