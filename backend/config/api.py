import logging

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from ninja import NinjaAPI

from apps.receipts.api import router as receipts_router
from apps.users.api import router as users_router
from apps.users.auth import SupabaseJWTAuth

logger = logging.getLogger(__name__)

api = NinjaAPI(
    title="PantryChef API",
    version="1.0.0",
    urls_namespace="api",
    auth=SupabaseJWTAuth(),
)


@api.exception_handler(ObjectDoesNotExist)
def object_not_found(request, exc):
    logger.warning("[object_not_found] %s %s: %s", request.method, request.path, exc)
    return api.create_response(request, {"detail": "Not found"}, status=404)


@api.exception_handler(ValidationError)
def validation_error(request, exc):
    logger.warning("[validation_error] %s %s: %s", request.method, request.path, exc)
    return api.create_response(request, {"detail": exc.messages if hasattr(exc, "messages") else str(exc)}, status=422)


@api.get("/health", auth=None)
def health(request):
    """Health check endpoint for monitoring and load balancers."""
    return {"status": "ok"}


api.add_router("/", users_router)
api.add_router("/receipts", receipts_router)
