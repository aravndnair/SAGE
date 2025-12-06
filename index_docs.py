import os
import warnings
from pathlib import Path
from tqdm import tqdm
import sqlite3
import weaviate
from weaviate.classes.data import DataObject
from weaviate.classes.config import Property, DataType, Configure
from weaviate.classes.query import Filter
from sentence_transformers import SentenceTransformer
import fitz
import docx

warnings.filterwarnings("ignore", category=DeprecationWarning)

ROOTS = [
    Path(r"C:\Vscode\semantic_file_search\docs"),
]

MODEL_DIR = Path("./models/all-MiniLM-L6-v2")
COLLECTION = "FileChunks"
STATE_DB = "index_state.db"

CHUNK_SIZE = 600
OVERLAP = 120

def init_db():
    conn = sqlite3.connect(STATE_DB)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            mtime REAL,
            size INTEGER
        )
    """)
    conn.commit()
    return conn

def extract_pdf(path: Path) -> str:
    try:
        text = ""
        with fitz.open(str(path)) as doc:
            for page in doc:
                text += page.get_text()
        return text
    except:
        return ""

def extract_docx(path: Path) -> str:
    try:
        d = docx.Document(str(path))
        return "\n".join(p.text for p in d.paragraphs)
    except:
        return ""

def read_file(path: Path) -> str:
    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            return extract_pdf(path)
        if ext == ".docx":
            return extract_docx(path)
        if ext == ".txt":
            for enc in ("utf-8", "utf-16", "latin-1"):
                try:
                    return path.read_text(encoding=enc)
                except:
                    pass
            return path.read_text(errors="ignore")
    except:
        return ""
    return ""

def chunk_text(text, size, overlap):
    chunks = []
    i = 0
    step = max(1, size - overlap)
    while i < len(text):
        chunk = text[i:i + size].strip()
        if chunk:
            chunks.append(chunk)
        i += step
    return chunks

if __name__ == "__main__":
    print("🧠 Loading local model...")
    model = SentenceTransformer(str(MODEL_DIR))

    print("🔌 Connecting to Weaviate...")
    client = weaviate.connect_to_local(skip_init_checks=True)

    print("📦 Checking collection...")
    try:
        coll = client.collections.get(COLLECTION)
    except:
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

    conn = init_db()
    c = conn.cursor()

    print("📄 Scanning files...")
    current_files = []
    for root in ROOTS:
        if root.exists():
            current_files.extend(
                p for p in root.rglob("*")
                if p.suffix.lower() in {".pdf", ".docx", ".txt"}
            )
    print(f"📊 Found {len(current_files)} files")

    # Remove deleted files
    c.execute("SELECT path FROM files")
    known_paths = {row[0] for row in c.fetchall()}
    disk_paths = {str(p.resolve()) for p in current_files}
    deleted = known_paths - disk_paths

    for p in deleted:
        coll.data.delete_many(where=Filter.by_property("path").equal(p))
        c.execute("DELETE FROM files WHERE path=?", (p,))
    if deleted:
        conn.commit()

    print("⚙️ Indexing changed/new files...")
    changed = 0

    for file_path in tqdm(current_files, desc="Indexing"):
        path = str(file_path.resolve())
        mtime = round(file_path.stat().st_mtime, 2)
        size = file_path.stat().st_size

        c.execute("SELECT mtime, size FROM files WHERE path=?", (path,))
        row = c.fetchone()

        if row and abs(row[0] - mtime) <= 0.01 and row[1] == size:
            continue  # exact same file → skip

        # Changed or new file
        changed += 1
        text = read_file(file_path)
        if not text:
            continue

        chunks = chunk_text(text, CHUNK_SIZE, OVERLAP)
        if not chunks:
            continue

        coll.data.delete_many(where=Filter.by_property("path").equal(path))

        vectors = model.encode(chunks, show_progress_bar=False)
        objects = [
            DataObject(
                properties={
                    "path": path,
                    "filename": file_path.name,
                    "chunk": chunk,
                    "chunk_index": i,
                },
                vector=vec.tolist(),
            )
            for i, (chunk, vec) in enumerate(zip(chunks, vectors))
        ]
        coll.data.insert_many(objects)

        c.execute("REPLACE INTO files(path,mtime,size) VALUES(?,?,?)",
                  (path, mtime, size))
        conn.commit()

    conn.close()
    client.close()
    print(f"🚀 Done — Updated {changed} file(s)")
