"""
EventOS Database Layer — Async MongoDB Atlas connection via motor.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client: AsyncIOMotorClient | None = None
_db = None

COLLECTIONS = [
    "projects", "assets", "leads", "roadmap",
    "rules", "context", "budgets", "agent_logs",
    "terminal_logs",
]


import certifi

def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        _client = AsyncIOMotorClient(uri, tlsCAFile=certifi.where())
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()["eventos"]
    return _db


async def ping_db() -> bool:
    """Test the database connection. Returns True on success."""
    try:
        await get_client().admin.command("ping")
        print("✅ Connected to MongoDB Atlas")
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False


async def insert_document(collection: str, doc: dict) -> str:
    """Insert a document into a collection. Returns the inserted_id as string."""
    result = await get_db()[collection].insert_one(doc)
    return str(result.inserted_id)


async def insert_many_documents(collection: str, docs: list[dict]) -> list[str]:
    """Insert multiple documents. Returns list of inserted_ids."""
    if not docs:
        return []
    result = await get_db()[collection].insert_many(docs)
    return [str(id_) for id_ in result.inserted_ids]


async def update_document(collection: str, filter_: dict, update: dict, upsert: bool = True) -> bool:
    """Update or upsert a document. Returns True if modified/inserted."""
    result = await get_db()[collection].update_one(filter_, {"$set": update}, upsert=upsert)
    return result.modified_count > 0 or result.upserted_id is not None


async def get_documents(collection: str, filter_: dict | None = None, limit: int = 100) -> list[dict]:
    """Get documents from a collection."""
    filter_ = filter_ or {}
    cursor = get_db()[collection].find(filter_).limit(limit)
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])  # Convert ObjectId to string
        docs.append(doc)
    return docs


async def get_one_document(collection: str, filter_: dict) -> dict | None:
    """Get a single document."""
    doc = await get_db()[collection].find_one(filter_)
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


async def delete_document(collection: str, filter_: dict) -> int:
    """Delete matching documents. Returns count deleted."""
    result = await get_db()[collection].delete_many(filter_)
    return result.deleted_count


async def count_documents(collection: str, filter_: dict | None = None) -> int:
    """Count documents in a collection."""
    filter_ = filter_ or {}
    return await get_db()[collection].count_documents(filter_)
