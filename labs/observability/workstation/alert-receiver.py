#!/usr/bin/env python3
"""A webhook receiver for Alertmanager on workstation:5001: appends one summary line per alert to ~/alerts.log."""
import json
import os
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG = os.path.expanduser('~/alerts.log')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        now = time.strftime('%H:%M:%S')
        with open(LOG, 'a') as f:
            for a in body.get('alerts', []):
                labels = a.get('labels', {})
                extra = ' '.join(f'{k}={v}' for k, v in sorted(labels.items()) if k != 'alertname')
                f.write(f"{now} receiver={body.get('receiver')} {a.get('status', '?').upper()} "
                        f"{labels.get('alertname', '?')} {extra} | {a.get('annotations', {}).get('summary', '')}\n")
        self.send_response(200)
        self.end_headers()


HTTPServer(('0.0.0.0', 5001), Handler).serve_forever()
