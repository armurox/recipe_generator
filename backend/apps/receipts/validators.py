import logging
import posixpath
from urllib.parse import urlparse

from django.conf import settings
from ninja.errors import HttpError

logger = logging.getLogger(__name__)


def validate_image_url(url: str) -> None:
    """Validate image URL points to Supabase Storage (SSRF protection).

    Checks:
    1. HTTPS scheme required
    2. Hostname must match SUPABASE_URL (when configured)
    3. Path must start with /storage/ (after normalization to prevent traversal)
    """
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise HttpError(400, "Image URL must use HTTPS")

    if settings.SUPABASE_URL:
        expected_host = urlparse(settings.SUPABASE_URL).hostname
        if parsed.hostname != expected_host:
            logger.warning(
                "[validate_image_url] rejected host=%s (expected=%s)",
                parsed.hostname,
                expected_host,
            )
            raise HttpError(400, "Image URL must be from Supabase Storage")

    # Normalize path to prevent traversal attacks (e.g. /storage/../../internal)
    normalized_path = posixpath.normpath(parsed.path)
    if not normalized_path.startswith("/storage/"):
        raise HttpError(400, "Image URL must point to Supabase Storage")
