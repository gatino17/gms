from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: Optional[int] = None


class TokenUser(BaseModel):
    id: Optional[int] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_superuser: bool = False
    tenant_id: Optional[int] = None

    class Config:
        from_attributes = True


class TokenWithUser(Token):
    user: TokenUser
