import http.server
import socketserver
import webbrowser
import threading
import sys

PORT = 8000

while True:
    try:
        Handler = http.server.SimpleHTTPRequestHandler
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"Local server started successfully at http://localhost:{PORT}")
            
            # Start a timer to open the browser 1 second after starting the server
            url = f"http://localhost:{PORT}/index.html"
            threading.Timer(1.0, lambda: webbrowser.open(url)).start()
            
            # Keep serving requests
            httpd.serve_forever()
    except OSError:
        PORT += 1
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
