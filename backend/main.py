import traceback
from fastapi import FastAPI
from pydantic import BaseModel
import weaviate
from sentence_transformers import SentenceTransformer
import uvicorn

# =========================
# CONFIG
# =========================
CLASS_NAME = "Documents"
SENSITIVE_WORDS = {"password", "license", "serial", "activation", "key", "recovery", "private", "secret"}

# =========================
# FASTAPI SETUP
# =========================
app = FastAPI()

class SearchRequest(BaseModel):
    query: str


# =========================
# LOAD MODEL + WEAVIATE
# =========================
print("🔵 Loading SentenceTransformer model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("✅ Model loaded.")

print("🟦 Connecting to Weaviate...")
client = weaviate.connect_to_local()
collection = client.collections.get(CLASS_NAME)
print("✅ Connected to Weaviate.")


# =========================
# HELPERS
# =========================
def is_sensitive_text(text: str | None) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(w in t for w in SENSITIVE_WORDS)


# =========================
# SEARCH ENDPOINT
# =========================
@app.post("/search")
async def search_files(request: SearchRequest):
    try:
        query = request.query.strip()
        if not query:
            return {"results": []}

        qvec = model.encode(query).tolist()

        # 🔥 PURE VECTOR SEARCH — NO GENERATIVE MODE
        response = (
            collection.query
            .near_vector(near_vector=qvec, limit=12)
            .return_properties(["file", "path", "content", "chunk"])
            .return_metadata(["distance"])
            .do()
        )

        objects = response["data"]["Get"].get(CLASS_NAME, [])
        results = []

        for obj in objects:
            props = obj
            meta = obj.get("_additional", {})

            file = props.get("file", "")
            path = props.get("path", "")
            chunk = props.get("chunk", "") or ""
            content = props.get("content", "") or ""

            # Sensitive filtering
            if is_sensitive_text(chunk) or is_sensitive_text(content):
                continue

            snippet = (chunk[:200] + "…").replace("\n", " ")

            dist = meta.get("distance", 1.0)
            similarity = max(0, min(100, (1 - dist) * 100))

            results.append({
                "file": file,
                "path": path,
                "snippet": snippet,
                "similarity": round(similarity, 2)
            })

        return {"results": results}

    except Exception as e:
        print("❌ SEARCH ERROR:", e)
        traceback.print_exc()
        return {"results": []}


# =========================
# CLEAN SHUTDOWN
# =========================
@app.on_event("shutdown")
def shutdown_event():
    try:
        print("🔻 Closing Weaviate connection...")
        client.close()
    except:
        pass


# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=9000, reload=False)
