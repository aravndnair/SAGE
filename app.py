from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import search

app = FastAPI(title="SAGE Backend", version="1.0")

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10

class SearchResult(BaseModel):
    file: str
    path: str
    snippet: str
    similarity: Optional[float]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/search", response_model=List[SearchResult])
def search_api(req: SearchRequest):
    return search.semantic_search(req.query, req.top_k)
