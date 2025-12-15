import os
import glob
import math
import re
from typing import List
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

try:
    import fitz as pymupdf
except Exception:
    pymupdf = None

try:
    import docx
except Exception:
    docx = None

import weaviate
from weaviate.collections.classes.config import Property, DataType

# =========================
# RESOLVE REAL USER FOLDERS (ROBUST)
# =========================

USER_HOME = os.path.expanduser("~")

CANDIDATE_ROOTS = [
    os.path.join(USER_HOME, "Documents"),
    os.path.join(USER_HOME, "OneDrive", "Documents"),
    os.path.join(USER_HOME, "Downloads"),
    os.path.join(USER_HOME, "OneDrive", "Downloads"),
    os.path.join(USER_HOME, "Desktop"),
    os.path.join(USER_HOME, "OneDrive", "Desktop"),
    os.path.abspath("docs"),
]

ROOT_FOLDERS = [os.path.realpath(p) for p in CANDIDATE_ROOTS if os.path.exists(p)]

# =========================
# CONFIG
# =========================

CLASS_NAME = "Documents"
ALLOWED_EXT = (".txt", ".pdf", ".docx")

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

MIN_LEN_HIGH = 1
MIN_LEN_MEDIUM = 40
MIN_LEN_LOW = 80

SECRET_KEYWORDS = {
    "password", "passwd", "secret", "token",
    "activation", "credential", "serial"
}

# =========================
# HELPERS
# =========================

def real(p: str) -> str:
    return os.path.realpath(os.path.abspath(p))

def trust_level(path: str) -> str:
    rp = real(path)
    for root in ROOT_FOLDERS:
        if rp.startswith(root):
            if "Documents" in root or root.endswith("docs"):
                return "high"
            if "Downloads" in root:
                return "medium"
    return "low"

def extract_folders(path: str) -> str:
    rp = real(path)
    for root in ROOT_FOLDERS:
        if rp.startswith(root):
            rel = os.path.relpath(os.path.dirname(rp), root)
            parts = re.split(r"[\\/]", rel)
            return " ".join(p.lower() for p in parts if p and p != ".")
    return ""

def is_sensitive(text: str) -> bool:
    lower = text.lower()
    return any(k in lower for k in SECRET_KEYWORDS)

# =========================
# FILE READERS
# =========================

def read_txt(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except:
        return ""

def read_pdf(path):
    if pymupdf is None:
        return ""
    try:
        doc = pymupdf.open(path)
        return "\n".join(p.get_text("text") for p in doc)
    except:
        return ""

def read_docx(path):
    if docx is None:
        return ""
    try:
        d = docx.Document(path)
        return "\n".join(p.text for p in d.paragraphs)
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

# =========================
# CHUNKING
# =========================

def chunk_text(text: str) -> List[str]:
    text = " ".join(text.split())
    if len(text) <= CHUNK_SIZE:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks

# =========================
# MAIN
# =========================

def main():
    print("🔵 Loading embedding model…")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("✅ Model loaded.\n")

    print("🧪 Connecting to Weaviate…")
    client = weaviate.connect_to_local()
    print("✅ Connected.\n")

    print("🧱 Creating schema…")
    client.collections.delete_all()
    client.collections.create(
        name=CLASS_NAME,
        properties=[
            Property(name="file", data_type=DataType.TEXT),
            Property(name="path", data_type=DataType.TEXT),
            Property(name="chunk", data_type=DataType.TEXT),
            Property(name="folders", data_type=DataType.TEXT),
        ],
    )
    col = client.collections.get(CLASS_NAME)
    print("📘 Schema created.\n")

    print("🔍 Index roots:")
    for r in ROOT_FOLDERS:
        print("  •", r)
    print()

    files = []
    for root in ROOT_FOLDERS:
        for ext in ALLOWED_EXT:
            files.extend(glob.glob(os.path.join(root, "**", f"*{ext}"), recursive=True))

    files = sorted(set(real(f) for f in files))
    print(f"📄 Found {len(files)} files.\n")

    stats = {"indexed_chunks": 0, "empty": 0, "filtered": 0}

    for path in tqdm(files, desc="Indexing"):
        text = extract_text(path)
        if not text.strip():
            stats["empty"] += 1
            continue

        level = trust_level(path)
        min_len = MIN_LEN_HIGH if level == "high" else MIN_LEN_MEDIUM if level == "medium" else MIN_LEN_LOW

        folders = extract_folders(path)
        chunks = chunk_text(text)

        safe = []
        for c in chunks:
            if len(c) < min_len:
                continue
            if is_sensitive(c):
                stats["filtered"] += 1
                continue
            safe.append(c)

        if not safe:
            continue

        vectors = model.encode(safe, convert_to_numpy=True)
        for chunk, vec in zip(safe, vectors):
            col.data.insert(
                properties={
                    "file": os.path.basename(path),
                    "path": path,
                    "chunk": chunk,
                    "folders": folders,
                },
                vector=vec.tolist(),
            )
            stats["indexed_chunks"] += 1

    print("\n🚀 Indexing complete")
    print("Stats:", stats)
    client.close()

if __name__ == "__main__":
    main()
