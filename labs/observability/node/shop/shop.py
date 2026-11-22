#!/usr/bin/env python3
"""A small shop for the Observability lab: two services that are instrumented by hand.

    shop.py shop       port 8080: GET /, GET /checkout?item=<name>  (calls inventory, then "pays")
    shop.py inventory  port 8081: GET /stock?item=<name>

Both expose Prometheus metrics on /metrics, send traces with OTLP to the OpenTelemetry Collector, and write one JSON
log line per request to /var/log/shop/<service>.log with the trace and span IDs. Faults are read from
/etc/shop/faults.json on every request (see shopctl), so they can be switched on and off without a restart.
"""
import json
import logging
import os
import random
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from opentelemetry import propagate, trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

SERVICE = sys.argv[1] if len(sys.argv) > 1 else 'shop'
PORT = {'shop': 8080, 'inventory': 8081}[SERVICE]
INVENTORY = os.environ.get('INVENTORY_URL', 'http://localhost:8081')
FAULTS = '/etc/shop/faults.json'
ITEMS = ['book', 'lamp', 'mug', 'chair', 'plant']

# --- Traces: an OTLP/HTTP exporter to the collector (OTEL_EXPORTER_OTLP_ENDPOINT, default http://otel-collector:4318).
provider = TracerProvider(resource=Resource.create({'service.name': SERVICE, 'service.namespace': 'shop',
                                                     'deployment.environment': 'lab'}))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
    endpoint=os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://otel-collector:4318') + '/v1/traces')))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer('shop.py')

# --- Metrics: RED (rate, errors, duration) per route, plus a business counter.
REQUESTS = Counter('http_requests_total', 'HTTP requests handled', ['service', 'route', 'code'])
DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration', ['service', 'route'],
                     buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5))
IN_FLIGHT = Gauge('http_requests_in_flight', 'HTTP requests being handled', ['service'])
ORDERS = Counter('shop_orders_total', 'Checkouts by item and result', ['item', 'result'])

# --- Logs: one JSON object per line.
os.makedirs('/var/log/shop', exist_ok=True)
log = logging.getLogger(SERVICE)
log.setLevel(logging.INFO)
_handler = logging.FileHandler(f'/var/log/shop/{SERVICE}.log')
_handler.setFormatter(logging.Formatter('%(message)s'))
log.addHandler(_handler)


def log_json(level, msg, **fields):
    ctx = trace.get_current_span().get_span_context()
    record = {'time': time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + f'.{int(time.time() * 1000) % 1000:03d}Z',
              'level': level, 'service': SERVICE, 'msg': msg, **fields}
    if ctx.is_valid:
        record['trace_id'] = format(ctx.trace_id, '032x')
        record['span_id'] = format(ctx.span_id, '016x')
    log.log(logging.ERROR if level == 'error' else logging.WARNING if level == 'warn' else logging.INFO,
            json.dumps(record))


def faults():
    try:
        with open(FAULTS) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


class Handler(BaseHTTPRequestHandler):
    server_version = 'shop/1.0'

    def log_message(self, *args):  # the JSON log replaces the default access log
        pass

    def send(self, code, body, ctype='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/metrics':
            return self.send(200, generate_latest(), CONTENT_TYPE_LATEST)
        route = url.path if url.path in ('/', '/checkout', '/stock') else 'other'
        item = parse_qs(url.query).get('item', [random.choice(ITEMS)])[0]
        ctx = propagate.extract({k.lower(): v for k, v in self.headers.items()})  # continue the caller's trace (W3C traceparent)
        start = time.perf_counter()
        IN_FLIGHT.labels(SERVICE).inc()
        with tracer.start_as_current_span(f'GET {route}', context=ctx, kind=SpanKind.SERVER) as span:
            span.set_attribute('http.request.method', 'GET')
            span.set_attribute('url.path', url.path)
            span.set_attribute('shop.item', item)
            try:
                code, body = self.route(route, item)
            except Exception as exc:  # unexpected: report it as a 500
                span.record_exception(exc)
                code, body = 500, {'error': str(exc)}
            span.set_attribute('http.response.status_code', code)
            if code >= 500:
                span.set_status(Status(StatusCode.ERROR))
            seconds = time.perf_counter() - start
            REQUESTS.labels(SERVICE, route, str(code)).inc()
            DURATION.labels(SERVICE, route).observe(seconds)
            log_json('error' if code >= 500 else 'warn' if code >= 400 else 'info', 'request', route=route,
                     item=item, status=code, duration_ms=round(seconds * 1000, 1))
        IN_FLIGHT.labels(SERVICE).dec()
        self.send(code, body)

    def route(self, route, item):
        f = faults()
        if SERVICE == 'inventory' and route == '/stock':
            delay = f.get('inventory_delay_ms', 0) / 1000 + random.uniform(0.005, 0.03)
            with tracer.start_as_current_span('query stock table') as span:
                span.set_attribute('db.system.name', 'sqlite')
                time.sleep(delay)
            if random.random() < f.get('inventory_error_rate', 0):
                return 500, {'error': 'stock database unavailable'}
            return 200, {'item': item, 'in_stock': random.randint(0, 40)}
        if SERVICE == 'shop' and route == '/checkout':
            req = urllib.request.Request(f'{INVENTORY}/stock?item={item}')
            with tracer.start_as_current_span('GET inventory /stock', kind=SpanKind.CLIENT):
                headers = {}
                propagate.inject(headers)  # pass the trace context to inventory
                for k, v in headers.items():
                    req.add_header(k, v)
                try:
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        stock = json.load(resp)
                except (urllib.error.URLError, TimeoutError) as exc:
                    ORDERS.labels(item, 'failed').inc()
                    log_json('error', 'inventory call failed', item=item, error=str(exc))
                    return 502, {'error': 'inventory unavailable'}
            with tracer.start_as_current_span('charge payment'):
                time.sleep(random.uniform(0.01, 0.04))
            ORDERS.labels(item, 'ok').inc()
            return 200, {'item': item, 'ordered': True, 'stock_left': max(stock['in_stock'] - 1, 0)}
        if route == '/':
            return 200, {'service': SERVICE, 'items': ITEMS}
        return 404, {'error': 'not found'}


if __name__ == '__main__':
    log_json('info', f'{SERVICE} listening on port {PORT}')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
