from django.utils import timezone
from ninja import Router

from apps.core.schemas import ErrorOut
from apps.users.schemas import UserOut, UserUpdateIn

# Decision: No auth= on Router — inherited from global NinjaAPI(auth=SupabaseJWTAuth())
router = Router(tags=["users"])


@router.get("/me", response={200: UserOut, 404: ErrorOut})
def get_me(request):
    """Return the authenticated user's profile.

    The user object is resolved from the JWT by SupabaseJWTAuth and attached
    to request.auth. Auto-creates a User row on first login via the auth layer.
    """
    return request.auth


@router.patch("/me", response={200: UserOut, 404: ErrorOut})
def update_me(request, payload: UserUpdateIn):
    """Partially update the authenticated user's profile.

    Only fields included in the request body are updated (PATCH semantics).
    """
    user = request.auth
    # Decision: model_dump(exclude_unset=True) skips fields the client didn't send,
    # so unchanged fields aren't overwritten with None defaults.
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    if "feedback_consent" in update_data:
        user.feedback_consent_updated_at = timezone.now()
    user.save()
    return user
