var e={id:`obe-promql`,track:`engineer`,order:2,title:`PromQL and rules`,icon:`Search`,hue:20,blurb:`Query Prometheus with selectors, rates and aggregations, measure the shop with RED metrics and histogram percentiles while injecting faults, and turn the queries into recording rules with unit tests.`,lessons:[{id:`obe-promql-basics`,title:`PromQL basics`,duration:`25 min`,summary:"PromQL selects series by metric name and label matchers, turns counters into per-second rates with `rate()` over a range, and aggregates with `sum`, `avg`, `max` and `topk` by chosen labels. `promtool query` runs queries from the terminal; the Prometheus UI and Grafana run the same language.",objectives:[`Select series with label matchers`,`Use rate() on counters and aggregate by labels`,`Run instant and range queries from the command line`],prereqs:[`obe-scraping`],docs:[{label:`PromQL basics`,url:`https://prometheus.io/docs/prometheus/latest/querying/basics/`},{label:`PromQL functions`,url:`https://prometheus.io/docs/prometheus/latest/querying/functions/`},{label:`PromQL operators and aggregation`,url:`https://prometheus.io/docs/prometheus/latest/querying/operators/`}],blocks:[{table:{head:[`Expression`,`Meaning`],rows:[['`up{job="node"}`',`Instant vector: the latest value of each matching series`],['`http_requests_total{code=~"5.."}`',`Regular-expression matcher: every 5xx status`],["`rate(http_requests_total[1m])`",`Per-second rate of increase over the last minute, per series`],["`sum by (route) (…)`","Add series together, keeping only the `route` label"],["`topk(3, …)`",`The three series with the highest values`]]}},{p:"`rate()` needs a range at least a few scrape intervals long (with a 15 s interval, `[1m]` is the practical minimum) and handles counter resets. Always take the rate first and aggregate second: `sum(rate(x[5m]))`, never `rate(sum(x)[5m])`."},{callout:`Machines in this lab are containers, so node_exporter reports some host-wide values (for example total memory) that are the same on every node. On real machines each node reports its own.`,tone:`note`}],lab:{kind:`hands-on`,title:`Query the nodes and the shop`,duration:`20 min`,goal:`Run instant and range queries for target health, CPU and the shop's request rates, from the command line.`,steps:[{title:`Selectors`,text:`On the workstation.`,code:{lang:`bash`,code:`$ promtool query instant $PROM 'up{job="node"}'
up{env="lab", instance="node2:9100", job="node"} => 1 @[1793550959.643]
up{env="lab", instance="node1:9100", job="node"} => 1 @[1793550959.643]
up{env="lab", instance="app:9100", job="node"} => 1 @[1793550959.643]
$ promtool query instant $PROM 'count(up == 1)'
{} => 11 @[1793550959.674]
$ promtool query instant $PROM 'node_os_info{instance="node1:9100"}'
node_os_info{env="lab", id="rocky", id_like="rhel centos fedora", instance="node1:9100", job="node", name="Rocky Linux", pretty_name="Rocky Linux 9.8 (Blue Onyx)", version="9.8 (Blue Onyx)", version_id="9.8"} => 1 @[1793550959.703]`}},{title:`Rates and aggregation`,code:{lang:`bash`,code:`$ promtool query instant $PROM 'sum by (instance) (rate(node_cpu_seconds_total{mode!="idle"}[1m]))'
{instance="node2:9100"} => 0.36466666666666997 @[1793550959.736]
{instance="node1:9100"} => 0.37199999999999284 @[1793550959.736]
{instance="app:9100"} => 0.39511111111110314 @[1793550959.736]
$ promtool query instant $PROM 'sum by (service, route) (rate(http_requests_total[1m]))'
{route="/checkout", service="shop"} => 3.4222222222222216 @[1793550959.765]
{route="/", service="shop"} => 0.8444444444444443 @[1793550959.765]
{route="/stock", service="inventory"} => 3.355555555555555 @[1793550959.765]
$ promtool query instant $PROM 'topk(3, sum by (item) (increase(shop_orders_total[5m])))'
{item="plant"} => 63.35286666666667 @[1793550959.794]
{item="mug"} => 59.30906666666667 @[1793550959.794]
{item="chair"} => 57.961133333333336 @[1793550959.794]`}},{title:`A range query`,text:`The checkout rate over the last five minutes, one point per minute.`,code:{lang:`bash`,code:`$ promtool query range --start=$(( $(date +%s) - 300 )) --end=$(date +%s) --step=1m $PROM 'sum(rate(http_requests_total{route="/checkout"}[1m]))'
{} =>
3.4222222222222216 @[1793550959]`}},{title:`The same in the UI`,text:'Open the **Prometheus** link, type `sum by (route) (rate(http_requests_total{service="shop"}[1m]))` into the query box, and switch between **Table** and **Graph**.'}],verify:{text:"Three node targets report `up` 1, eleven targets are up in total, and node1 reports Rocky Linux 9 in `node_os_info`. The shop serves several requests per second on `/checkout` and fewer on `/`, inventory handles one `/stock` request per checkout, and the five items share the orders. The range query returns six points."},solution:{text:"An empty result usually means a typo in a label value: run the selector without the matcher (`http_requests_total`) to see the real labels. Quote the whole expression in single quotes so the shell leaves the braces and double quotes alone."},challenge:"Write a query for the share of checkouts that are for books, as a fraction between 0 and 1, using two `sum` expressions divided by each other."},takeaways:[`Matchers select series; rate() turns counters into per-second rates`,`Rate first, then aggregate by the labels you need`,`promtool query instant and range work against any Prometheus`]},{id:`obe-red`,title:`RED metrics and percentiles`,duration:`30 min`,summary:"Rate, errors and duration describe each service. The error ratio is 5xx requests divided by all requests; latency percentiles come from histogram buckets with `histogram_quantile()`. With `shopctl` you inject errors and slowness into the inventory service and watch the numbers react, including in the shop that depends on it.",objectives:[`Compute request rate and error ratio per service`,`Compute the 95th percentile latency from histogram buckets`,`Follow an injected fault from inventory to the shop`],prereqs:[`obe-promql-basics`],docs:[{label:`histogram_quantile()`,url:`https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile`},{label:`Histograms and summaries`,url:`https://prometheus.io/docs/practices/histograms/`}],blocks:[{code:`# Rate
sum by (service) (rate(http_requests_total[1m]))
# Errors: the share of requests answered with 5xx
sum by (service) (rate(http_requests_total{code=~"5.."}[1m]))
  / sum by (service) (rate(http_requests_total[1m]))
# Duration: 95th percentile per service, from the buckets
histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket[1m])))`,lang:`text`,title:`RED in PromQL`},{p:"`histogram_quantile()` estimates a percentile by assuming observations are spread evenly inside a bucket, so the result is only as precise as the bucket boundaries around it. The shop's buckets are 10, 25, 50, 100, 250 and 500 ms and 1 and 2.5 s."},{callout:"Keep `le` in the `by` clause when aggregating buckets: without it, histogram_quantile has nothing to work with and returns nothing.",tone:`warn`}],lab:{kind:`hands-on`,title:`Break the inventory and watch RED`,duration:`25 min`,goal:`Measure rate, error ratio and p95 latency, inject errors and then delay into inventory, and see how the shop is affected.`,steps:[{title:`A healthy baseline`,text:`On the workstation.`,code:{lang:`bash`,code:`$ promtool query instant $PROM 'sum by (service) (rate(http_requests_total[1m]))'
{service="shop"} => 4.199999999999999 @[1793551020.048]
{service="inventory"} => 3.1777777777777776 @[1793551020.048]
$ promtool query instant $PROM 'histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket[1m])))'
{service="shop"} => 0.09073529411764707 @[1793551020.076]
{service="inventory"} => 0.04337962962962963 @[1793551020.076]`}},{title:`Inject errors`,text:`On app: inventory now fails 20% of stock requests, and the shop answers those checkouts with 502.`,code:{lang:`bash`,title:`On app`,code:`$ shopctl errors 20
faults: {"inventory_error_rate": 0.2}`}},{title:`Error ratio`,text:`On the workstation, after a minute.`,code:{lang:`bash`,code:`$ sleep 75
$ promtool query instant $PROM 'sum by (service) (rate(http_requests_total{code=~"5.."}[1m])) / sum by (service) (rate(http_requests_total[1m]))'
{service="inventory"} => 0.16901408450704225 @[1793551095.508]
{service="shop"} => 0.13333333333333333 @[1793551095.508]
$ promtool query instant $PROM 'sum by (service, code) (rate(http_requests_total{route=~"/checkout|/stock"}[1m]))'
{code="200", service="shop"} => 2.533333333333333 @[1793551095.538]
{code="200", service="inventory"} => 2.622222222222222 @[1793551095.538]
{code="500", service="inventory"} => 0.5333333333333332 @[1793551095.538]
{code="502", service="shop"} => 0.5777777777777777 @[1793551095.538]`}},{title:`Inject delay instead`,code:{lang:`bash`,title:`On app`,code:`$ shopctl reset
faults: {}
$ shopctl delay 300
faults: {"inventory_delay_ms": 300}`}},{title:`Latency`,code:{lang:`bash`,code:`$ sleep 75
$ promtool query instant $PROM 'histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket[1m])))'
{service="inventory"} => 0.4875 @[1793551170.97]
{service="shop"} => 0.48445945945945945 @[1793551170.97]`}},{title:`Back to normal`,code:{lang:`bash`,title:`On app`,code:`$ shopctl reset
faults: {}`}}],verify:{text:"At baseline both services serve requests without 5xx answers, with p95 latencies of tens of milliseconds. With 20% errors, the error ratio of inventory and of the shop rises to roughly 0.2 of the requests that call inventory (the shop's overall ratio is lower because its `/` route never fails), and the codes split into 200 and 500 for inventory and 200 and 502 for the shop. With 300 ms delay, both p95 latencies rise above 0.3 s, because every checkout waits for inventory."},solution:{text:"If the ratio is still 0, the one-minute rate window has not filled yet: wait another half minute. `shopctl status` on app shows the active faults. If a query returns no data, check that the shop job is up in the targets API."},challenge:'Compute the share of shop requests faster than 100 ms using the `le="0.1"` bucket divided by the `_count` series. This is the latency SLI you will use for SLOs later.'},takeaways:[`Error ratio = 5xx rate ÷ total rate, per service`,`histogram_quantile over rated buckets, keeping le`,`Faults in a dependency show up in its callers`]},{id:`obe-recording-rules`,title:`Recording rules and rule tests`,duration:`25 min`,summary:"Recording rules evaluate expressions on a schedule and store the result as a new series, so dashboards and alerts read a cheap precomputed value. Rule files are checked with `promtool check rules` and unit-tested with `promtool test rules`, which feeds synthetic series through the rules and compares the results with expectations.",objectives:[`Write recording rules with the level:metric:operations naming convention`,`Check and unit-test rule files with promtool`,`Load the rules and query the recorded series`],prereqs:[`obe-red`],docs:[{label:`Recording rules`,url:`https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/`},{label:`Unit testing rules`,url:`https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/`},{label:`Rule naming`,url:`https://prometheus.io/docs/practices/rules/`}],blocks:[{p:"The naming convention `level:metric:operations` says which labels remain (level), what was measured (metric) and what was done to it (operations), for example `service:http_requests:rate1m` for the per-service request rate over one minute."},{callout:"Rule tests run entirely inside promtool with series you define, so they are fast and deterministic. Run them in CI for every change to rule files, together with `promtool check rules`.",tone:`tip`}],lab:{kind:`hands-on`,title:`Record RED per service and test it`,duration:`20 min`,goal:`Write recording rules for the shop's RED metrics, unit-test the error ratio rule, load the rules and query the results.`,steps:[{title:`The rule file`,code:{lang:`yaml`,file:`~/prometheus/rules/shop-recording.yml`,code:`groups:
  - name: shop-red
    interval: 15s
    rules:
      - record: service:http_requests:rate1m
        expr: sum by (service) (rate(http_requests_total[1m]))
      - record: service:http_errors:ratio_rate1m
        expr: |
          sum by (service) (rate(http_requests_total{code=~"5.."}[1m]))
            / sum by (service) (rate(http_requests_total[1m]))
      - record: service:http_request_duration_seconds:p95_1m
        expr: histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket[1m])))`}},{title:`A unit test`,text:`Two services over five minutes: inventory gets 6 requests per minute of which 1 fails, the shop 6 per minute without errors.`,code:{lang:`yaml`,file:`~/lab/tests/shop-recording-test.yml`,code:`rule_files:
  - /home/lab/prometheus/rules/shop-recording.yml
evaluation_interval: 15s
tests:
  - interval: 15s
    input_series:
      - series: 'http_requests_total{service="inventory", code="200"}'
        values: '0+1.25x20'
      - series: 'http_requests_total{service="inventory", code="500"}'
        values: '0+0.25x20'
      - series: 'http_requests_total{service="shop", code="200"}'
        values: '0+1.5x20'
    promql_expr_test:
      - expr: service:http_errors:ratio_rate1m
        eval_time: 5m
        exp_samples:
          - labels: 'service:http_errors:ratio_rate1m{service="inventory"}'
            value: 0.16666666666666669`}},{title:`Check, test, load`,text:"On the workstation, in `~/lab`.",code:{lang:`bash`,code:`$ promtool check rules ~/prometheus/rules/shop-recording.yml
Checking /home/lab/prometheus/rules/shop-recording.yml
  SUCCESS: 3 rules found
$ promtool test rules tests/shop-recording-test.yml
Unit Testing:  tests/shop-recording-test.yml
  SUCCESS
$ curl -s -X POST $PROM/-/reload && echo reloaded
reloaded
$ sleep 45`}},{title:`Query the recorded series`,code:{lang:`bash`,code:`$ curl -s $PROM/api/v1/rules | jq -r '.data.groups[] | .name as $g | .rules[] | "\\($g) \\(.name) \\(.health)"'
shop-red service:http_requests:rate1m ok
shop-red service:http_errors:ratio_rate1m ok
shop-red service:http_request_duration_seconds:p95_1m ok
$ promtool query instant $PROM 'service:http_requests:rate1m'
service:http_requests:rate1m{service="shop"} => 4.355555555555555 @[1793551276.737]
service:http_requests:rate1m{service="inventory"} => 3.5777777777777775 @[1793551276.737]
$ promtool query instant $PROM 'service:http_request_duration_seconds:p95_1m'
service:http_request_duration_seconds:p95_1m{service="shop"} => 0.0891111111111111 @[1793551276.765]
service:http_request_duration_seconds:p95_1m{service="inventory"} => 0.044560810810810814 @[1793551276.765]`}}],verify:{text:"`check rules` finds 3 rules, and the unit test passes: per 15 s, inventory's counters grow by 1.25 and 0.25, so 0.25 of 1.5 requests, that is 1 in 6, are errors (promtool compares exactly, so the expected value is written as the floating-point result 0.16666666666666669). The shop has no 5xx series in the test input, so the division has nothing to match and the shop gets no ratio at all, which is why the test expects only inventory. After the reload the three rules are `ok`, and the recorded series exist per service."},solution:{text:'If the test reports "expected … but got", print the actual result: change the expectation or add `eval_time` points step by step. A rule that shows health `err` in the rules API has a `lastError` field explaining why.'},challenge:"Break the test on purpose: change the expected inventory value to 0.2 and read promtool's failure message. Then add a test for `service:http_requests:rate1m`."},takeaways:[`Recording rules precompute expensive queries as new series`,`level:metric:operations names say what a series contains`,`promtool check rules and test rules belong in CI`]}]};export{e as default};