import os
import PyPDF2
from docx import Document
from sentence_transformers import SentenceTransformer
import weaviate
import json
from tqdm import tqdm

# ========================
# CONFIGURATION
# ========================
DATA_DIR = "documents"  # Folder containing your PDF/DOCX files
WEAVIATE_URL = "http://localhost:8080"

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Load embedding model
print("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')

# Connect to Weaviate
client = weaviate.Client(WEAVIATE_URL)
print("Connected to Weaviate")

# Define schema (if not exists)
def create_schema():
    schema = {
        "classes": [
            {
                "class": "Document",
                "description": "Personal document with content, title, author, subject",
                "vectorizer": "none",  # We provide our own vectors
                "properties": [
                    {"name": "filename", "dataType": ["string"]},
                    {"name": "title", "dataType": ["string"]},
                    {"name": "author", "dataType": ["string"]},
                    {"name": "subject", "dataType": ["string"]},
                    {"name": "content", "dataType": ["text"]},
                ]
            }
        ]
    }

    # Delete class if exists (for fresh start)
    if client.schema.exists("Document"):
        client.schema.delete_class("Document")

    client.schema.create(schema)
    print("Schema created.")

# ========================
# TEXT EXTRACTION
# ========================
def extract_text(filepath):
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    if ext == ".pdf":
        with open(filepath, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            return " ".join([page.extract_text() for page in reader.pages])
    elif ext == ".docx":
        doc = Document(filepath)
        return " ".join(paragraph.text for paragraph in doc.paragraphs)
    else:
        return ""

# ========================
# PREPROCESSING
# ========================
def preprocess_text(text):
    # Simple cleaning
    import re
    text = re.sub(r'\s+', ' ', text)  # Remove extra whitespace
    return text.strip().lower()

# ========================
# METADATA EXTRACTION (basic)
# ========================
def extract_metadata(filepath):
    filename = os.path.basename(filepath)
    title = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").title()
    return {
        "filename": filename,
        "title": title,
        "author": "Unknown",
        "subject": "General"
    }

# ========================
# INGEST DOCUMENTS
# ========================
def ingest_documents():
    files = [os.path.join(DATA_DIR, f) for f in os.listdir(DATA_DIR) if f.endswith((".pdf", ".docx"))]
    print(f"Found {len(files)} documents. Ingesting...")

    with client.batch as batch:
        batch.batch_size = 10
        for filepath in tqdm(files):
            text = extract_text(filepath)
            if not text:
                continue

            text = preprocess_text(text)
            metadata = extract_metadata(filepath)

            # Generate embedding
            embedding = model.encode(text).tolist()

            # Add to Weaviate
            client.batch.add_data_object(
                data_object=metadata,
                class_name="Document",
                vector=embedding
            )

    print("✅ All documents ingested into Weaviate!")

# ========================
# SEARCH FUNCTION
# ========================
def semantic_search(query, top_k=5):
    print(f"\n🔍 Searching for: '{query}'")
    query_vec = model.encode(query).tolist()

    result = (
        client.query
        .get("Document", ["filename", "title", "author", "subject", "content"])
        .with_near_vector({"vector": query_vec})
        .with_limit(top_k)
        .do()
    )

    print("\n📄 Top Results:")
    if "data" not in result or not result["data"]["Get"]["Document"]:
        print("No results found.")
        return

    for i, doc in enumerate(result["data"]["Get"]["Document"], 1):
        print(f"{i}. [{doc.get('title')}] ({doc.get('filename')})")
        print(f"   Author: {doc.get('author')}, Subject: {doc.get('subject')}")
        preview = doc.get("content", "")[:200] + "..." if len(doc.get("content", "")) > 200 else doc.get("content")
        print(f"   Preview: {preview}\n")

# ========================
# MAIN
# ========================
if __name__ == "__main__":

    create_schema()


    ingest_documents()

semantic_search("What is the law of demand?")
semantic_search("Explain production possibility curve")
semantic_search("What are the types of firms?")
semantic_search("Define elasticity of demand")