from collections.abc import AsyncIterator

from psycopg_pool import AsyncConnectionPool

from app.config import get_settings


pool: AsyncConnectionPool | None = None


async def open_pool() -> None:
    global pool
    if pool is None:
        pool = AsyncConnectionPool(
            conninfo=get_settings().database_url,
            min_size=1,
            max_size=10,
            open=False,
        )
        await pool.open()


async def close_pool() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None


async def get_conn() -> AsyncIterator:
    if pool is None:
        await open_pool()
    assert pool is not None
    async with pool.connection() as conn:
        yield conn
