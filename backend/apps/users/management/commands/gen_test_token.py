import jwt
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Generate a test JWT token for Swagger / curl authentication"

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-id",
            default="00000000-0000-0000-0000-000000000001",
            help="UUID for the test user (default: 00000000-...-000001)",
        )
        parser.add_argument(
            "--email",
            default="test@example.com",
            help="Email for the test user (default: test@example.com)",
        )

    def handle(self, *args, **options):
        payload = {
            "sub": options["user_id"],
            "email": options["email"],
            "aud": "authenticated",
        }
        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        self.stdout.write(self.style.SUCCESS("\nTest JWT token:\n"))
        self.stdout.write(f"{token}\n")
        self.stdout.write(f"\nUser ID: {options['user_id']}")
        self.stdout.write(f"Email:   {options['email']}")
        self.stdout.write("\nPaste into Swagger Authorize or use with: curl -H 'Authorization: Bearer <token>'\n")
