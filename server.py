from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent)
class Handler(SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Cache-Control','no-cache')
  self.send_header('X-Content-Type-Options','nosniff')
  super().end_headers()
print('Local: http://127.0.0.1:8768',flush=True)
ThreadingHTTPServer(('127.0.0.1',8768),Handler).serve_forever()
