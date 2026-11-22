# KriT LEARN — Public Course Library & Local Labs

**Live Portal:** <https://kthengil.github.io/LEARN/>

Self-paced engineering courses designed to be read directly in the browser via **GitHub Pages**, paired with lightweight, individually downloadable **Docker Compose labs** that run locally on `127.0.0.1`.

## Courses Included

| Course | Tracks | Lessons | Local Lab Pack | Default Lab URL |
|---|---|---|---|---|
| **Ansible** | Architect &amp; Engineer | 37 | [`downloads/ansible-lab.zip`](downloads/ansible-lab.zip) | `http://localhost:28201` |
| **Apache Kafka** | Architect &amp; Engineer | 29 | [`downloads/apache-kafka-lab.zip`](downloads/apache-kafka-lab.zip) | `http://localhost:28202` |
| **Observability** | Architect &amp; Engineer | 27 | [`downloads/observability-lab.zip`](downloads/observability-lab.zip) | `http://localhost:28207` |

## Repository Structure

```text
.
├── index.html                  # Home page with 4 tiles (3 courses + Lab Setup)
├── lab-setup/index.html        # Lab Setup guide & individual lab zip downloads
├── assets/                     # Shared portal CSS & JS (theme synced with courses)
├── courses/                    # Static course SPAs (ansible, apache-kafka, observability)
├── labs/                       # Standalone lab sources (docker-compose, check.sh/ps1, config.env)
├── downloads/                  # Pre-built individual lab zip archives served by GitHub Pages
├── scripts/build-lab-zips.sh   # Rebuilds downloads/*.zip from labs/
├── .github/workflows/pages.yml # GitHub Actions workflow for GitHub Pages deployment
├── .nojekyll                   # Disables Jekyll processing on GitHub Pages
├── LICENSE                     # MIT License (code & lab files)
└── LICENSE-CONTENT             # CC BY-NC-SA 4.0 (course content)
```

## Publishing to GitHub Pages

1. Initialize and push this repository to GitHub (default branch `main`):
   ```bash
   git init -b main
   git add .
   git commit -m "Publish KriT LEARN portal with Ansible, Apache Kafka, and Observability courses"
   git remote add origin https://github.com/kthengil/LEARN.git
   git push -u origin main
   ```
2. In your GitHub repository, go to **Settings → Pages** and choose either:
   - **GitHub Actions** (recommended — uses `.github/workflows/pages.yml` automatically on every push to `main`), **or**
   - **Deploy from a branch** → Branch `main`, folder `/ (root)`.

## Updating & Rebuilding Lab Zips

If you modify anything under `labs/<course>/`, regenerate the downloadable zip files before committing:

```bash
./scripts/build-lab-zips.sh
```

## Local Preview

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## Licensing

- **Course content** © 2026 Krishnadas Thengil, licensed under **CC BY-NC-SA 4.0** ([`LICENSE-CONTENT`](LICENSE-CONTENT)).
- **Code, portal, and lab files** are licensed under the **MIT License** ([`LICENSE`](LICENSE)).
- Third-party components retain their own licenses (see `courses/<course>/THIRD-PARTY-NOTICES.txt`).
- **KriT** and **LEARN** are the owner's trademarks. Other product names belong to their respective owners.
