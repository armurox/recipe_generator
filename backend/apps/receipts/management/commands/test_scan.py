import threading
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Serve a local image file via HTTP for testing receipt scanning through the API"

    def add_arguments(self, parser):
        parser.add_argument(
            "image_path",
            nargs="?",
            default="/tmp/test_receipt.jpg",
            help="Path to a local receipt image file (default: /tmp/test_receipt.jpg)",
        )
        parser.add_argument("--port", type=int, default=9999, help="Port to serve on (default: 9999)")

    def handle(self, *args, **options):
        image_path = Path(options["image_path"]).resolve()
        port = options["port"]

        if not image_path.exists():
            self.stderr.write(self.style.ERROR(f"File not found: {image_path}"))
            return

        directory = str(image_path.parent)
        filename = image_path.name
        handler = partial(SimpleHTTPRequestHandler, directory=directory)

        server = HTTPServer(("127.0.0.1", port), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        url = f"http://localhost:{port}/{filename}"

        self.stdout.write(self.style.SUCCESS(f"\nServing image at: {url}"))
        self.stdout.write("\nUse this in Swagger (POST /api/v1/receipts/scan):")
        self.stdout.write(self.style.WARNING(f'  {{"image_url": "{url}"}}\n'))
        self.stdout.write("Press Ctrl+C to stop.\n")

        try:
            thread.join()
        except KeyboardInterrupt:
            server.shutdown()
            self.stdout.write("\nStopped.")
