import asyncio
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from arq.connections import RedisSettings

from .config import settings
from .tasks import process_item, shutdown, startup


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args: object) -> None:
        pass


def run_health_server() -> None:
    server = HTTPServer(("0.0.0.0", settings.health_port), HealthHandler)
    server.serve_forever()


class WorkerSettings:
    functions = [process_item]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = settings.worker_concurrency


def main() -> None:
    t = threading.Thread(target=run_health_server, daemon=True)
    t.start()

    from arq import run_worker

    run_worker(WorkerSettings)


if __name__ == "__main__":
    main()
