#!/usr/bin/env python3
"""
Server uji lokal: menyajikan folder site/ dan meniru API Apps Script (save, summary, list) di /api.
Hanya untuk menguji prototipe. Data disimpan di memori.

  python3 mock_server.py <folder_site> [port]
"""
import json, sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

SITE = os.path.abspath(sys.argv[1]); PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
KEY, PIN = "kunci-uji", "1234"
ROWS = []  # (id, attempt)
DOWN = {"v": False}

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=SITE, **k)
    def log_message(self, *a): pass
    def send_json(self, o):
        b = json.dumps(o).encode(); self.send_response(200)
        self.send_header("Content-Type", "application/json"); self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/_down": DOWN["v"] = parse_qs(u.query).get("v", ["1"])[0] == "1"; return self.send_json({"ok": True})
        if u.path == "/_rows": return self.send_json({"ok": True, "rows": [[i, a.get("paketId"), a.get("percobaanKe"), a.get("nilai")] for i, a in ROWS]})
        if u.path == "/api":
            if DOWN["v"]: self.send_response(503); self.end_headers(); return
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            if q.get("action") == "summary":
                if q.get("key") != KEY: return self.send_json({"ok": False, "error": "key"})
                s = {}
                for i, a in ROWS:
                    x = s.setdefault(a["paketId"], {"n": 0, "best": 0, "last": None}); x["n"] += 1; x["best"] = max(x["best"], a["nilai"]); x["last"] = a["nilai"]
                return self.send_json({"ok": True, "summary": s})
            return self.send_json({"ok": False, "error": "action"})
        return super().do_GET()
    def do_POST(self):
        if DOWN["v"]: self.send_response(503); self.end_headers(); return
        b = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if b.get("action") == "save":
            if b.get("key") != KEY: return self.send_json({"ok": False, "error": "key"})
            for i, a in ROWS:
                if i == b["id"]: return self.send_json({"ok": True, "duplikat": True, "percobaanKe": a["percobaanKe"]})
            a = b["attempt"]; a["percobaanKe"] = sum(1 for _, x in ROWS if x["paketId"] == a["paketId"]) + 1
            ROWS.append((b["id"], a)); return self.send_json({"ok": True, "percobaanKe": a["percobaanKe"]})
        if b.get("action") == "list":
            if b.get("pin") != PIN: return self.send_json({"ok": False, "error": "pin"})
            return self.send_json({"ok": True, "attempts": [dict(a, _id=i) for i, a in ROWS]})
        return self.send_json({"ok": False, "error": "action"})

ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
