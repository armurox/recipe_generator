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
        parser.add_argument(
            "--exp",
            type=int,
            default=None,
            help="Token expiry in seconds from now (default: no expiry)",
        )

    def handle(self, *args, **options):
        import time

        payload = {
            "sub": options["user_id"],
            "email": options["email"],
            "aud": "authenticated",
            "iat": int(time.time()),
        }
        if options["exp"]:
            payload["exp"] = int(time.time()) + options["exp"]

        if not settings.SUPABASE_JWT_SECRET:
            self.stderr.write(self.style.ERROR("SUPABASE_JWT_SECRET is not set. Cannot generate token."))
            return

        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        self.stdout.write(self.style.SUCCESS("\nTest JWT token (HS256):\n"))
        self.stdout.write(f"{token}\n")
        self.stdout.write(f"\nUser ID:   {options['user_id']}")
        self.stdout.write(f"Email:     {options['email']}")
        self.stdout.write("Algorithm: HS256 (verified via legacy secret fallback)")
        if options["exp"]:
            self.stdout.write(f"Expires:   {options['exp']}s from now")
        else:
            self.stdout.write("Expires:   never")
        self.stdout.write("\nPaste into Swagger Authorize or use with: curl -H 'Authorization: Bearer <token>'\n")
