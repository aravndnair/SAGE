import time
from sentence_transformers import SentenceTransformer
import weaviate
import sqlite3
import os
from typing import List, Optional

# ---------------- CONFIG ----------------

CLASS_NAME = "Documents"
EMBED_MODEL = "all-MiniLM-L6-v2"
INDEX_DB = "index_state.db"

# Hybrid Search Configuration
ENABLE_HYBRID = True      # Set to False to use pure semantic search
SEMANTIC_WEIGHT = 0.8     # Semantic similarity dominates
KEYWORD_WEIGHT = 0.2      # Keywords provide relevance boost
FETCH_BUFFER = 10         # Fetch top_k * FETCH_BUFFER for deduplication

# --------------------------------------


# -------- LAZY INIT --------

_model = None
_client = None
_collection = None

def get_model():
    """Lazy load the embedding model"""
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBED_MODEL)
    return _model

def get_weaviate_client(max_retries=3, retry_delay=2):
    """Lazy connect to Weaviate with retry logic"""
    global _client, _collection
    if _client is None:
        last_error = None
        for attempt in range(max_retries):
            try:
                _client = weaviate.connect_to_local()
                _collection = _client.collections.get(CLASS_NAME)
                return _client, _collection
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    print(f"⚠️ Weaviate connection attempt {attempt + 1} failed, retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                else:
                    print(f"❌ Weaviate connection failed after {max_retries} attempts")
                    raise last_error
    return _client, _collection

def get_collection():
    """Get the Weaviate collection (connects if needed)"""
    _, collection = get_weaviate_client()
    return collection

# -----------------------------------


def load_db_roots() -> List[str]:
    conn = sqlite3.connect(INDEX_DB)
    cur = conn.cursor()
    cur.execute("SELECT path FROM user_roots")
    roots = [row[0] for row in cur.fetchall()]
    conn.close()
    return roots


def calculate_keyword_score(query_terms: List[str], chunk_text: str, filename: str) -> float:
    """
    Calculate keyword match score (0.0 to 1.0) based on query term presence.
    Checks both chunk text and filename.
    Bounded to prevent overpowering semantic score.
    """
    if not query_terms:
        return 0.0
    
    chunk_lower = chunk_text.lower()
    filename_lower = filename.lower()
    
    matches = 0
    for term in query_terms:
        term_lower = term.lower()
        if term_lower in chunk_lower:
            matches += 1
        if term_lower in filename_lower:
            matches += 0.5  # Filename match weighted less than chunk match
    
    # Normalize: max possible score is len(query_terms) * 1.5
    # Cap at 1.0 to prevent keyword dominance
    max_possible = len(query_terms) * 1.5
    score = min(1.0, matches / max_possible if max_possible > 0 else 0.0)
    
    return score


def semantic_search(
    query: str,
    top_k: int = 5,
    roots: Optional[List[str]] = None
):
    """
    Semantic search with file-level deduplication and optional hybrid scoring.
    Returns top_k FILES (not chunks), each with their best matching chunk.
    """

    # ---- Resolve effective roots ----
    if roots is None:
        roots = load_db_roots()

    norm_roots = [os.path.normpath(r) for r in roots] if roots else None

    # ---- Parse query for keyword matching ----
    query_terms = query.lower().split() if ENABLE_HYBRID else []

    # ---- Get model and collection (lazy init) ----
    model = get_model()
    collection = get_collection()

    # ---- Semantic vector search ----
    query_vector = model.encode(query).tolist()

    # Overfetch to ensure enough candidates after deduplication
    results = collection.query.near_vector(
        near_vector=query_vector,
        limit=top_k * FETCH_BUFFER,
        return_metadata=["distance"]
    )

    # ---- File-level deduplication with hybrid scoring ----
    file_best = {}  # path -> best result for that file

    for obj in results.objects:
        path = obj.properties.get("path", "")
        norm_path = os.path.normpath(path)

        # ---- Root scoping ----
        if norm_roots:
            if not any(norm_path.startswith(r) for r in norm_roots):
                continue

        distance = obj.metadata.distance
        semantic_similarity = 1 - distance
        
        chunk_text = obj.properties.get("chunk", "")
        filename = obj.properties.get("file", "")

        # ---- Calculate hybrid score ----
        if ENABLE_HYBRID and query_terms:
            keyword_score = calculate_keyword_score(query_terms, chunk_text, filename)
            hybrid_score = (semantic_similarity * SEMANTIC_WEIGHT) + (keyword_score * KEYWORD_WEIGHT)
        else:
            hybrid_score = semantic_similarity

        # ---- Keep best chunk per file ----
        if path not in file_best or hybrid_score > file_best[path]["hybrid_score"]:
            file_best[path] = {
                "file": filename,
                "path": path,
                "snippet": chunk_text[:300],
                "distance": round(distance, 4),
                "similarity": round(semantic_similarity, 4),
                "hybrid_score": round(hybrid_score, 4)
            }

    # ---- Sort by hybrid score and return top_k files ----
    output = sorted(file_best.values(), key=lambda x: x["hybrid_score"], reverse=True)
    return output[:top_k]
