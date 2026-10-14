from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.entities import User, WorkspaceMember


async def current_user(
    authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Bearer token required")
    try:
        claims = decode_token(authorization.split(" ", 1)[1])
        if claims.get("kind") != "access":
            raise ValueError("wrong token type")
    except ValueError:
        raise HTTPException(401, "Invalid or expired access token")
    user = await db.get(User, claims["sub"])
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(401, "User is inactive")
    return user


async def require_workspace_role(
    workspace_id: str, roles: set[str], user: User, db: AsyncSession
) -> str:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user.id
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "Workspace not found")
    if membership.role not in roles:
        raise HTTPException(403, "Insufficient workspace role")
    return membership.role
