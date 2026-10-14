from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.urls import async_database_url

engine = create_async_engine(
    async_database_url(settings.database_url), pool_pre_ping=True, pool_recycle=1800
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with SessionLocal() as session:
        yield session
