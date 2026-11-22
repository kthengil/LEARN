# Ansible Course Lab

An Ansible control node (`controller`) and four Rocky Linux 9 managed nodes (`node1`–`node4`) with systemd, accessed entirely through browser terminals at <http://localhost:28201>.

Nothing is installed on your host machine—only **Docker** (with Compose v2.17+ and Buildx) is needed, and the lab binds strictly to `127.0.0.1`.

## Quick Start

1. **Unzip** `ansible-lab.zip` and open a terminal inside the `ansible-lab` folder.
2. **Run the readiness check** (validates Docker, resources, port availability, and applies `config.env`):
   ```bash
   ./check.sh                                            # Linux / macOS
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\check.ps1  # Windows
   ```
3. **Start the lab** (first run builds three small local images in a few minutes):
   ```bash
   docker compose up -d
   ```
4. **Open the lab in your browser:** <http://localhost:28201> (or your custom `LAB_PORT`).

## Lab Topology

| Machine | Role |
|---|---|
| `workstation` | Browser UI, SSH gateway, and `/web/<node>/` proxy; the only published port (`127.0.0.1:28201`) |
| `controller` | Ansible control node: Python 3.12 venv with `ansible-core` 2.21 and `ansible-lint`; project in `~/lab` (persistent volume) |
| `node1` (lb), `node2`–`node3` (web), `node4` (db) | Rocky Linux 9 with systemd and sshd; user `ansible` with passwordless sudo |

## Day-to-Day Commands

| Action | Command |
|---|---|
| Pause the lab (keep your work) | `docker compose stop` |
| Resume the lab | `docker compose up -d` |
| Reset nodes (keep `~/lab` on controller) | `docker compose down && docker compose up -d` |
| Full reset (fresh volumes) | `docker compose down -v && docker compose up -d` |
| Change port | Edit `LAB_PORT` in `config.env`, re-run `./check.sh` or `check.ps1`, then `docker compose up -d` |
| Remove lab containers, volumes & local images | `docker compose down -v --rmi local` |

## Requirements & Troubleshooting

- **Resources:** 4 GB RAM recommended (2 GB minimum) and ~5 GB free disk for Docker images.
- **Port in use:** Change `LAB_PORT` in `config.env`, re-run the readiness check, and run `docker compose up -d`.
- **`permission denied` on Docker socket (Linux):** Run `sudo usermod -aG docker $USER`, then log out and back in.
- **Docker Hub rate limit (`toomanyrequests`):** Wait a few minutes or run `docker login` with a free Docker Hub account.
- **Machine shows a red dot:** Wait a few seconds for startup, or check `docker compose ps` and `docker compose logs <machine>`.

## License

Lab files and scripts are licensed under the MIT License (`LICENSE`). Course content is © 2026 Krishnadas Thengil (CC BY-NC-SA 4.0).
