from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

import search

app = FastAPI(title="SAGE Semantic Search")


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    roots: Optional[List[str]] = None


@app.post("/search")
def search_api(req: SearchRequest):
    return search.semantic_search(
        query=req.query,
        top_k=req.top_k,
        roots=req.roots
    )
