from __future__ import annotations


from fastapi import Header, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.backend.app.db.session import get_db
from apps.backend.app.core.config import settings
from apps.backend.app.core import security
from apps.backend.app.pms import models
from apps.backend.app.schemas import token as token_schema

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_title}/login/access-token"
)


async def get_db_session(db: AsyncSession = Depends(get_db)) -> AsyncSession:
    return db

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> models.User:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        token_data = token_schema.TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    result = await db.execute(select(models.User).where(models.User.id == token_data.sub))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

async def get_current_active_superuser(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user

async def get_tenant_id(
    x_tenant_id: int | None = Header(default=None, alias="X-Tenant-ID"),
    current_user: models.User = Depends(get_current_user),
) -> int:
    # Superusuario: si no envía header, usar su tenant_id si existe; si no, exigir header.
    if current_user.is_superuser:
        # Si no envía header y tiene tenant asignado, úsalo; si no tiene, permitir null y que los endpoints no filtren por tenant.
        if x_tenant_id is not None:
            return x_tenant_id
        if current_user.tenant_id:
            return current_user.tenant_id
        return current_user.tenant_id or 0

    # Usuarios no superuser: requieren header y debe coincidir con su tenant asignado.
    if x_tenant_id is None:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header requerido")
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Usuario sin tenant asignado")
    if x_tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Tenant no permitido")
    return x_tenant_id
