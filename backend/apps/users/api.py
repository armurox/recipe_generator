from ninja import Router

from apps.users.auth import SupabaseJWTAuth
from apps.users.schemas import UserOut, UserUpdateIn

router = Router(auth=SupabaseJWTAuth(), tags=["users"])


@router.get("/me", response=UserOut)
def get_me(request):
    return request.auth


@router.patch("/me", response=UserOut)
def update_me(request, payload: UserUpdateIn):
    user = request.auth
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(user, field, value)
    user.save()
    return user
