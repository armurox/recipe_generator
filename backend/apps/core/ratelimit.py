import logging

from django.core.cache import cache
from ninja.errors import HttpError

logger = logging.getLogger(__name__)


def check_rate_limit(key: str, max_calls: int, period: int) -> None:
    """Check rate limit using Django's cache framework.

    Uses a simple counter per key. Each call increments the counter; if it
    exceeds max_calls within the period, raises HttpError(429).

    Note: with LocMemCache (default), rate limiting is per-worker. Upgrade
    to Redis cache for shared state across multiple gunicorn workers.
    """
    cache_key = f"ratelimit:{key}"
    current = cache.get(cache_key, 0)
    if current >= max_calls:
        logger.warning("[check_rate_limit] key=%s exceeded (%d/%d)", key, current, max_calls)
        raise HttpError(429, "Rate limit exceeded. Please try again later.")
    cache.set(cache_key, current + 1, timeout=period)
