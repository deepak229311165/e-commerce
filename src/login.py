from datetime import datetime, timedelta, timezone
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

from src.config import settings
from src.mongodb import users
from src.schema import Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": user_id, "exp": exp}, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "not_authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(
            creds.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except jwt.PyJWTError:
        raise unauthorized
    user = await users.get_user_by_id(payload.get("sub", ""))
    if user is None:
        raise unauthorized
    return user


async def get_current_seller(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "seller":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Seller account required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/register", response_model=Token, status_code=201)
async def register(body: UserCreate):
    if await users.get_user_by_email(body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    doc = await users.create_user(
        body.name, body.email, hash_password(body.password), role=body.role
    )
    out = users.serialize_user(doc)
    return Token(access_token=create_token(out["id"]), user=UserOut(**out))


@router.post("/login", response_model=Token)
async def login(body: UserLogin):
    doc = await users.get_user_by_email(body.email)
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    out = users.serialize_user(doc)
    return Token(access_token=create_token(out["id"]), user=UserOut(**out))


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**users.serialize_user(user))