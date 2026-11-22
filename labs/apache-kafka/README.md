# Apache Kafka Course Lab

A three-node Apache Kafka 4.1 cluster (each node acting as broker + KRaft controller), two client machines (`producer`, `consumer`), and a Kafka Connect worker (`connect`), accessed entirely through browser terminals at <http://localhost:28202>.

Nothing is installed on your host machine—only **Docker** (with Compose v2.17+ and Buildx) is needed, and the lab binds strictly to `127.0.0.1`.

## Quick Start

1. **Unzip** `apache-kafka-lab.zip` and open a terminal inside the `apache-kafka-lab` folder.
2. **Run the readiness check** (validates Docker, resources, port availability, and applies `config.env`):
   ```bash
   ./check.sh                                            # Linux / macOS
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\check.ps1  # Windows
   ```
3. **Start the lab** (first run builds two small local images in a few minutes):
   ```bash
   docker compose up -d
   ```
4. **Open the lab in your browser:** <http://localhost:28202> (or your custom `LAB_PORT`).

## Lab Topology

| Machine | Role |
|---|---|
| `workstation` | Browser UI and SSH gateway; the only published port (`127.0.0.1:28202`) |
| `broker1`–`broker3` | Kafka 4.1 broker + KRaft controller (`kafka-service start/stop/status/logs`) |
| `producer`, `consumer` | Client machines with all Kafka CLI tools and `$BOOTSTRAP` preconfigured |
| `connect` | Kafka Connect worker (`kafka-service start`), REST API on `localhost:8083` inside that machine |

## Day-to-Day Commands

| Action | Command |
|---|---|
| Pause the lab (keep cluster data) | `docker compose stop` |
| Resume the lab | `docker compose up -d` |
| Full reset (fresh cluster & volumes) | `docker compose down -v && docker compose up -d` |
| Change port | Edit `LAB_PORT` in `config.env`, re-run `./check.sh` or `check.ps1`, then `docker compose up -d` |
| Remove lab containers, volumes & local images | `docker compose down -v --rmi local` |

## Requirements & Troubleshooting

- **Resources:** 4 GB RAM recommended (3 GB minimum) and ~5 GB free disk for Docker images.
- **Port in use:** Change `LAB_PORT` in `config.env`, re-run the readiness check, and run `docker compose up -d`.
- **`permission denied` on Docker socket (Linux):** Run `sudo usermod -aG docker $USER`, then log out and back in.
- **Docker Hub rate limit (`toomanyrequests`):** Wait a few minutes or run `docker login` with a free Docker Hub account.
- **Machine shows a red dot:** Wait a few seconds for startup, or check `docker compose ps` and `docker compose logs <machine>`.

## License

Lab files and scripts are licensed under the MIT License (`LICENSE`). Course content is © 2026 Krishnadas Thengil (CC BY-NC-SA 4.0).
