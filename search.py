import os
import re
import requests
import weaviate

CLASS_NAME = "Documents"
EMBED_SERVER_URL = "http://127.0.0.1:9000"

_client = None

def get_client():
    global _client
    if _client is None:
        _client = weaviate.connect_to_local()
    return _client

def embed_query(text: str):
    r = requests.post(
        f"{EMBED_SERVER_URL}/embed",
        json={"texts": [text]},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["vectors"][0]

def tokenize(text: str):
    return set(re.findall(r"[a-zA-Z]{3,}", text.lower()))

def semantic_search(query: str, top_k: int = 5):
    vec = embed_query(query)
    client = get_client()
    col = client.collections.get(CLASS_NAME)

    raw = col.query.near_vector(near_vector=vec, limit=top_k * 10)

    q_tokens = tokenize(query)
    results = {}

    for obj in raw.objects:
        p = obj.properties
        chunk = p["chunk"]
        folders = p.get("folders", "")
        path = p["path"]

        score = 1.0 - (obj.metadata.distance or 1.0)

        # Folder-name boost
        folder_tokens = tokenize(folders)
        if q_tokens & folder_tokens:
            score += 0.4

        if path not in results or score > results[path]["similarity"]:
            results[path] = {
                "file": os.path.basename(path),
                "path": path,
                "snippet": chunk,
                "similarity": round(score, 4),
            }

    return sorted(results.values(), key=lambda x: x["similarity"], reverse=True)[:top_k]
