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
    roots: Optional[List[str]] = None,
    filter_paths: Optional[List[str]] = None
):
    """
    Semantic search with file-level deduplication and optional hybrid scoring.
    Returns top_k FILES (not chunks), each with their best matching chunk.
    
    Args:
        query: Search query string
        top_k: Number of results to return
        roots: List of root directories to scope search (uses DB roots if None)
        filter_paths: List of specific file paths to restrict search to (for DeepDive)
    """

    # ---- Resolve effective roots ----
    if roots is None and filter_paths is None:
        roots = load_db_roots()

    norm_roots = [os.path.normpath(r) for r in roots] if roots else None
    norm_filter_paths = set(os.path.normpath(p) for p in filter_paths) if filter_paths else None

    # ---- Parse query for keyword matching ----
    query_terms = query.lower().split() if ENABLE_HYBRID else []

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

        # ---- DeepDive file filtering (strict path match) ----
        if norm_filter_paths is not None:
            if norm_path not in norm_filter_paths:
                continue
        # ---- Root scoping (only if not using filter_paths) ----
        elif norm_roots:
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

    # ---- Extract query-aware snippets for top results ----
    # Pre-compute query embedding once for efficiency
    query_embedding = model.encode(query, convert_to_tensor=True)
    
    # Sort by hybrid score
    sorted_results = sorted(file_best.values(), key=lambda x: x["hybrid_score"], reverse=True)[:top_k]
    
    # Process each result to extract query-aware snippet
    output = []
    for result in sorted_results:
        chunk_text = result.get("chunk", "")
        
        # Extract relevant sentences and matched terms
        snippet, matched_terms = extract_query_aware_snippet(
            query, 
            chunk_text,
            query_embedding
        )
        
        output.append({
            "file": result["file"],
            "path": result["path"],
            "snippet": snippet,
            "chunk": result["chunk"],  # Include full chunk for DeepDive context
            "matched_terms": matched_terms,
            "distance": result["distance"],
            "similarity": result["similarity"],
            "hybrid_score": result["hybrid_score"]
        })
    
    return output
