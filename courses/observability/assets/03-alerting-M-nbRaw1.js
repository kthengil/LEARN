var e={id:`obe-alerting`,track:`engineer`,order:3,title:`Alerting`,icon:`Flag`,hue:0,blurb:`Write alerting rules, make them fire by stopping an exporter and breaking the shop, then route the notifications with Alertmanager to a webhook, group them, and silence them during maintenance.`,lessons:[{id:`obe-alert-rules`,title:`Alerting rules`,duration:`25 min`,summary:"An alerting rule is a PromQL condition plus a `for` duration, labels and annotations. Prometheus evaluates it on every evaluation interval: a matching series makes the alert pending, and after `for` it fires and is sent to Alertmanager. The alerts API and the Alerts page show both states.",objectives:[`Write alerting rules with for, labels and annotations`,`Watch an alert go from inactive to pending to firing and back`,`Use templates in annotations`],prereqs:[`obe-recording-rules`],docs:[{label:`Alerting rules`,url:`https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/`},{label:`Template reference`,url:`https://prometheus.io/docs/prometheus/latest/configuration/template_reference/`}],blocks:[{diagram:`stateDiagram-v2
  [*] --> inactive
  inactive --> pending: expression returns the series
  pending --> inactive: condition gone before "for"
  pending --> firing: still true after "for"
  firing --> inactive: condition gone (resolved)`,title:`Alert states`},{callout:"Annotations can use `{{ $labels.instance }}` and `{{ $value }}`; format numbers with `humanize` or `humanizePercentage`. A summary that states the current value saves a trip to the dashboard.",tone:`tip`}],lab:{kind:`hands-on`,title:`Make alerts fire`,duration:`20 min`,goal:`Load two alerting rules, stop node_exporter on node2 to fire one of them, and inject shop errors to fire the other.`,steps:[{title:`The rules`,code:{lang:`yaml`,file:`~/prometheus/rules/alerts.yml`,code:`groups:
  - name: lab-alerts
    rules:
      - alert: InstanceDown
        expr: up == 0
        for: 1m
        labels: { severity: page }
        annotations:
          summary: "{{ $labels.job }} target {{ $labels.instance }} is down"
      - alert: ShopHighErrorRate
        expr: service:http_errors:ratio_rate1m > 0.05
        for: 1m
        labels: { severity: page }
        annotations:
          summary: "{{ $labels.service }} answers {{ $value | humanizePercentage }} of requests with 5xx"`}},{title:`Check and load`,text:`On the workstation.`,code:{lang:`bash`,code:`$ promtool check rules ~/prometheus/rules/alerts.yml
Checking /home/lab/prometheus/rules/alerts.yml
  SUCCESS: 2 rules found
$ curl -s -X POST $PROM/-/reload && echo reloaded
reloaded`}},{title:`Stop an exporter`,code:{lang:`bash`,title:`On node2`,code:`$ sudo systemctl stop node_exporter`}},{title:`Pending, then firing`,code:{lang:`bash`,code:`$ sleep 40
$ curl -s $PROM/api/v1/alerts | jq -r '.data.alerts[] | [.labels.alertname, .labels.instance, .state] | @tsv'
InstanceDown	node2:9100	pending
$ sleep 60
$ curl -s $PROM/api/v1/alerts | jq -r '.data.alerts[] | [.labels.alertname, .labels.instance, .state, .annotations.summary] | @tsv'
InstanceDown	node2:9100	firing	node target node2:9100 is down`}},{title:`Break the shop too`,code:{lang:`bash`,title:`On app`,code:`$ shopctl errors 30
faults: {"inventory_error_rate": 0.3}`}},{title:`Two alerts`,code:{lang:`bash`,code:`$ sleep 120
$ curl -s $PROM/api/v1/alerts | jq -r '.data.alerts[] | [.labels.alertname, (.labels.instance // .labels.service), .state] | @tsv' | sort
InstanceDown	node2:9100	firing
ShopHighErrorRate	inventory	firing
ShopHighErrorRate	shop	firing`}}],verify:{text:'Both rule groups load. About 40 seconds after stopping node_exporter, `InstanceDown` for node2:9100 is `pending`; after the one-minute `for`, it is `firing` with the summary "node target node2:9100 is down". With 30% inventory errors, `ShopHighErrorRate` fires for inventory and for the shop, each summary stating its current percentage.'},solution:{text:"If no alert appears, check that the rules loaded: `curl -s $PROM/api/v1/rules | jq -r '.data.groups[].name'`. ShopHighErrorRate depends on the recording rule from the previous lesson; without it the expression returns nothing. Leave node_exporter stopped and the errors on for the next lesson."},challenge:"Add a rule `ShopSlow` that fires when `service:http_request_duration_seconds:p95_1m` is above 0.25 for 2 minutes, then test it with `shopctl delay 300` (after the next lesson)."},takeaways:[`Rules: expression, for, labels, annotations with templates`,`Alerts move from pending to firing after the for duration`,`The alerts API shows the state and the rendered summary`]},{id:`obe-alertmanager`,title:`Routing, grouping and silences`,duration:`25 min`,summary:"Alertmanager decides who hears about an alert, how alerts are bundled, and when to stay quiet. A route tree matches alert labels to receivers; `group_by` bundles alerts into one notification; timings control how often notifications go out; silences mute matching alerts for a while. In the lab, a webhook receiver on the workstation writes each notification to `~/alerts.log`.",objectives:[`Configure routes, receivers and grouping`,`Read notifications delivered to a webhook`,`Create and expire silences with amtool`],prereqs:[`obe-alert-rules`],docs:[{label:`Alertmanager configuration`,url:`https://prometheus.io/docs/alerting/latest/configuration/`},{label:`amtool`,url:`https://github.com/prometheus/alertmanager#amtool`}],blocks:[{p:"The webhook receiver gets a JSON document per notification, with a group of alerts, their labels, annotations and status (`firing` or `resolved`). Real setups use the same mechanism for chat and paging integrations, or the built-in receivers for e-mail, Slack, PagerDuty and others."},{callout:`The short timings in this lab (10 seconds of group_wait) make the effects visible quickly. Production values are closer to the defaults (30 s, 5 min, 4 h) so people are not flooded.`,tone:`note`}],lab:{kind:`hands-on`,title:`Deliver, group and silence`,duration:`20 min`,goal:`Route page alerts to the webhook receiver grouped by alert name, read the notifications, silence the node alert during "maintenance", and see resolved notifications.`,steps:[{title:`The configuration`,code:{lang:`yaml`,file:`~/alertmanager/alertmanager.yml`,code:`route:
  receiver: default
  group_by: [alertname]
  group_wait: 10s
  group_interval: 1m
  repeat_interval: 1h
  routes:
    - matchers: ['severity="page"']
      receiver: on-call

receivers:
  - name: default
  - name: on-call
    webhook_configs:
      - url: http://workstation:5001/
        send_resolved: true`}},{title:`Check, load, test the route`,text:`On the workstation.`,code:{lang:`bash`,code:`$ amtool check-config ~/alertmanager/alertmanager.yml | grep -v Warning
Checking '/home/lab/alertmanager/alertmanager.yml'  SUCCESS
Found:
 - global config
 - route
 - 0 inhibit rules
 - 2 receivers
 - 0 templates
$ curl -s -X POST $AM/-/reload && echo reloaded
reloaded
$ amtool config routes test --config.file ~/alertmanager/alertmanager.yml severity=page alertname=InstanceDown
Warning: --config.file flag overrides the --alertmanager.url.
on-call
$ amtool config routes test --config.file ~/alertmanager/alertmanager.yml severity=ticket
Warning: --config.file flag overrides the --alertmanager.url.
default`}},{title:`Notifications arrive`,code:{lang:`bash`,code:`$ sleep 30
$ cat ~/alerts.log
16:46:58 receiver=on-call FIRING InstanceDown env=lab instance=node2:9100 job=node severity=page | node target node2:9100 is down
16:46:58 receiver=on-call FIRING ShopHighErrorRate service=inventory severity=page | inventory answers 33.12% of requests with 5xx
16:46:58 receiver=on-call FIRING ShopHighErrorRate service=shop severity=page | shop answers 25.26% of requests with 5xx
$ amtool alert query 2>/dev/null
Alertname          Starts At                Summary                                        State
InstanceDown       2026-11-01 16:43:34 UTC  node target node2:9100 is down                 active
ShopHighErrorRate  2026-11-01 16:45:34 UTC  shop answers 25.26% of requests with 5xx       active
ShopHighErrorRate  2026-11-01 16:45:34 UTC  inventory answers 33.12% of requests with 5xx  active`}},{title:`Silence the node alert`,text:`node2 is "in maintenance": mute its alert for 30 minutes.`,code:{lang:`bash`,code:`$ amtool silence add instance=node2:9100 --duration=30m --comment="node2 maintenance" --author=lab 2>/dev/null > silence-id.txt
$ amtool silence query 2>/dev/null
ID                                    Matchers               Ends At                  Created By  Comment
de2ab9b7-c26a-4c89-ab5f-5067637099e5  instance="node2:9100"  2026-11-01 17:17:28 UTC  lab         node2 maintenance
$ amtool alert query 2>/dev/null
Alertname          Starts At                Summary                                        State
ShopHighErrorRate  2026-11-01 16:45:34 UTC  shop answers 25.26% of requests with 5xx       active
ShopHighErrorRate  2026-11-01 16:45:34 UTC  inventory answers 33.12% of requests with 5xx  active`}},{title:`Fix both problems`,code:{lang:`bash`,title:`On app`,code:`$ shopctl reset
faults: {}`}},{title:`Start the exporter again`,code:{lang:`bash`,title:`On node2`,code:`$ sudo systemctl start node_exporter`}},{title:`Resolved notifications`,code:{lang:`bash`,code:`$ sleep 150
$ tail -3 ~/alerts.log
16:46:58 receiver=on-call FIRING ShopHighErrorRate service=shop severity=page | shop answers 25.26% of requests with 5xx
16:48:58 receiver=on-call RESOLVED ShopHighErrorRate service=inventory severity=page | inventory answers 5.844% of requests with 5xx
16:48:58 receiver=on-call RESOLVED ShopHighErrorRate service=shop severity=page | shop answers 6.806% of requests with 5xx
$ amtool silence expire $(cat silence-id.txt) 2>/dev/null && amtool silence query 2>/dev/null | wc -l
1`}}],verify:{text:"The route test sends `severity=page` to `on-call` and anything else to `default`. `~/alerts.log` shows FIRING lines for InstanceDown (node2) and ShopHighErrorRate (inventory and shop) from the on-call receiver. After the silence, `amtool alert query` no longer lists the node2 alert. Once both problems are fixed, RESOLVED lines arrive for the shop alerts; the silenced node alert resolves quietly. Expiring the silence leaves only the header line in the silence list."},solution:{text:"If `~/alerts.log` stays empty, check that the receiver runs (`pgrep -af alert-receiver` on the workstation) and that Alertmanager accepted the new configuration (`curl -s $AM/api/v2/status | jq .config.original | head`). amtool reads the Alertmanager address from `/etc/amtool/config.yml` on the workstation."},challenge:"Add an inhibition rule so that while any `InstanceDown` alert fires for `app:9100`, `ShopHighErrorRate` alerts are suppressed. Which label do the two alerts need to share for `equal:` to work, and do they?"},takeaways:[`Routes match labels to receivers; group_by bundles notifications`,`amtool tests routes, queries alerts and manages silences`,`Webhooks receive firing and resolved notifications as JSON`]}]};export{e as default};