var e={id:`obe-dashboards-slos`,track:`engineer`,order:4,title:`Dashboards and SLOs`,icon:`Gauge`,hue:285,blurb:`Build a Grafana dashboard as code through the HTTP API, then define an availability SLO for checkouts with recording rules and multiwindow burn-rate alerts, and watch the fast-burn alert catch a fault.`,lessons:[{id:`obe-dashboards`,title:`Grafana dashboards as code`,duration:`25 min`,summary:`A Grafana dashboard is a JSON document: panels with queries, a layout grid, and variables that make one dashboard serve every service. Keeping that JSON in files and applying it through the HTTP API (or provisioning) makes dashboards reviewable and reproducible, like any other configuration.`,objectives:[`Write a dashboard JSON with panels, queries and a variable`,`Create a folder and the dashboard through the Grafana API`,`Query a data source through Grafana`],prereqs:[`obe-red`],docs:[{label:`Grafana: dashboard HTTP API`,url:`https://grafana.com/docs/grafana/latest/developers/http_api/dashboard/`},{label:`Grafana: folder HTTP API`,url:`https://grafana.com/docs/grafana/latest/developers/http_api/folder/`},{label:`Grafana: variables`,url:`https://grafana.com/docs/grafana/latest/visualizations/dashboards/variables/`}],blocks:[{concepts:[{name:`Panels`,text:"Each has a type (time series, stat, table …), a data source, one or more queries (`targets`), field settings such as the unit, and a position on a 24-column grid (`gridPos`)."},{name:`Variables`,text:"`$service` is filled from a query such as `label_values(http_requests_total, service)`; panels use it in their queries, and the dashboard gets a drop-down."},{name:`$__rate_interval`,text:"A Grafana variable for `rate()` ranges that is always at least four scrape intervals, so rates work at any zoom level."}]},{callout:"Give dashboards and data sources fixed UIDs (`shop-red`, `prometheus`). Links, alerts and provisioning refer to UIDs, and fixed ones survive re-imports and moves between instances.",tone:`tip`}],lab:{kind:`hands-on`,title:`A RED dashboard from a file`,duration:`20 min`,goal:`Write a dashboard with rate, error ratio and p95 panels and a service variable, create it through the API, and open it in Grafana.`,steps:[{title:`The dashboard`,code:{lang:`json`,file:`~/lab/dashboards/shop-red.json`,code:`{
  "folderUid": "lab",
  "overwrite": true,
  "dashboard": {
    "uid": "shop-red",
    "title": "Shop RED",
    "refresh": "30s",
    "time": { "from": "now-30m", "to": "now" },
    "templating": { "list": [{
      "name": "service", "type": "query", "label": "Service",
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "query": "label_values(http_requests_total, service)",
      "refresh": 2, "includeAll": true, "multi": true
    }] },
    "panels": [
      { "type": "timeseries", "title": "Requests per second", "gridPos": { "x": 0, "y": 0, "w": 8, "h": 8 },
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": { "defaults": { "unit": "reqps" }, "overrides": [] },
        "targets": [{ "refId": "A", "legendFormat": "{{service}}",
          "expr": "sum by (service) (rate(http_requests_total{service=~\\"$service\\"}[$__rate_interval]))" }] },
      { "type": "timeseries", "title": "Error ratio (5xx)", "gridPos": { "x": 8, "y": 0, "w": 8, "h": 8 },
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": { "defaults": { "unit": "percentunit" }, "overrides": [] },
        "targets": [{ "refId": "A", "legendFormat": "{{service}}",
          "expr": "sum by (service) (rate(http_requests_total{service=~\\"$service\\", code=~\\"5..\\"}[$__rate_interval])) / sum by (service) (rate(http_requests_total{service=~\\"$service\\"}[$__rate_interval]))" }] },
      { "type": "timeseries", "title": "Latency p95", "gridPos": { "x": 16, "y": 0, "w": 8, "h": 8 },
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": { "defaults": { "unit": "s" }, "overrides": [] },
        "targets": [{ "refId": "A", "legendFormat": "{{service}}",
          "expr": "histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket{service=~\\"$service\\"}[$__rate_interval])))" }] }
    ]
  }
}`}},{title:`Create the folder and the dashboard`,text:"On the workstation, in `~/lab`. Grafana in this lab lets anonymous users act as administrators, so no token is needed.",code:{lang:`bash`,code:`$ curl -s -X POST $GRAFANA/api/folders -H 'Content-Type: application/json' -d '{"uid": "lab", "title": "Lab"}' | jq -c '{uid, title}'
{"uid":"lab","title":"Lab"}
$ jq . dashboards/shop-red.json > /dev/null && echo "valid JSON"
valid JSON
$ curl -s -X POST $GRAFANA/api/dashboards/db -H 'Content-Type: application/json' -d @dashboards/shop-red.json | jq -c '{status, uid, url, version}'
{"status":"success","uid":"shop-red","url":"/grafana/d/shop-red/shop-red","version":1}`}},{title:`Read it back`,code:{lang:`bash`,code:`$ curl -s "$GRAFANA/api/search?query=Shop" | jq -c '.[] | {title, uid, folderTitle}'
{"title":"Shop RED","uid":"shop-red","folderTitle":"Lab"}
$ curl -s $GRAFANA/api/dashboards/uid/shop-red | jq -r '.dashboard.panels[].title'
Requests per second
Error ratio (5xx)
Latency p95
$ curl -s "$GRAFANA/api/datasources/proxy/uid/prometheus/api/v1/query?query=count(up)" | jq -r '.data.result[0].value[1]'
11`}},{title:`Open it`,text:"Open the **Grafana** link, go to **Dashboards → Lab → Shop RED**, and switch the **Service** variable between `shop`, `inventory` and All. On app, run `shopctl delay 200` for two minutes and watch the p95 panel, then `shopctl reset`."}],verify:{text:'The folder is created with uid `lab`. The dashboard API answers `status` "success" with uid `shop-red`, a URL under `/grafana/d/shop-red/` and version 1. The search finds "Shop RED" in folder Lab, the three panel titles come back, and the query through Grafana\'s data source proxy returns the same target count as Prometheus itself.'},solution:{text:'If the dashboard API reports a folder error, create the folder first. A "Dashboard not found" or version conflict is solved by `"overwrite": true`, which the file sets. Invalid JSON is the most common mistake: `jq .` shows the line.'},challenge:"Add a fourth panel of type `stat` showing `count(up == 0)` with thresholds that turn red above 0, post the file again, and look at **Dashboard settings → Versions** in the UI."},takeaways:[`Dashboards are JSON: panels, targets, gridPos and variables`,`Folders and dashboards through the HTTP API, with fixed UIDs`,`Grafana proxies queries to its data sources`]},{id:`obe-slo-alerts`,title:`SLOs and burn-rate alerts`,duration:`30 min`,summary:`An availability SLO for checkouts becomes recording rules for the error ratio over several windows and alert rules that compare those ratios with burn-rate thresholds. Injecting errors shows the fast-burn page firing within minutes, while the slower windows confirm how much budget is at stake.`,objectives:[`Record SLI error ratios over 5m, 30m, 1h and 6h windows`,`Write multiwindow burn-rate alerts for a 99.9% SLO`,`Watch a fast burn fire and resolve`],prereqs:[`obe-alertmanager`,`ob-burn-rate`],docs:[{label:`Google SRE workbook: alerting on SLOs`,url:`https://sre.google/workbook/alerting-on-slos/`},{label:`Recording rules`,url:`https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/`}],blocks:[{table:{head:[`Alert`,`Long window`,`Short window`,`Threshold (99.9% SLO)`],rows:[[`CheckoutBudgetFastBurn (page)`,`1h`,`5m`,`14.4 × 0.001 = 0.0144`],[`CheckoutBudgetSlowBurn (page)`,`6h`,`30m`,`6 × 0.001 = 0.006`]]}},{p:"The SLI is the share of `/checkout` requests to the shop that are not answered with 5xx. Windows longer than the data Prometheus has simply use what exists, so in a fresh lab the 1h and 6h ratios follow the short ones closely; in production they move slowly, which is exactly what makes the pair of windows useful."}],lab:{kind:`hands-on`,title:`Page on a fast burn`,duration:`25 min`,goal:`Record the checkout error ratio over four windows, add fast and slow burn alerts, inject 10% errors and see the fast-burn alert fire and reach the webhook.`,steps:[{title:`SLO rules`,code:{lang:`yaml`,file:`~/prometheus/rules/slo-checkout.yml`,code:`groups:
  - name: slo-checkout
    rules:
      - record: slo:checkout_errors:ratio_rate5m
        expr: sum(rate(http_requests_total{service="shop", route="/checkout", code=~"5.."}[5m])) / sum(rate(http_requests_total{service="shop", route="/checkout"}[5m]))
      - record: slo:checkout_errors:ratio_rate30m
        expr: sum(rate(http_requests_total{service="shop", route="/checkout", code=~"5.."}[30m])) / sum(rate(http_requests_total{service="shop", route="/checkout"}[30m]))
      - record: slo:checkout_errors:ratio_rate1h
        expr: sum(rate(http_requests_total{service="shop", route="/checkout", code=~"5.."}[1h])) / sum(rate(http_requests_total{service="shop", route="/checkout"}[1h]))
      - record: slo:checkout_errors:ratio_rate6h
        expr: sum(rate(http_requests_total{service="shop", route="/checkout", code=~"5.."}[6h])) / sum(rate(http_requests_total{service="shop", route="/checkout"}[6h]))
      - alert: CheckoutBudgetFastBurn
        expr: slo:checkout_errors:ratio_rate1h > (14.4 * 0.001) and slo:checkout_errors:ratio_rate5m > (14.4 * 0.001)
        labels: { severity: page, slo: checkout-availability }
        annotations:
          summary: "Checkout error budget burning fast: {{ $value | humanizePercentage }} errors over 1h (SLO 99.9%)"
      - alert: CheckoutBudgetSlowBurn
        expr: slo:checkout_errors:ratio_rate6h > (6 * 0.001) and slo:checkout_errors:ratio_rate30m > (6 * 0.001)
        labels: { severity: page, slo: checkout-availability }
        annotations:
          summary: "Checkout error budget burning: {{ $value | humanizePercentage }} errors over 6h (SLO 99.9%)"`}},{title:`Check and load`,text:`On the workstation.`,code:{lang:`bash`,code:`$ promtool check rules ~/prometheus/rules/slo-checkout.yml
Checking /home/lab/prometheus/rules/slo-checkout.yml
  SUCCESS: 6 rules found
$ curl -s -X POST $PROM/-/reload && echo reloaded
reloaded`}},{title:`Burn the budget`,code:{lang:`bash`,title:`On app`,code:`$ shopctl errors 10
faults: {"inventory_error_rate": 0.1}`}},{title:`Burn rates and the page`,code:{lang:`bash`,code:`$ sleep 120
$ for w in 5m 30m 1h 6h; do printf '%-4s burn rate ' $w; promtool query instant $PROM "slo:checkout_errors:ratio_rate$w / 0.001" | cut -d'>' -f2 | cut -d@ -f1; done
5m   burn rate  43.86839481555334
30m  burn rate  80.51072334095171
1h   burn rate  80.51072334095171
6h   burn rate  80.5107233409517
$ curl -s $PROM/api/v1/alerts | jq -r '.data.alerts[] | select(.labels.slo) | [.labels.alertname, .state] | @tsv'
CheckoutBudgetFastBurn	firing
CheckoutBudgetSlowBurn	firing
$ sleep 20
$ grep Checkout ~/alerts.log | tail -2
16:52:15 receiver=on-call FIRING CheckoutBudgetSlowBurn severity=page slo=checkout-availability | Checkout error budget burning: 7.63% errors over 6h (SLO 99.9%)
16:53:15 receiver=on-call FIRING CheckoutBudgetFastBurn severity=page slo=checkout-availability | Checkout error budget burning fast: 7.736% errors over 1h (SLO 99.9%)`}},{title:`Recover`,code:{lang:`bash`,title:`On app`,code:`$ shopctl reset
faults: {}`}}],verify:{text:"`check rules` finds 6 rules. With 10% of inventory calls failing, roughly 10% of checkouts fail, so every window shows a burn rate far above 14.4 (tens, approaching 100 as the windows fill with failing minutes; the 5m window moves fastest, and in a fresh lab the longer windows contain the same few minutes). Both burn alerts fire, and the webhook log shows FIRING lines for CheckoutBudgetFastBurn and CheckoutBudgetSlowBurn with the percentage in the summary."},solution:{text:"If the ratios are empty, there are no 5xx series for `/checkout` yet: the rules divide two sums and need both. Wait until the injected errors produce 502 answers. If alerts fire but nothing reaches `~/alerts.log`, check the `severity` label against the Alertmanager route from the previous lesson."},challenge:"After `shopctl reset`, how long does the fast-burn alert keep firing? Explain the answer from the 5m short window, then compare it with what a single 1h window alone would do."},takeaways:[`Record the SLI error ratio over each window you alert on`,`Fast burn: 14.4 over 1h and 5m; slow burn: 6 over 6h and 30m`,`The short window makes alerts stop soon after recovery`]}]};export{e as default};