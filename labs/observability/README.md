# Observability Course Lab

Prometheus, Alertmanager, Grafana, Loki, Tempo, and the OpenTelemetry Collector around an instrumented shop application (`app`), two Rocky Linux 9 nodes (`node1`, `node2`), and an S3 store (`s3`), accessed entirely through browser terminals and web UIs at <http://localhost:28207>.

Nothing is installed on your host machine—only **Docker** (with Compose v2.17+ and Buildx) is needed, and the lab binds strictly to `127.0.0.1`.

## Quick Start

1. **Unzip** `observability-lab.zip` and open a terminal inside the `observability-lab` folder.
2. **Run the readiness check** (validates Docker, resources, port availability, and applies `config.env`):
   ```bash
   ./check.sh                                            # Linux / macOS
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\check.ps1  # Windows
   ```
3. **Start the lab** (first run builds the local images in a few minutes):
   ```bash
   docker compose up -d
   ```
4. **Open the lab in your browser:** <http://localhost:28207> (web UIs at `/grafana/`, `/prometheus/`, `/alertmanager/`).

## Lab Topology

| Machine / Service | Role |
|---|---|
| `workstation` | Browser UI, SSH gateway, reverse proxy for web UIs, CLI tools (`promtool`, `amtool`, `logcli`, `curl`, `jq`, `yq`); the only published port (`127.0.0.1:28207`) |
| `app` | Rocky Linux 9 with systemd: instrumented Python shop app (`shop` + `inventory`), load generator, `node_exporter`, and `shopctl` fault injector |
| `node1`, `node2` | Rocky Linux 9 with systemd and `node_exporter` (port 9100); user `ops` with sudo |
| `prometheus` | Prometheus 3.15.1 with lifecycle API, remote write receiver, and exemplar storage |
| `alertmanager` | Alertmanager 0.34.2 |
| `grafana` | Grafana 13.3.0 under `/grafana/` with pre-provisioned datasources (Prometheus, Loki, Tempo, Alertmanager) |
| `loki` | Loki 3.7.9 with S3 storage and OTLP log ingestion |
| `tempo` | Tempo 3.1.1 with S3 storage and metrics generator (span metrics & service graphs) |
| `otel-collector` | OpenTelemetry Collector contrib 0.164.0 forwarding traces to Tempo and JSON logs to Loki |
| `s3` | SeaweedFS 4.48 providing buckets for Loki and Tempo |

## Day-to-Day Commands

| Action | Command |
|---|---|
| Pause the lab (keep metrics, logs, traces & config) | `docker compose stop` |
| Resume the lab | `docker compose up -d` |
| Full reset (fresh volumes & starter config) | `docker compose down -v && docker compose up -d` |
| Change port | Edit `LAB_PORT` in `config.env`, re-run `./check.sh` or `check.ps1`, then `docker compose up -d` |
| Remove lab containers, volumes & local images | `docker compose down -v --rmi local` |

## Requirements & Troubleshooting

- **Resources:** 4 GB RAM recommended (2 GB minimum) and ~5 GB free disk for Docker images.
- **Port in use:** Change `LAB_PORT` in `config.env`, re-run the readiness check, and run `docker compose up -d`.
- **`permission denied` on Docker socket (Linux):** Run `sudo usermod -aG docker $USER`, then log out and back in.
- **Docker Hub rate limit (`toomanyrequests`):** Wait a few minutes or run `docker login` with a free Docker Hub account.
- **Machine shows a red dot:** Wait a few seconds for startup, or check `docker compose ps` and `docker compose logs <service>`.

## License

Lab files and scripts are licensed under the MIT License (`LICENSE`). Course content is © 2026 Krishnadas Thengil (CC BY-NC-SA 4.0).
