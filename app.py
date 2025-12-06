import os
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
import weaviate
from weaviate.classes.query import MetadataQuery
from collections import defaultdict
from sentence_transformers import SentenceTransformer

COLLECTION = "FileChunks"
MODEL_DIR = Path("./models/all-MiniLM-L6-v2")

# Enforce offline model use
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

# Load model once
model = SentenceTransformer(str(MODEL_DIR))

# Connect to local Weaviate
client = weaviate.connect_to_local()

app = FastAPI()

class SearchRequest(BaseModel):
    query: str
    chunks: int = 12
    snippets: int = 3

@app.post("/search")
def search(req: SearchRequest):
    coll = client.collections.get(COLLECTION)

    # 1) Embed query
    qvec = model.encode(req.query).tolist()

    # 2) Fetch top chunks (increase limit a bit for better spread)
    res = coll.query.near_vector(
        near_vector=qvec,
        limit=max(req.chunks, 32),
        return_properties=["path", "filename", "chunk", "chunk_index"],
        return_metadata=MetadataQuery(distance=True),
    )

    if not res.objects:
        return {"results": []}

    from collections import defaultdict
    eps = 1e-6

    # Group chunks by file + track best distance per file
    file_chunks = defaultdict(list)
    file_best_distance = {}

    for obj in res.objects:
        fname = obj.properties["filename"]
        d = obj.metadata.distance

        file_chunks[fname].append(obj)

        if fname not in file_best_distance or d < file_best_distance[fname]:
            file_best_distance[fname] = d

    # Convert distances to similarity scores
    # Similarity = 1 / (1 + distance), then normalized to 0–100
    file_scores = {}
    for fname, dist in file_best_distance.items():
        sim = 1.0 / (1.0 + dist)        # 0–1
        file_scores[fname] = sim

    # Normalize scores so best file ~100%
    max_sim = max(file_scores.values()) if file_scores else 1.0
    for fname in file_scores:
        file_scores[fname] = round((file_scores[fname] / max_sim) * 100, 2)

    # Sort files by similarity
    sorted_files = sorted(
        file_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )

    # Take top 4 files
    top_files = sorted_files[:4]

    results = []
    for fname, score in top_files:
        objs = sorted(file_chunks[fname], key=lambda o: o.metadata.distance)
        best_path = objs[0].properties["path"]

        snippets = []
        for obj in objs[:req.snippets]:
            snippet_text = obj.properties["chunk"].replace("\n", " ").strip()
            snippets.append({
                "text": snippet_text[:400],
                "chunk_index": obj.properties["chunk_index"],
            })

        results.append({
            "file": fname,
            "path": best_path,
            "similarity": score,  # percentage 0–100
            "snippets": snippets,
        })

    return {"results": results}


