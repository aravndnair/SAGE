# search.py
import os
from pathlib import Path
import argparse
import weaviate
from weaviate.classes.query import MetadataQuery

# Enforce offline behavior for Hugging Face/Transformers
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from sentence_transformers import SentenceTransformer

COLLECTION = "FileChunks"

# Load model strictly from local folder
MODEL_DIR = Path("./models/all-MiniLM-L6-v2")
assert MODEL_DIR.exists(), f"Model directory not found: {MODEL_DIR}. Please download the model locally first."


def main():
    parser = argparse.ArgumentParser(description="Semantic file search (returns the best matching file).")
    parser.add_argument("query", type=str, help="Your search query")
    parser.add_argument("-k", "--chunks", type=int, default=12, help="How many top chunks to consider for scoring")
    parser.add_argument("-s", "--snippets", type=int, default=3, help="How many snippets to display from the best file")
    args = parser.parse_args()

    # Load the model from disk only
    model = SentenceTransformer(str(MODEL_DIR))

    client = weaviate.connect_to_local()
    try:
        coll = client.collections.get(COLLECTION)

        # Vectorize query
        qvec = model.encode(args.query).tolist()

        # Retrieve more chunks to score files accurately
        res = coll.query.near_vector(
            near_vector=qvec,
            limit=args.chunks,
            return_properties=["path", "filename", "chunk", "chunk_index"],
            return_metadata=MetadataQuery(distance=True),
        )

        if not res.objects:
            print("No results found.")
            return

        # Aggregate by file using inverse-distance scoring
        from collections import defaultdict
        file_scores = defaultdict(float)
        file_chunks = defaultdict(list)
        eps = 1e-6

        for obj in res.objects:
            fname = obj.properties["filename"]
            file_scores[fname] += 1.0 / (obj.metadata.distance + eps)
            file_chunks[fname].append(obj)

        # Pick best file
        best_file = max(file_scores, key=file_scores.get)
        best_file_objs = sorted(file_chunks[best_file], key=lambda o: o.metadata.distance)
        best_path = best_file_objs[0].properties["path"]

        # Output
        print("Best Match:")
        print(f"File: {best_file}")
        print(f"Path: {best_path}\n")

        print("Relevant Snippets:")
        for i, obj in enumerate(best_file_objs[:args.snippets], 1):
            snippet = obj.properties["chunk"].replace("\n", " ").strip()
            score = 1.0 / (obj.metadata.distance + eps)
            print(f"  {i}. (score: {score:.2f}) \"{snippet[:300]}\"")

    finally:
        client.close()


if __name__ == "__main__":
    main()
