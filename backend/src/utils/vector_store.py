from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import SQLiteVSS
from langchain_core.documents import Document
from typing import Optional

from . import VECTOR_DB_PATH, settings

_embeddings: Optional[HuggingFaceEmbeddings] = None
_vectorstore: Optional[SQLiteVSS] = None


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name=settings.embedding_model,
            model_kwargs={"device": settings.device},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def get_vectorstore() -> SQLiteVSS:
    global _vectorstore
    if _vectorstore is None:
        VECTOR_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _vectorstore = SQLiteVSS(
            embedding=get_embeddings(),
            table="memory_vectors",
            db_file=str(VECTOR_DB_PATH),
            content_column="content",
            metadata_column="metadata",
            vector_column="embedding",
        )
    return _vectorstore


def add_memory(id: str, content: str, metadata: dict) -> None:
    vectorstore = get_vectorstore()
    doc = Document(page_content=content, metadata={"id": id, **metadata})
    vectorstore.add_documents([doc])


def search_memories(query: str, isolation_key: Optional[str] = None, k: int = 5) -> list[dict]:
    vectorstore = get_vectorstore()

    search_kwargs = {"k": k}
    if isolation_key:
        search_kwargs["filter"] = {"isolation_key": isolation_key}

    docs = vectorstore.search(query, search_kwargs=search_kwargs)
    return [
        {
            "id": doc.metadata.get("id"),
            "content": doc.page_content,
            "isolation_key": doc.metadata.get("isolation_key"),
            "type": doc.metadata.get("type"),
        }
        for doc in docs
    ]


def delete_memory(id: str) -> None:
    vectorstore = get_vectorstore()
    try:
        vectorstore.delete(filter={"id": id})
    except Exception:
        docs = vectorstore.search(id, search_kwargs={"k": 10})
        for doc in docs:
            if doc.metadata.get("id") == id:
                try:
                    vectorstore.delete([doc])
                except Exception:
                    pass