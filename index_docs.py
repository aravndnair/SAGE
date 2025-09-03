import os
from pathlib import Path
from tqdm import tqdm
import weaviate
from weaviate.classes.config import Property, DataType, Configure
from weaviate.classes.data import DataObject
from sentence_transformers import SentenceTransformer
import fitz  # PyMuPDF
import docx

DOCS_DIR = Path("./docs")
COLLECTION = "FileChunks"
CHUNK_SIZE = 600
OVERLAP = 120
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_CACHE = "./models"

def extract_pdf(path):
    text = ""
    doc = fitz.open(path)
    for page in doc:
        text += page.get_text()
    return text

def extract_docx(path):
    doc_file = docx.Document(path)
    return "\n".join([p.text for p in doc_file.paragraphs])

def read_file(path: Path):
    if path.suffix.lower() == ".pdf":
        return extract_pdf(path)
    elif path.suffix.lower() == ".docx":
        return extract_docx(path)
    elif path.suffix.lower() == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    return ""

def chunk_text(text: str, size: int, overlap: int):
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i:i+size])
        i += size - overlap
    return [c.strip() for c in chunks if c.strip()]

# Connect to local Weaviate (Docker)
client = weaviate.connect_to_local()

try:
    # Delete collection if exists
    try:
        client.collections.delete(COLLECTION)
    except Exception:
        pass

    coll = client.collections.create(
        name=COLLECTION,
        properties=[
            Property(name="path", data_type=DataType.TEXT),
            Property(name="filename", data_type=DataType.TEXT),
            Property(name="chunk", data_type=DataType.TEXT),
            Property(name="chunk_index", data_type=DataType.INT),
        ],
        vector_config=Configure.Vectors.self_provided(),
    )

    model = SentenceTransformer(MODEL_NAME, cache_folder=MODEL_CACHE)

    files = [p for p in DOCS_DIR.glob("**/*") if p.suffix.lower() in {".pdf", ".docx", ".txt"}]
    for p in tqdm(files, desc="Indexing files"):
        text = read_file(p)
        if not text:
            continue
        chunks = chunk_text(text, CHUNK_SIZE, OVERLAP)
        vectors = model.encode(chunks, batch_size=32, show_progress_bar=False)
        vectors = [list(map(float, vec)) for vec in vectors]

        objects = []
        for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
            objects.append(
                DataObject(
                    properties={
                        "path": str(p.resolve()),
                        "filename": p.name,
                        "chunk": chunk,
                        "chunk_index": idx,
                    },
                    vector=vec,
                )
            )
        coll.data.insert_many(objects)

    print(f"✅ Indexed {len(files)} files into collection '{COLLECTION}'")
finally:
    client.close()
