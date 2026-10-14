from sqlalchemy.engine import URL, make_url


def _is_supabase(url: URL) -> bool:
    return bool(
        url.host
        and (
            url.host.endswith(".supabase.co")
            or url.host.endswith(".pooler.supabase.com")
        )
    )


def async_database_url(database_url: str) -> str:
    url = make_url(database_url)
    backend = url.get_backend_name()

    if backend == "postgresql":
        url = url.set(drivername="postgresql+asyncpg")
        query = dict(url.query)
        if "sslmode" in query and "ssl" not in query:
            query["ssl"] = query.pop("sslmode")
        if _is_supabase(url) and not query.get("ssl"):
            query["ssl"] = "require"
        url = url.set(query=query)
    elif url.drivername == "mysql":
        url = url.set(drivername="mysql+asyncmy")

    return url.render_as_string(hide_password=False)


def sync_database_url(database_url: str) -> str:
    url = make_url(database_url)
    backend = url.get_backend_name()

    if backend == "postgresql":
        url = url.set(drivername="postgresql+psycopg")
        query = dict(url.query)
        if "ssl" in query and "sslmode" not in query:
            query["sslmode"] = query.pop("ssl")
        if _is_supabase(url) and not query.get("sslmode"):
            query["sslmode"] = "require"
        url = url.set(query=query)
    elif url.drivername == "mysql+asyncmy":
        url = url.set(drivername="mysql+pymysql")
    elif url.drivername == "sqlite+aiosqlite":
        url = url.set(drivername="sqlite")

    return url.render_as_string(hide_password=False)
