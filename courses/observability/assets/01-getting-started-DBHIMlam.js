var e={id:`obe-start`,track:`engineer`,order:1,title:`Getting started`,icon:`Terminal`,hue:200,blurb:`Start the lab, find your way around the services and the shop, and configure Prometheus to scrape the nodes, the shop and the observability stack itself.`,lessons:[{id:`obe-lab-setup`,title:`Build your lab`,duration:`15 min`,summary:"One `docker compose up -d` starts Prometheus, Alertmanager, Grafana, Loki, Tempo and the OpenTelemetry Collector, a shop of two Python services with a load generator, and two Rocky Linux nodes. Every lab in this track runs there, in browser terminals and the Grafana, Prometheus and Alertmanager web UIs.",objectives:[`Understand the lab topology and how telemetry flows`,`Start, pause and reset the lab with Docker Compose`,`Check the services and the shop from the workstation`],docs:[{label:`Prometheus documentation`,url:`https://prometheus.io/docs/`},{label:`Grafana documentation`,url:`https://grafana.com/docs/grafana/latest/`}],blocks:[{diagram:`flowchart LR
  B["Browser<br/>localhost:28207"] --> WS["workstation<br/>terminals, proxy,<br/>promtool, amtool, logcli"]
  subgraph NET["Private lab network"]
    APP["app: shop + inventory<br/>+ load generator"] -->|"OTLP traces"| COL["otel-collector"]
    APP -->|"JSON log files"| COL
    COL --> TEMPO["tempo"] & LOKI["loki"]
    TEMPO & LOKI --> S3["s3 (SeaweedFS)"]
    PROM["prometheus"] -->|"scrape /metrics"| APP & N1["node1, node2<br/>node_exporter"]
    PROM --> AM["alertmanager"] -->|"webhook"| WS
    GRAF["grafana"] --> PROM & LOKI & TEMPO
    TEMPO -->|"span metrics"| PROM
  end
  WS --> GRAF & PROM & AM`,title:`Lab topology and telemetry flow`},{table:{head:[`Machine`,`Used for`],rows:[[`workstation`,"Your terminal: `promtool`, `amtool`, `logcli`, `curl`, `jq`; `~/prometheus` and `~/alertmanager` are the live configuration of those servers"],[`app`,"The shop: services `shop` (port 8080) and `inventory` (8081), a load generator, `shopctl` to inject faults"],[`node1, node2`,"Rocky Linux 9 machines with node_exporter (port 9100); user `ops` with sudo"],[`prometheus, alertmanager, grafana, loki, tempo, otel-collector, s3`,`The observability services (no terminal; web UIs from the links on the left)`]]}},{table:{head:[`Command (on your machine, in the lab folder)`,`What it does`],rows:[["`docker compose up -d`",`Start or resume the lab (the first start builds the images)`],["`docker compose stop`",`Pause the lab, keeping all data`],["`docker compose down -v`",`Remove everything, including stored metrics, logs, traces and your configuration, for a fresh start`]]}},{callout:`The command-line tools on the workstation come from Alpine Linux and are older than the servers (promtool 2.53, amtool 0.28, logcli 3.5). They check files and talk to the APIs fine; amtool prints a version warning, which you can ignore.`,tone:`note`}],lab:{kind:`hands-on`,title:`Start the lab and look around`,duration:`10 min`,goal:`Start the lab, check that the services answer, look at the shop and its telemetry at the source, and open the web UIs.`,steps:[{title:`Start the lab`,text:"On your machine, open a terminal in the folder where you unzipped the course and go into its `lab/` folder. The first run builds the lab images, which takes a few minutes.",code:{lang:`bash`,code:`$ cd lab
$ docker compose up -d
$ docker compose ps`}},{title:`Open the lab`,text:`Go to **http://localhost:28207**. Open a terminal on **workstation** and one on **app**.`},{title:`Check the services`,text:`On the workstation. The variables hold each service's URL.`,code:{lang:`bash`,code:`$ echo $PROM $AM $LOKI $TEMPO $GRAFANA
http://prometheus:9090 http://alertmanager:9093 http://loki:3100 http://tempo:3200 http://grafana:3000/grafana
$ curl -s $PROM/-/ready
Prometheus Server is Ready.
$ curl -s $AM/-/ready
OK
$ curl -s $LOKI/ready
ready
$ curl -s $TEMPO/ready
ready
$ curl -s $GRAFANA/api/health | jq -c .
{"database":"ok","version":"13.3.0","commit":"6f8ce3c693b493043ebcd4787566d2b6b118b0f0"}`}},{title:`The shop at the source`,text:`On app. The services expose metrics, write JSON logs and send traces to the collector.`,code:{lang:`bash`,title:`On app`,code:`$ systemctl is-active shop inventory shop-load node_exporter
active
active
active
active
$ curl -s 'localhost:8080/checkout?item=mug'
{"item": "mug", "ordered": true, "stock_left": 16}
$ curl -s localhost:8080/metrics | grep '^http_requests_total'
http_requests_total{code="200",route="/checkout",service="shop"} 310.0
http_requests_total{code="200",route="/",service="shop"} 99.0
$ tail -1 /var/log/shop/shop.log | jq .
{
  "time": "2026-11-01T16:33:39.084Z",
  "level": "info",
  "service": "shop",
  "msg": "request",
  "route": "/checkout",
  "item": "mug",
  "status": 200,
  "duration_ms": 23.4,
  "trace_id": "80b3d035eaf47d909704f831fadd3c50",
  "span_id": "5ae8c41aceb94645"
}`}},{title:`Open the web UIs`,text:`Use the **Grafana**, **Prometheus** and **Alertmanager** links on the left. In Grafana, open **Connections → Data sources**: Prometheus, Loki, Tempo and Alertmanager are provisioned. In Prometheus, open **Status → Target health**: so far it only scrapes itself.`}],verify:{text:'All five services report ready (Grafana as `"database":"ok"` with version 13.3.0). On app, the four services are `active`, a checkout returns `"ordered": true`, `http_requests_total` has series per route and status code, and the last log line is a JSON object with `trace_id` and `span_id`.'},solution:{text:'Services that are still starting answer with an error or "not ready" for up to a minute: wait and retry. `docker compose ps` on your machine shows a service that keeps restarting; `docker compose logs <service>` shows why.'},challenge:"Run the checkout request a few times and compare `duration_ms` in the log lines with the `http_request_duration_seconds` buckets on /metrics. Which bucket do most requests fall into?"},takeaways:[`The lab has the full stack plus an instrumented shop and two nodes`,`The workstation holds the tools and the live Prometheus and Alertmanager config`,`Every service answers a readiness endpoint`]},{id:`obe-scraping`,title:`Scrape configuration`,duration:`25 min`,summary:"Prometheus scrapes what its configuration lists. Static targets are the simplest form of service discovery; labels added per target group become labels on every series. After changing the file, `promtool check config` catches mistakes, and a reload applies it without a restart. The targets API shows the result.",objectives:[`Add scrape jobs with static targets and labels`,`Check and reload the configuration safely`,`Read target health through the API`],prereqs:[`obe-lab-setup`],docs:[{label:`Prometheus: scrape_config`,url:`https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config`},{label:`Prometheus: management API`,url:`https://prometheus.io/docs/prometheus/latest/management_api/`}],blocks:[{concepts:[{name:`job and instance`,text:"Every scraped series gets `job` (the scrape job name) and `instance` (the target address) labels automatically."},{name:`Target labels`,text:"Labels in a `static_configs` group are added to all series from those targets, for example `env` or `role`. If the target already exposes a label with the same name (the shop exposes `service`), Prometheus keeps the target's value and renames the exposed one to `exported_<name>`, so avoid such clashes."},{name:`Reload`,text:"With `--web.enable-lifecycle`, `POST /-/reload` re-reads the configuration; an invalid file is rejected and the old configuration stays active."}]},{callout:"Always run `promtool check config` before reloading. A rejected reload keeps the old configuration, so the mistake is easy to miss until someone wonders why the new targets never appear.",tone:`warn`}],lab:{kind:`hands-on`,title:`Scrape the nodes, the shop and the stack`,duration:`20 min`,goal:`Extend the Prometheus configuration with jobs for node_exporter, the shop services and the observability services, check it, reload, and confirm every target is up.`,steps:[{title:`Write the configuration`,text:"Replace `~/prometheus/prometheus.yml` with this version.",code:{lang:`yaml`,file:`~/prometheus/prometheus.yml`,code:`global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: [alertmanager:9093]

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: [localhost:9090]

  - job_name: node
    static_configs:
      - targets: [app:9100, node1:9100, node2:9100]
        labels: { env: lab }

  - job_name: shop
    static_configs:
      - targets: [app:8080, app:8081]
        labels: { env: lab }

  - job_name: stack
    static_configs:
      - targets: [alertmanager:9093, loki:3100, tempo:3200, otel-collector:8888]

  - job_name: grafana
    metrics_path: /grafana/metrics      # Grafana serves everything under its sub-path
    static_configs:
      - targets: [grafana:3000]`}},{title:`Check and reload`,text:`On the workstation.`,code:{lang:`bash`,code:`$ promtool check config ~/prometheus/prometheus.yml
Checking /home/lab/prometheus/prometheus.yml
 SUCCESS: /home/lab/prometheus/prometheus.yml is valid prometheus config file syntax
$ curl -s -X POST $PROM/-/reload && echo reloaded
reloaded
$ sleep 20`}},{title:`Target health`,code:{lang:`bash`,code:`$ curl -s $PROM/api/v1/targets | jq -r '.data.activeTargets[] | [.labels.job, .labels.instance, .health] | @tsv' | sort
grafana	grafana:3000	up
node	app:9100	up
node	node1:9100	up
node	node2:9100	up
prometheus	localhost:9090	up
shop	app:8080	up
shop	app:8081	up
stack	alertmanager:9093	up
stack	loki:3100	up
stack	otel-collector:8888	up
stack	tempo:3200	up
$ curl -s $PROM/api/v1/query --data-urlencode 'query=count by (job) (up)' | jq -r '.data.result[] | "\\(.metric.job) \\(.value[1])"'
prometheus 1
stack 4
grafana 1
shop 2
node 3`}},{title:`A mistake caught`,text:`Make a broken copy and see promtool reject it.`,code:{lang:`bash`,code:`$ sed 's/scrape_interval: 15s/scrape_interval: fast/' ~/prometheus/prometheus.yml > /tmp/broken.yml
$ promtool check config /tmp/broken.yml
Checking /tmp/broken.yml
  FAILED: parsing YAML file /tmp/broken.yml: not a valid duration string: "fast"`}}],verify:{text:"`promtool check config` reports SUCCESS for the rule file pattern and the configuration. After the reload, eleven targets are listed, all `up`: one each in `prometheus` and `grafana`, three in `node`, two in `shop` and four in `stack`, as the count per job shows. The broken copy fails with an error about the duration."},solution:{text:"If a target is `down`, look at `.lastError` in the targets API output (`jq '.data.activeTargets[] | select(.health==\"down\") | .lastError'`). A reload that prints nothing but changes nothing usually means the file was rejected: `curl -s $PROM/api/v1/status/config | jq -r .data.yaml | head` shows the active configuration."},challenge:"Add `scrape_interval: 5s` to the shop job only and reload. How can you check the effective interval per target in the targets API?"},takeaways:[`Scrape jobs list targets; group labels apply to all their series`,`promtool check config before every reload`,`The targets API shows health and the last scrape error`]}]};export{e as default};