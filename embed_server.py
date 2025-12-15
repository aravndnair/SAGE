from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import os

# ---- Windows safety ----
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
torch.set_num_threads(1)
torch.set_num_interop_threads(1)

from sentence_transformers import SentenceTransformer

app = FastAPI(title="SAGE Embedding Server")

print("🔵 Loading embedding model (standalone process)…")
model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
print("✅ Embedding model loaded")

class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    vectors: List[List[float]]

@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    vectors = model.encode(req.texts)
    return {"vectors": vectors.tolist()}

@app.get("/health")
def health():
    return {"status": "ok"}
