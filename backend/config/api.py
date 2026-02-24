from ninja import NinjaAPI

from apps.users.api import router as users_router

api = NinjaAPI(
    title="PantryChef API",
    version="1.0.0",
    urls_namespace="api",
)


@api.get("/health", auth=None)
def health(request):
    return {"status": "ok"}


api.add_router("/", users_router)
