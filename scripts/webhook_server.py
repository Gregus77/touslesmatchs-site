
import http.server, json, os
TOKEN = os.environ.get("HERMES_ADMIN_TLM_BOT", "")
OUTPUT = "/tmp/hermes_telegram_directive.txt"
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length",0)))
        data = json.loads(body)
        msg = data.get("message", data.get("channel_post", {}))
        chat = msg.get("chat", {})
        frm = msg.get("from", {})
        if str(chat.get("id")) == "-1003818884997" and frm.get("id") == 309921562:
            with open(OUTPUT, "w") as f:
                json.dump({"from":"telegram","text":msg.get("text","")}, f)
        self.send_response(200); self.end_headers(); self.wfile.write(b"OK")
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b"OK")
http.server.HTTPServer(("0.0.0.0", 8888), H).serve_forever()

