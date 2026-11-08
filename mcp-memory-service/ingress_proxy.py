#!/usr/bin/env python3
"""Small reverse proxy that makes the upstream dashboard usable behind Home Assistant ingress.

- Accepts connections only from the ingress gateway (and loopback for tests).
- Adds the API key as bearer token, so the dashboard works without a second login.
- Sets <base href> of the dashboard to the ingress prefix (X-Ingress-Path); upstream uses relative URLs.
- Allows framing by Home Assistant (frame-ancestors 'self'), because ingress shows the page in an iframe.
"""
import http.client
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN_PORT = int(os.environ.get("INGRESS_PORT", "8099"))
UPSTREAM_HOST = os.environ.get("INGRESS_UPSTREAM_HOST", "127.0.0.1")
UPSTREAM_PORT = int(os.environ.get("INGRESS_UPSTREAM_PORT", "8000"))
ALLOWED = {a.strip() for a in os.environ.get("INGRESS_ALLOWED", "172.30.32.2,127.0.0.1").split(",") if a.strip()}
API_KEY = os.environ.get("MCP_API_KEY", "")

REWRITE_TYPES = ("text/html",)
HOP_BY_HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
              "trailers", "transfer-encoding", "upgrade", "content-length", "content-encoding"}

# Upstream serves the dashboard with <base href="/"> and relative URLs.
BASE_HREF = re.compile(r"""(<base\s+href=["'])/(["'])""", re.IGNORECASE)
FRAME_ANCESTORS = re.compile(r"frame-ancestors[^;]*", re.IGNORECASE)


def frame_ok(csp: str) -> str:
    """Home Assistant shows ingress pages in an iframe of the same origin."""
    if FRAME_ANCESTORS.search(csp):
        return FRAME_ANCESTORS.sub("frame-ancestors 'self'", csp)
    return csp


def rewrite(body: bytes, prefix: str) -> bytes:
    text = body.decode("utf-8", errors="replace")
    text = BASE_HREF.sub(lambda m: f"{m.group(1)}{prefix}/{m.group(2)}", text)
    return text.encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ingress-proxy"

    def log_message(self, fmt, *args):  # keep the add-on log quiet
        pass

    def _proxy(self):
        if self.client_address[0] not in ALLOWED:
            self.send_error(403, "Only reachable through Home Assistant")
            return
        prefix = self.headers.get("X-Ingress-Path", "").rstrip("/")
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in HOP_BY_HOP | {"host", "accept-encoding", "authorization", "x-ingress-path"}}
        headers["Accept-Encoding"] = "identity"
        headers["Host"] = f"{UPSTREAM_HOST}:{UPSTREAM_PORT}"
        if API_KEY:
            headers["Authorization"] = f"Bearer {API_KEY}"
        if body is not None:
            headers["Content-Length"] = str(len(body))
        conn = http.client.HTTPConnection(UPSTREAM_HOST, UPSTREAM_PORT, timeout=120)
        try:
            conn.request(self.command, self.path, body=body, headers=headers)
            resp = conn.getresponse()
        except OSError as exc:
            self.send_error(502, f"Dashboard not reachable: {exc}")
            conn.close()
            return
        ctype = (resp.getheader("Content-Type") or "").lower()
        out_headers = [(k, frame_ok(v) if k.lower() == "content-security-policy" else v)
                       for k, v in resp.getheaders()
                       if k.lower() not in HOP_BY_HOP and k.lower() != "x-frame-options"]
        if prefix:
            out_headers = [(k, (prefix + v) if k.lower() == "location" and v.startswith("/") else v)
                           for k, v in out_headers]
        if "text/event-stream" in ctype:
            self.send_response(resp.status)
            for k, v in out_headers:
                self.send_header(k, v)
            self.send_header("Connection", "close")
            self.end_headers()
            try:
                while chunk := resp.read1(4096):
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except (OSError, http.client.HTTPException):
                pass
            self.close_connection = True
            conn.close()
            return
        data = resp.read()
        if prefix and any(t in ctype for t in REWRITE_TYPES):
            data = rewrite(data, prefix)
        self.send_response(resp.status)
        for k, v in out_headers:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        conn.close()

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = do_OPTIONS = _proxy


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", LISTEN_PORT), Handler)
    print(f"[INFO] Ingress proxy on :{LISTEN_PORT} -> {UPSTREAM_HOST}:{UPSTREAM_PORT}", file=sys.stderr, flush=True)
    server.serve_forever()
