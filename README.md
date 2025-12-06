# 🧠 SAGE – Semantic Analysis & Guided Exploration

uvicorn app:app --reload --port 8000
npm start(in app-ui) 

SAGE is an offline semantic file search system built using:
- **SentenceTransformers** for local embeddings
- **Weaviate** as the vector database (Docker)
- **FastAPI** backend for semantic search API
- **Electron** desktop frontend for UI

All indexing and searching happen **locally** — No cloud. No data leaves your system.

---

## 🚀 Features
- Semantic search across PDF / DOCX / TXT files
- Local embeddings stored in Weaviate (Docker)
- Incremental indexing (only new/modified files are processed)
- Multi-file result ranking with similarity%
- Clean desktop UI built using Electron

---

## 📦 Installation (Development Setup)

### 1️⃣ Install Dependencies
Make sure these are installed on the machine:

| Requirement | Download |
|------------|----------|
| Python 3.10+ | https://www.python.org/downloads/ |
| Docker Desktop | https://www.docker.com/products/docker-desktop |
| Node.js + npm | https://nodejs.org/ |

---

### 2️⃣ Clone the project

```sh
git clone <your_repo_url>
cd semantic_file_search
