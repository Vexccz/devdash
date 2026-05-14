from fastapi import APIRouter, Depends
from ..middleware.auth import get_current_user
from ..schemas import UserResponse
from ..models.user import User

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user
