from config import Settings
from storage.base import Store


def get_store(settings: Settings) -> Store:
    """Pick the adapter from DB_BACKEND. Add new adapters here."""
    if settings.db_backend == "sqlite":
        from storage.sqlite_store import SQLiteStore

        return SQLiteStore(settings.sqlite_path)
    # elif settings.db_backend == "mongo":
    #     from storage.mongo_store import MongoStore
    #     return MongoStore(settings.mongo_uri, settings.mongo_db)
    raise ValueError(f"Unknown DB_BACKEND: {settings.db_backend}")


__all__ = ["Store", "get_store"]
