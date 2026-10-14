from app.db.urls import async_database_url, sync_database_url


def test_supabase_url_is_normalized_for_async_application_connections():
    url = "postgresql://postgres:encoded%40password@db.example.supabase.co:5432/postgres"

    normalized = async_database_url(url)

    assert normalized.startswith("postgresql+asyncpg://")
    assert "encoded%40password@" in normalized
    assert "ssl=require" in normalized


def test_supabase_url_is_normalized_for_alembic_connections():
    url = "postgresql://postgres:encoded%40password@db.example.supabase.co:5432/postgres"

    normalized = sync_database_url(url)

    assert normalized.startswith("postgresql+psycopg://")
    assert "encoded%40password@" in normalized
    assert "sslmode=require" in normalized


def test_supabase_session_pooler_url_requires_tls():
    url = (
        "postgresql://postgres.project-ref:encoded%40password"
        "@aws-0-region.pooler.supabase.com:5432/postgres"
    )

    async_url = async_database_url(url)
    sync_url = sync_database_url(url)

    assert "ssl=require" in async_url
    assert "sslmode=require" in sync_url


def test_existing_sqlite_and_mysql_urls_keep_expected_drivers():
    assert async_database_url("sqlite+aiosqlite:///./teamwork.db") == (
        "sqlite+aiosqlite:///./teamwork.db"
    )
    assert sync_database_url("mysql+asyncmy://user:pass@localhost/db") == (
        "mysql+pymysql://user:pass@localhost/db"
    )
