from sentence_transformers import SentenceTransformer
import weaviate
import sqlite3
import os
from typing import List, Optional

# ---------------- CONFIG ----------------

CLASS_NAME = "Documents"
EMBED_MODEL = "all-MiniLM-L6-v2"
INDEX_DB = "index_state.db"

# --------------------------------------


# -------- INIT (loaded once) --------

model = SentenceTransformer(EMBED_MODEL)
client = weaviate.connect_to_local()
collection = client.collections.get(CLASS_NAME)

# -----------------------------------


def load_db_roots() -> List[str]:
    conn = sqlite3.connect(INDEX_DB)
    cur = conn.cursor()
    cur.execute("SELECT path FROM user_roots")
    roots = [row[0] for row in cur.fetchall()]
    conn.close()
    return roots


def semantic_search(
    query: str,
    top_k: int = 5,
    roots: Optional[List[str]] = None
):
    """
    Semantic search with DB-root defaults.
    """

    # ---- Resolve effective roots ----
    if roots is None:
        roots = load_db_roots()

    norm_roots = [os.path.normpath(r) for r in roots] if roots else None

    query_vector = model.encode(query).tolist()

    results = collection.query.near_vector(
        near_vector=query_vector,
        limit=top_k * 5,
        return_metadata=["distance"]
    )

    output = []

    for obj in results.objects:
        path = obj.properties.get("path", "")
        norm_path = os.path.normpath(path)

        # ---- Root scoping ----
        if norm_roots:
            if not any(norm_path.startswith(r) for r in norm_roots):
                continue

        distance = obj.metadata.distance
        similarity = round(1 - distance, 4)

        output.append({
            "file": obj.properties.get("file"),
            "path": path,
            "snippet": obj.properties.get("chunk", "")[:300],
            "distance": round(distance, 4),
            "similarity": similarity
        })

    output.sort(key=lambda x: x["distance"])
    return output[:top_k]
