"""Read-only preview of the canonical site. Never forwards API calls."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / 'public'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith('/api/'):
            self.send_error(503, 'Local preview: API disabled')
            return
        if path != '/' and not Path(path).suffix and (ROOT / (path.lstrip('/') + '.html')).is_file():
            self.path = path + '.html'
        super().do_GET()

    def do_POST(self):
        self.send_error(503, 'Local preview: writes disabled')

if __name__ == '__main__':
    print('Read-only preview: http://127.0.0.1:8770', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8770), Handler).serve_forever()
