# 🧠 SAGE – Semantic Analysis & Guided Exploration

SAGE is a **local-first semantic file search engine** designed to index personal documents efficiently and search them using semantic similarity — not filenames or keywords alone.

This project is built to be **fast, predictable, and private**:

* Runs entirely on your machine
* No cloud dependency
* No full re-indexing on restart
* Incremental updates in real time

---

## Core Principles (Non‑Negotiable)

SAGE strictly follows these behaviors:

### 1. Cold Start Indexing

* First-ever run on a machine
* Full scan of user-selected folders
* Slow is acceptable (one-time cost)

### 2. Warm Start Indexing

* App restarted later
* **Must be fast**
* Skips unchanged files using SQLite state
* Indexes only new / modified / deleted files

### 3. Live Updates (Runtime)

* Uses filesystem Watchdog
* Detects file add / modify / delete
* Incremental updates only
* No full rescans
* No model reload per event

SQLite is the **source of truth** for file state.
Weaviate stores **only vectors**.

---

## Supported File Types

Currently supported:

* `.txt`
* `.pdf` (text-based)
* `.pdf` (scanned PDFs via OCR fallback)
* `.docx`

Planned:

* `.ppt` / `.pptx`

---

## Tech Stack

### Backend

* Python
* FastAPI
* Uvicorn
* sentence-transformers (`all-MiniLM-L6-v2`, CPU)
* watchdog (filesystem monitoring)
* SQLite (index state)
* PyMuPDF / python-docx / Tesseract OCR

### Vector Database

* Weaviate OSS (v4.x)
* Manual vectors (no built-in vectorizer)

---

## Repository Structure

```
SAGE/
│
├── app.py                 # FastAPI search API
├── search.py              # Semantic search + ranking
├── index_docs.py          # Smart indexer (cold / warm start)
├── file_watcher.py        # Watchdog-based incremental updates
├── embed_server.py        # Embedding service
├── backend/
│   └── main.py            # Backend entry
│
├── app-ui/                # UI / Electron frontend
│   ├── index.html
│   ├── main.js
│   ├── preload.js
│   └── renderer.js
│
├── requirements.txt
├── .gitignore
└── README.md
```

> **Note:**
>
> * Virtual environments, ML models, user documents, and runtime data are intentionally NOT committed.

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/aravndnair/SAGE.git
cd SAGE
```

### 2. Create Virtual Environment

```bash
python -m venv sage_env
sage_env\Scripts\activate   # Windows
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Install External Dependencies

* **Weaviate (local)**

  * Run via Docker or local binary
* **Tesseract OCR** (for scanned PDFs)

  * Add `tesseract` to system PATH

---

## First Run (Indexing)

1. Configure user root folders (one-time)
2. Run the indexer:

```bash
python index_docs.py
```

This performs a **cold start** index.

Subsequent runs will be **fast warm starts**.

---

## Live File Monitoring

Start Watchdog:

```bash
python file_watcher.py
```

Behavior:

* New file → indexed
* Modified file → reindexed
* Deleted file → vectors removed

No full rescans. No restarts required.

---

## Running the Search API

```bash
uvicorn app:app
```

Open Swagger UI:

```
http://127.0.0.1:8000/docs
```

### Example Search Request

```json
POST /search
{
  "query": "resolution and unification",
  "top_k": 5,
  "roots": ["C:\\YourFolder"]
}
```

---

## Design Decisions (Why This Works)

* SQLite guarantees deterministic indexing state
* Weaviate handles only vector similarity
* Indexing is decoupled from search
* OCR is fallback-only to avoid unnecessary cost
* No background magic — behavior is predictable

---

## Project Status

✅ Backend indexing **locked and complete**
✅ Incremental updates verified
✅ Deletion handling verified
🚧 UI / Electron polish in progress

---

## License

MIT License

---

## Author

Aravind Nair

This project prioritizes **correctness first, polish second**.
