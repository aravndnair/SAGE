import os
import time
import sqlite3
from tqdm import tqdm
import glob
import winreg
import weaviate
import fitz  # PyMuPDF for PDFs
import docx  # python-docx
from sentence_transformers import SentenceTransformer

COLLECTION_NAME = "Documents"
DB_PATH = "index_state.db"

client = weaviate.Client("http://localhost:8080")
model = SentenceTransformer("all-MiniLM-L6-v2")


# --- Load Only Real Text ---
def load_text(path):
    ext = path.lower().split(".")[-1]

    try:
        if ext == "txt":
            return open(path, "r", encoding="utf-8", errors="ignore").read()

        elif ext == "pdf":
            doc = fitz.open(path)
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            return text

        elif ext == "docx":
            document = docx.Document(path)
            return "\n".join(p.text for p in document.paragraphs)

        else:
            return ""
    except:
        return ""


# --- Local DB for timestamps ---
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS indexed_files (
    path TEXT PRIMARY KEY,
    modified REAL
)
""")
conn.commit()


def get_modified(path):
    return os.path.getmtime(path)


# --- Create Weaviate Schema if not exists ---
def ensure_schema():
    schema = client.schema.get()
    if COLLECTION_NAME not in [c["class"] for c in schema.get("classes", [])]:
        print("📦 Creating Weaviate collection...")
        client.schema.create_class({
            "class": COLLECTION_NAME,
            "properties": [
                {"name": "file", "dataType": ["text"]},
                {"name": "path", "dataType": ["text"]},
                {"name": "content", "dataType": ["text"]}
            ]
        })


# --- Index into Weaviate ---
def index_file(path):
    text = load_text(path).strip()
    if not text:
        return

    embedding = model.encode(text).tolist()
    client.data_object.create({
        "file": os.path.basename(path),
        "path": os.path.abspath(path),
        "content": text[:5000]  # store 5K chars max
    }, COLLECTION_NAME, vector=embedding)


# --- Detect Windows user file locations ---
def get_folder(name):
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
        )
        val, _ = winreg.QueryValueEx(key, name)
        return val
    except:
        return None


SEARCH_DIRS = [
    get_folder("Personal"),  # Documents
    get_folder("Desktop"),  # Desktop
    "docs"  # Local test folder
]

ALLOWED_EXT = (".txt", ".pdf", ".docx")


# --- Main Process ---
def scan_and_index():
    ensure_schema()
    files = []

    print("🔍 Searching folders:")
    for d in SEARCH_DIRS:
        if d and os.path.exists(d):
            print("  •", d)
            for ext in ALLOWED_EXT:
                files.extend(glob.glob(os.path.join(d, f"**/*{ext}"), recursive=True))

    print(f"\n📄 Found {len(files)} file(s) to check\n")

    updated = 0
    for file in tqdm(files):
        mtime = get_modified(file)
        cursor.execute("SELECT modified FROM indexed_files WHERE path=?", (file,))
        row = cursor.fetchone()

        if not row or row[0] != mtime:
            index_file(file)
            cursor.execute("REPLACE INTO indexed_files VALUES (?, ?)", (file, mtime))
            updated += 1

    conn.commit()
    print(f"\n🚀 Indexed {updated} new/changed file(s)")


scan_and_index()
conn.close()
print("🎯 Done!")
