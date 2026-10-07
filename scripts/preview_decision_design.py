"""Read-only local frontend preview: no real API, payments, email or analytics."""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1] / "public"

class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)

    def end_headers(self):
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; form-action 'self'")
        super().end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            self.send_response(503)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": "Aperçu local : données et services désactivés."}).encode())
            return
        if path != "/" and not Path(path).suffix and (root / (path.lstrip("/") + ".html")).is_file():
            self.path = path + ".html"
        super().do_GET()

    def do_POST(self):
        self.send_error(503, "Read-only preview: external actions disabled")

if __name__ == "__main__":
    print("Local frontend preview: http://127.0.0.1:8767 (no production data)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8767), PreviewHandler).serve_forever()
