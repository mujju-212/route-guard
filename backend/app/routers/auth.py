from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLogin, UserRegister, UserResponse
from app.services.auth_service import authenticate_user, register_user

router = APIRouter()


@router.post('/register', response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
	return register_user(db, user_data)


@router.post('/login', response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
	return authenticate_user(db, credentials)


@router.get('/me', response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
	return UserResponse.model_validate(current_user)
