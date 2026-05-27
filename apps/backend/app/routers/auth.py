from datetime import datetime, timedelta
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.pms import models
from app.pms.deps import reusable_oauth2
from app.schemas import token as token_schema

router = APIRouter()
DEFAULT_MAX_SESSIONS_PER_TENANT = 3
SESSION_PRESENCE_MINUTES = 1


@router.post("/login/access-token", response_model=token_schema.TokenWithUser)
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    result = await db.execute(select(models.User).where(models.User.email == form_data.username))
    user = result.scalars().first()

    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    if user.tenant_id is not None:
        tenant = await db.get(models.Tenant, user.tenant_id)
        max_sessions = int(getattr(tenant, "max_sessions", None) or DEFAULT_MAX_SESSIONS_PER_TENANT)
        now_dt = datetime.utcnow()
        presence_cutoff = now_dt - timedelta(minutes=SESSION_PRESENCE_MINUTES)
        active_sessions = await db.scalar(
            select(func.count(models.UserSession.id)).where(
                models.UserSession.tenant_id == user.tenant_id,
                models.UserSession.revoked_at.is_(None),
                models.UserSession.expires_at > now_dt,
                models.UserSession.last_seen_at > presence_cutoff,
            )
        ) or 0
        if int(active_sessions) >= max_sessions:
            raise HTTPException(
                status_code=403,
                detail=f"Limite de sesiones activas alcanzado (maximo {max_sessions}). Cierra una sesion para continuar.",
            )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    expires_at = datetime.utcnow() + access_token_expires
    token_jti = secrets.token_hex(16)
    access_token = security.create_access_token(
        user.id,
        expires_delta=access_token_expires,
        extra={"tenant_id": user.tenant_id, "jti": token_jti},
    )
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    # Reemplaza sesión previa del mismo dispositivo/usuario para evitar acumulación artificial.
    await db.execute(
        update(models.UserSession)
        .where(
            models.UserSession.user_id == user.id,
            models.UserSession.tenant_id == user.tenant_id,
            models.UserSession.user_agent == user_agent,
            models.UserSession.ip_address == ip_address,
            models.UserSession.revoked_at.is_(None),
            models.UserSession.expires_at > datetime.utcnow(),
        )
        .values(revoked_at=datetime.utcnow())
    )

    db.add(
        models.UserSession(
            tenant_id=user.tenant_id,
            user_id=user.id,
            token_jti=token_jti,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=expires_at,
        )
    )
    await db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": token_schema.TokenUser(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_superuser=user.is_superuser,
            tenant_id=user.tenant_id,
        ),
    }


@router.post("/login/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_access_token(
    token: str = Depends(reusable_oauth2),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return
    jti = payload.get("jti")
    if not jti:
        return
    await db.execute(
        update(models.UserSession)
        .where(models.UserSession.token_jti == str(jti), models.UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.utcnow())
    )
    await db.commit()
    return


@router.post("/login/session-ping", status_code=status.HTTP_204_NO_CONTENT)
async def ping_access_token(
    token: str = Depends(reusable_oauth2),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return
    jti = payload.get("jti")
    if not jti:
        return
    await db.execute(
        update(models.UserSession)
        .where(
            models.UserSession.token_jti == str(jti),
            models.UserSession.revoked_at.is_(None),
            models.UserSession.expires_at > datetime.utcnow(),
        )
        .values(last_seen_at=datetime.utcnow())
    )
    await db.commit()
    return
