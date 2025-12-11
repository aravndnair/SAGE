import os
import glob
import sqlite3
from tqdm import tqdm
from typing import List
from sentence_transformers import SentenceTransformer

# Optional imports
try:
    import fitz as pymupdf
except Exception:
    pymupdf = None

try:
    import docx
except Exception:
    docx = None

import weaviate
from weaviate.collections.classes.config import (
    Property,
    DataType,
    Configure,
)

# ---------- CONFIG ----------
CLASS_NAME = "Documents"
DB_PATH = "index_state.db"
DOCS_FOLDER = "docs"

DEFAULT_FOLDERS = [
    os.path.expanduser("~/OneDrive/Desktop"),
    os.path.expanduser("~/OneDrive/Documents"),
    os.path.expanduser("~/Downloads"),
    DOCS_FOLDER
]

ALLOWED_EXT = (".txt", ".pdf", ".docx")
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MIN_CHUNK_LEN = 30

SENSITIVE_WORDS = {"password", "license", "serial", "activation", "key", "recovery", "private", "secret"}


# ---------- FILE READERS ----------
def read_txt(path):
    try:
        return open(path, "r", encoding="utf-8", errors="ignore").read()
    except:
        return ""

def read_pdf(path):
    if pymupdf is None:
        return ""
    try:
        doc = pymupdf.open(path)
        pages = [page.get_text("text") for page in doc]
        return "\n".join(pages)
    except:
        return ""

def read_docx(path):
    if docx is None:
        return ""
    try:
        document = docx.Document(path)
        return "\n".join([p.text for p in document.paragraphs])
    except:
        return ""


def extract_text(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".txt":
        return read_txt(path)
    if ext == ".pdf":
        return read_pdf(path)
    if ext == ".docx":
        return read_docx(path)
    return ""


# ---------- HELPERS ----------
def contains_sensitive(text):
    t = text.lower()
    return any(word in t for word in SENSITIVE_WORDS)


def chunk_text(text: str) -> List[str]:
    text = " ".join(text.split())
    L = len(text)
    if L <= CHUNK_SIZE:
        return [text]
    chunks = []
    start = 0
    while start < L:
        end = min(start + CHUNK_SIZE, L)
        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_LEN:
            chunks.append(chunk)
        if end >= L:
            break
        start = end - CHUNK_OVERLAP
    return chunks


# ---------- INDEXING START ----------
print("🔵 Loading embedding model…")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("✅ Model loaded.\n")

print("🟦 Connecting to Weaviate…")
client = weaviate.connect_to_local()
print("✅ Connected.\n")

# ---------- RESET SCHEMA ----------
print("🧹 Resetting schema…")
client.collections.delete_all()

client.collections.create(
    name=CLASS_NAME,
    properties=[
        Property(name="file", data_type=DataType.TEXT),
        Property(name="path", data_type=DataType.TEXT),
        Property(name="chunk", data_type=DataType.TEXT),
    ],
    vector_config=Configure.Vector.none(),
)

collection = client.collections.get(CLASS_NAME)
print("📘 Collection created.\n")

# ---------- SQLITE ----------
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute(
    """
    CREATE TABLE IF NOT EXISTS indexed_files(
        path TEXT PRIMARY KEY,
        modified REAL
    )
    """
)
conn.commit()

# ---------- SCAN ----------
folders = [f for f in DEFAULT_FOLDERS if os.path.exists(f)]

print("🔍 Scanning folders:")
for f in folders:
    print("  •", f)
print()

files = []
for folder in folders:
    for ext in ALLOWED_EXT:
        files += glob.glob(os.path.join(folder, "**", f"*{ext}"), recursive=True)

files = sorted(set(files))
print(f"📄 Found {len(files)} files.\n")

# ---------- INDEX ----------
total_chunks = 0
skipped = {"empty": 0, "sensitive": 0, "nochunks": 0}

for path in tqdm(files, desc="Indexing"):
    try:
        mtime = os.path.getmtime(path)
    except:
        continue

    cur.execute("SELECT modified FROM indexed_files WHERE path=?", (path,))
    row = cur.fetchone()
    if row and float(row[0]) == float(mtime):
        continue

    text = extract_text(path)
    if not text.strip():
        skipped["empty"] += 1
        continue

    if contains_sensitive(text):
        skipped["sensitive"] += 1
        continue

    chunks = chunk_text(text)
    if not chunks:
        skipped["nochunks"] += 1
        continue

    vectors = model.encode(chunks, convert_to_numpy=True)

    for chunk, vec in zip(chunks, vectors):
        try:
            collection.data.insert(
                properties={
                    "file": os.path.basename(path),
                    "path": os.path.abspath(path),
                    "chunk": chunk,
                },
                vector=vec.tolist(),  # ← allowed at top level
            )
            total_chunks += 1
        except Exception as e:
            print(f"❌ Insert error: {e}")

    cur.execute(
        "REPLACE INTO indexed_files(path, modified) VALUES(?, ?)", (path, mtime)
    )
    conn.commit()

print()
print(f"🚀 Indexed {total_chunks} chunks")
print("Skipped:", skipped)
print("🎯 Done.")

try:
    client.close()
except:
    pass
