import os
import warnings
from pathlib import Path
from tqdm import tqdm
import weaviate
from weaviate.classes.data import DataObject
from weaviate.classes.config import Property, DataType, Configure  # ✅ Correct import!

from sentence_transformers import SentenceTransformer
import fitz  # PyMuPDF
import docx

# Optional: suppress deprecation warnings for cleaner output
warnings.filterwarnings("ignore", category=DeprecationWarning)

# === Configuration ===
DOCS_DIR = Path("./docs")
MODEL_DIR = Path("./models/all-MiniLM-L6-v2")
COLLECTION = "FileChunks"

CHUNK_SIZE = 600
OVERLAP = 120

# === File reading functions ===
def extract_pdf(path: Path) -> str:
    text = ""
    try:
        with fitz.open(str(path)) as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        print(f"[WARN] Could not read PDF: {path} → {e}")
    return text

def extract_docx(path: Path) -> str:
    try:
        doc_file = docx.Document(str(path))
        return "\n".join(p.text for p in doc_file.paragraphs)
    except Exception as e:
        print(f"[WARN] Could not read DOCX: {path} → {e}")
        return ""

def read_file(path: Path) -> str:
    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            return extract_pdf(path)
        elif ext == ".docx":
            return extract_docx(path)
        elif ext == ".txt":
            return path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        print(f"[WARN] Error reading file {path}: {e}")
    return ""

def chunk_text(text: str, size: int, overlap: int):
    chunks = []
    i = 0
    step = max(1, size - overlap)
    while i < len(text):
        chunks.append(text[i:i + size])
        i += step
    return [chunk.strip() for chunk in chunks if chunk.strip()]

# === Main indexing logic ===
if __name__ == "__main__":
    print("📁 Checking model path...")
    assert MODEL_DIR.exists(), f"❌ Model not found at: {MODEL_DIR}"

    print("🧠 Loading local model...")
    model = SentenceTransformer(str(MODEL_DIR))

    print("🔌 Connecting to Weaviate (localhost:8080)...")
    client = weaviate.connect_to_local(skip_init_checks=True)

    try:
        print("🚮 Deleting existing collection if present...")
        try:
            client.collections.delete(COLLECTION)
        except Exception:
            pass

        print(f"📦 Creating collection: {COLLECTION}")
        coll = client.collections.create(
            name=COLLECTION,
            properties=[
                Property(name="path", data_type=DataType.TEXT),
                Property(name="filename", data_type=DataType.TEXT),
                Property(name="chunk", data_type=DataType.TEXT),
                Property(name="chunk_index", data_type=DataType.INT),
            ],
            vector_config=Configure.Vectors.self_provided(),  # ✅ You provide vectors manually
        )

        files = list(DOCS_DIR.rglob("*"))
        files = [p for p in files if p.suffix.lower() in {".pdf", ".docx", ".txt"}]

        if not files:
            print(f"⚠️ No .pdf, .docx, or .txt files found in {DOCS_DIR}")
            exit(0)

        print(f"📄 Found {len(files)} file(s). Starting indexing...")
        for file_path in tqdm(files, desc="Indexing"):
            text = read_file(file_path)
            if not text:
                continue

            chunks = chunk_text(text, CHUNK_SIZE, OVERLAP)
            if not chunks:
                continue

            vectors = model.encode(chunks, batch_size=32, show_progress_bar=False)
            vectors = [vec.tolist() for vec in vectors]

            objects = []
            for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
                obj = DataObject(
                    properties={
                        "path": str(file_path.resolve()),
                        "filename": file_path.name,
                        "chunk": chunk,
                        "chunk_index": i,
                    },
                    vector=vector,
                )
                objects.append(obj)

            if objects:
                coll.data.insert_many(objects)

        print(f"✅ Indexed {len(files)} file(s) into collection '{COLLECTION}'")

    finally:
        client.close()
