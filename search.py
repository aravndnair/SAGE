import time
import re
import os
import difflib

# Set offline mode for HuggingFace before importing transformers
os.environ["HF_HUB_OFFLINE"] = "1"

from sentence_transformers import SentenceTransformer, util
import weaviate
import sqlite3
from typing import List, Optional, Tuple, Set

# ---------------- CONFIG ----------------

CLASS_NAME = "Documents"
EMBED_MODEL = "all-MiniLM-L6-v2"
INDEX_DB = "index_state.db"

# Hybrid Search Configuration
ENABLE_HYBRID = True      # Set to False to use pure semantic search
SEMANTIC_WEIGHT = 0.8     # Semantic similarity dominates
KEYWORD_WEIGHT = 0.2      # Keywords provide relevance boost
FETCH_BUFFER = 10         # Fetch top_k * FETCH_BUFFER for deduplication

# Query-aware Snippet Configuration
MAX_SNIPPET_SENTENCES = 3    # Max sentences to include in snippet
MIN_SENTENCE_LENGTH = 20     # Ignore very short sentences
SENTENCE_SCORE_THRESHOLD = 0.3  # Min relevance score to include sentence

# Fuzzy / Typo Tolerance Configuration
FUZZY_MATCH_THRESHOLD = 0.75   # Min similarity ratio for fuzzy keyword match (0-1)
MIN_WORD_LENGTH_FOR_FUZZY = 4  # Don't fuzzy-match very short words

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


# -------- VOCABULARY CACHE --------

_vocabulary: Optional[Set[str]] = None

def get_vocabulary() -> Set[str]:
    """
    Build a vocabulary set from all indexed chunks.
    Cached after first call. Used for fuzzy spell correction.
    """
    global _vocabulary
    if _vocabulary is not None:
        return _vocabulary

    try:
        collection = get_collection()
        vocab = set()
        for obj in collection.iterator():
            chunk = obj.properties.get("chunk", "")
            filename = obj.properties.get("file", "")
            # Extract words from chunk and filename
            words = re.findall(r'[a-zA-Z]{3,}', chunk)
            words += re.findall(r'[a-zA-Z]{3,}', filename)
            vocab.update(w.lower() for w in words)
        _vocabulary = vocab
        print(f"[VOCAB] Built vocabulary: {len(vocab)} unique words")
    except Exception as e:
        print(f"[VOCAB] Failed to build vocabulary: {e}")
        _vocabulary = set()
    return _vocabulary


def invalidate_vocabulary():
    """Call this after re-indexing to refresh the vocabulary."""
    global _vocabulary
    _vocabulary = None


def correct_query(query: str) -> str:
    """
    Attempt to correct misspelled words in the query using the indexed vocabulary.
    Uses difflib.get_close_matches for fast offline fuzzy matching.
    Returns the corrected query string.
    """
    vocab = get_vocabulary()
    if not vocab:
        return query  # No vocabulary yet, return as-is

    vocab_list = list(vocab)  # get_close_matches needs a list
    words = query.split()
    corrected = []

    for word in words:
        lower = word.lower()
        # Skip short words or words already in the vocabulary
        if len(lower) < MIN_WORD_LENGTH_FOR_FUZZY or lower in vocab:
            corrected.append(word)
            continue

        matches = difflib.get_close_matches(
            lower, vocab_list, n=1, cutoff=FUZZY_MATCH_THRESHOLD
        )
        if matches:
            # Preserve original casing style
            replacement = matches[0]
            if word[0].isupper():
                replacement = replacement.capitalize()
            corrected.append(replacement)
            if replacement.lower() != lower:
                print(f"[FUZZY] '{word}' → '{replacement}'")
        else:
            corrected.append(word)

    return ' '.join(corrected)


def load_db_roots() -> List[str]:
    conn = sqlite3.connect(INDEX_DB, timeout=30)
    cur = conn.cursor()
    cur.execute("SELECT path FROM user_roots")
    roots = [row[0] for row in cur.fetchall()]
    conn.close()
    return roots


def fuzzy_term_in_text(term: str, text_lower: str, threshold: float = FUZZY_MATCH_THRESHOLD) -> bool:
    """
    Check if a term (or a close fuzzy match) appears in the text.
    First checks exact substring, then falls back to fuzzy word matching.
    """
    if term in text_lower:
        return True
    # Only do fuzzy matching for longer terms
    if len(term) < MIN_WORD_LENGTH_FOR_FUZZY:
        return False
    # Check each word in the text for a close match
    text_words = set(re.findall(r'[a-z]{3,}', text_lower))
    for w in text_words:
        ratio = difflib.SequenceMatcher(None, term, w).ratio()
        if ratio >= threshold:
            return True
    return False


def calculate_keyword_score(query_terms: List[str], chunk_text: str, filename: str) -> float:
    """
    Calculate keyword match score (0.0 to 1.0) based on query term presence.
    Checks both chunk text and filename. Includes fuzzy matching for typos.
    Bounded to prevent overpowering semantic score.
    """
    if not query_terms:
        return 0.0
    
    chunk_lower = chunk_text.lower()
    filename_lower = filename.lower()
    
    matches = 0
    for term in query_terms:
        term_lower = term.lower()
        if fuzzy_term_in_text(term_lower, chunk_lower):
            matches += 1
        if fuzzy_term_in_text(term_lower, filename_lower):
            matches += 0.5  # Filename match weighted less than chunk match
    
    # Normalize: max possible score is len(query_terms) * 1.5
    # Cap at 1.0 to prevent keyword dominance
    max_possible = len(query_terms) * 1.5
    score = min(1.0, matches / max_possible if max_possible > 0 else 0.0)
    
    return score


def split_into_sentences(text: str) -> List[str]:
    """
    Split text into sentences using regex.
    Handles common sentence boundaries while preserving structure.
    """
    # Split on sentence-ending punctuation followed by space or end
    # But avoid splitting on abbreviations like "Dr.", "Mr.", "e.g.", etc.
    sentence_pattern = r'(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$'
    
    # First, normalize whitespace
    text = ' '.join(text.split())
    
    # Split into sentences
    sentences = re.split(sentence_pattern, text)
    
    # Clean up and filter
    cleaned = []
    for s in sentences:
        s = s.strip()
        if len(s) >= MIN_SENTENCE_LENGTH:
            cleaned.append(s)
    
    return cleaned


def extract_query_aware_snippet(
    query: str,
    chunk_text: str,
    query_embedding=None
) -> Tuple[str, List[str]]:
    """
    Extract the most relevant sentences from a chunk based on the query.
    Returns (snippet_text, list_of_matched_terms).
    
    Uses semantic similarity to find sentences that best answer the query,
    not just sentences that contain query keywords.
    """
    model = get_model()
    
    # Get query embedding if not provided
    if query_embedding is None:
        query_embedding = model.encode(query, convert_to_tensor=True)
    
    # Split chunk into sentences
    sentences = split_into_sentences(chunk_text)
    
    if not sentences:
        # Fallback: return truncated chunk
        return chunk_text[:300], []
    
    if len(sentences) <= MAX_SNIPPET_SENTENCES:
        # Chunk is small enough, use all sentences
        snippet = ' '.join(sentences)
        matched_terms = find_matched_terms(query, snippet)
        return snippet, matched_terms
    
    # Encode all sentences
    sentence_embeddings = model.encode(sentences, convert_to_tensor=True)
    
    # Calculate semantic similarity between query and each sentence
    similarities = util.cos_sim(query_embedding, sentence_embeddings)[0]
    
    # Get sentence scores as list of (index, score)
    scored_sentences = [(i, float(similarities[i])) for i in range(len(sentences))]
    
    # Sort by score descending
    scored_sentences.sort(key=lambda x: x[1], reverse=True)
    
    # Select top sentences that meet threshold
    selected_indices = []
    for idx, score in scored_sentences:
        if score >= SENTENCE_SCORE_THRESHOLD and len(selected_indices) < MAX_SNIPPET_SENTENCES:
            selected_indices.append(idx)
    
    # If no sentences meet threshold, take top ones anyway
    if not selected_indices:
        selected_indices = [scored_sentences[0][0]] if scored_sentences else []
    
    # Sort by original position to maintain reading order
    selected_indices.sort()
    
    # Build snippet from selected sentences
    selected_sentences = [sentences[i] for i in selected_indices]
    
    # Add ellipsis between non-consecutive sentences
    snippet_parts = []
    for i, idx in enumerate(selected_indices):
        if i > 0 and idx > selected_indices[i-1] + 1:
            # Non-consecutive - add ellipsis
            snippet_parts.append("...")
        snippet_parts.append(sentences[idx])
    
    snippet = ' '.join(snippet_parts)
    
    # Find terms to highlight
    matched_terms = find_matched_terms(query, snippet)
    
    return snippet, matched_terms


def find_matched_terms(query: str, text: str) -> List[str]:
    """
    Find query terms that appear in the text for highlighting.
    Returns list of matched terms (case-preserved from text).
    """
    query_terms = set(query.lower().split())
    text_lower = text.lower()
    
    matched = []
    for term in query_terms:
        # Skip very short terms (articles, prepositions)
        if len(term) < 3:
            continue
        if term in text_lower:
            # Find the actual case-preserved version in text
            pattern = re.compile(re.escape(term), re.IGNORECASE)
            match = pattern.search(text)
            if match:
                matched.append(match.group())
    
    return list(set(matched))


def semantic_search(
    query: str,
    top_k: int = 5,
    roots: Optional[List[str]] = None
):
    """
    Semantic search with file-level deduplication and optional hybrid scoring.
    Returns top_k FILES (not chunks), each with their best matching chunk.
    Includes fuzzy spell correction for typo tolerance.
    """

    # ---- Fuzzy spell correction ----
    original_query = query
    query = correct_query(query)
    if query != original_query:
        print(f"[SEARCH] Corrected query: '{original_query}' → '{query}'")

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
                "chunk": chunk_text,  # Store full chunk for query-aware processing
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
            "matched_terms": matched_terms,
            "distance": result["distance"],
            "similarity": result["similarity"],
            "hybrid_score": result["hybrid_score"]
        })
    
    return output
