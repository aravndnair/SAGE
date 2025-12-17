import os
import glob
import time
import sqlite3
from typing import List

from sentence_transformers import SentenceTransformer
import weaviate
from weaviate.collections.classes.config import Property, DataType, Configure
from weaviate.collections.classes.filters import Filter

# ---------------- CONFIG ----------------

CLASS_NAME = "Documents"
INDEX_DB = "index_state.db"

ALLOWED_EXT = (".txt", ".pdf", ".docx", ".ppt", ".pptx")

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MIN_CHUNK_LEN = 40

# ----------------------------------------


# -------- FILE READERS --------

def read_txt(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except:
        return ""


def extract_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".txt":
        return read_txt(path)
    return ""


# -------- CHUNKING --------

def chunk_text(text: str) -> List[str]:
    text = " ".join(text.split())
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_LEN:
            chunks.append(chunk)
        start = end - CHUNK_OVERLAP
    return chunks


# -------- SQLITE --------

def init_db():
    conn = sqlite3.connect(INDEX_DB)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS indexed_files (
            path TEXT PRIMARY KEY,
            mtime REAL NOT NULL,
            size INTEGER NOT NULL,
            indexed_at REAL NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_roots (
            path TEXT PRIMARY KEY
        )
    """)

    conn.commit()
    return conn


def load_user_roots(cur):
    cur.execute("SELECT path FROM user_roots")
    return [row[0] for row in cur.fetchall()]


# -------- MAIN INDEXER --------

def main():
    print("🔵 Loading embedding model…")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("✅ Model loaded")

    print("🧪 Connecting to Weaviate…")
    client = weaviate.connect_to_local()
    print("✅ Connected")

    print("🧱 Ensuring schema…")
    if CLASS_NAME not in client.collections.list_all():
        client.collections.create(
            name=CLASS_NAME,
            properties=[
                Property(name="file", data_type=DataType.TEXT),
                Property(name="path", data_type=DataType.TEXT),
                Property(name="chunk", data_type=DataType.TEXT),
            ],
            vector_config=Configure.Vectors.none(),
        )
        print("📘 Schema created")
    else:
        print("📘 Schema already exists")

    collection = client.collections.get(CLASS_NAME)

    conn = init_db()
    cur = conn.cursor()

    roots = load_user_roots(cur)
    if not roots:
        print("⚠️ No user roots configured. Indexer exiting.")
        conn.close()
        client.close()
        return

    print(f"📂 Using {len(roots)} user-defined roots")

    all_files = set()
    for root in roots:
        if not os.path.exists(root):
            continue
        for ext in ALLOWED_EXT:
            pattern = os.path.join(root, "**", f"*{ext}")
            for f in glob.glob(pattern, recursive=True):
                all_files.add(os.path.abspath(f))

    print(f"📄 Found {len(all_files)} files")

    cur.execute("SELECT path, mtime, size FROM indexed_files")
    known = {row[0]: (row[1], row[2]) for row in cur.fetchall()}

    to_index = []
    for path in all_files:
        try:
            stat = os.stat(path)
        except:
            continue

        if path not in known:
            to_index.append(path)
        else:
            old_mtime, old_size = known[path]
            if stat.st_mtime != old_mtime or stat.st_size != old_size:
                to_index.append(path)

    deleted = set(known.keys()) - all_files

    print(f"➕ New/changed files: {len(to_index)}")
    print(f"➖ Deleted files: {len(deleted)}")

    # -------- DELETE REMOVED FILES --------

    for path in deleted:
        collection.data.delete_many(
            where=Filter.by_property("path").equal(path)
        )
        cur.execute("DELETE FROM indexed_files WHERE path=?", (path,))

    # -------- INDEX NEW / CHANGED FILES --------

    for path in to_index:
        text = extract_text(path)
        if not text.strip():
            continue

        chunks = chunk_text(text)
        if not chunks:
            continue

        vectors = model.encode(chunks)

        collection.data.delete_many(
            where=Filter.by_property("path").equal(path)
        )

        for chunk, vec in zip(chunks, vectors):
            collection.data.insert(
                properties={
                    "file": os.path.basename(path),
                    "path": path,
                    "chunk": chunk,
                },
                vector=vec.tolist(),
            )

        stat = os.stat(path)
        cur.execute(
            "REPLACE INTO indexed_files VALUES (?, ?, ?, ?)",
            (path, stat.st_mtime, stat.st_size, time.time())
        )

    conn.commit()
    conn.close()
    client.close()

    print("🚀 Indexing complete")


if __name__ == "__main__":
    main()
