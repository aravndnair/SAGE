import sys
import weaviate
from weaviate.classes.query import MetadataQuery
from sentence_transformers import SentenceTransformer

COLLECTION = "FileChunks"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_CACHE = "./models"

def main():
    if len(sys.argv) < 2:
        print("Usage: python search_v4.py \"your query here\"")
        return

    query_text = sys.argv[1]

    client = weaviate.connect_to_local()
    try:
        coll = client.collections.get(COLLECTION)
        model = SentenceTransformer(MODEL_NAME, cache_folder=MODEL_CACHE)

        qvec = model.encode([query_text])[0].tolist()

        res = coll.query.near_vector(
            near_vector=qvec,
            limit=5,
            return_properties=["path", "filename", "chunk", "chunk_index"],
            return_metadata=MetadataQuery(distance=True),
        )

        for i, obj in enumerate(res.objects, 1):
            props = obj.properties
            snippet = props['chunk'][:200].replace("\n", " ")  # ✅ fixed here
            print(f"[{i}] {props['filename']} (chunk {props['chunk_index']})")
            print(f"    distance: {obj.metadata.distance:.4f}")
            print(f"    path: {props['path']}")
            print(f"    snippet: {snippet}\n")
    finally:
        client.close()

if __name__ == "__main__":
    main()
