<p align="center">
  <img src="app-ui/logo/SageNoBG.png" alt="SAGE Logo" width="150" />
</p>

<h1 align="center">SAGE</h1>
<h3 align="center">Semantic Analysis & Guided Exploration</h3>

<p align="center">
  <strong>Your personal AI-powered semantic search engine for local documents</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Electron-Latest-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Weaviate-4.x-00D1A0?style=for-the-badge&logo=weaviate&logoColor=white" alt="Weaviate" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Platform-Windows%20|%20macOS%20|%20Linux-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Status-Active-success?style=flat-square" alt="Status" />
</p>

---

## 📖 Table of Contents

- [About](#-about)
- [Screenshots](#-screenshots)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Configuration](#-configuration)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 About

**SAGE** (Semantic Analysis & Guided Exploration) is a **privacy-first, locally-hosted semantic search engine** designed to help you find documents based on meaning rather than exact keywords.

### The Problem

Traditional file search is frustrating:
- You need to remember exact filenames or keywords
- Searching "heart tests" won't find documents about "cardiac examinations"
- Important files get buried and forgotten

### The Solution

SAGE uses **AI-powered semantic understanding** to:
- Find documents by **meaning**, not just keywords
- Understand context and synonyms automatically
- Keep everything **100% local** — your data never leaves your machine

### Example Queries

| What You Search | What SAGE Finds |
|-----------------|-----------------|
| "heart health documents" | Cardiac care presentations, ECG reports, medical PDFs |
| "project deadline notes" | Meeting minutes, task lists, project timelines |
| "machine learning research" | Neural network papers, AI tutorials, ML notes |

---

## 📸 Screenshots

<p align="center">
  <img src="screenshots/search-results.png" alt="Search Results" width="800" />
  <br />
  <em>🔍 Semantic search in action — finding cardiac care documents from the query "echocardiogram"</em>
</p>

<p align="center">
  <img src="screenshots/directory-management.png" alt="Directory Management" width="800" />
  <br />
  <em>⚙️ Directory Management — configure up to 5 folders for SAGE to monitor and index</em>
</p>

<p align="center">
  <img src="screenshots/search-loading.png" alt="Search Interface" width="800" />
  <br />
  <em>✨ Modern glassmorphic UI with smooth animations and loading states</em>
</p>

---

## ✨ Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| 🧠 **Semantic Search** | AI-powered search that understands meaning, context, and synonyms |
| ⚡ **Hybrid Ranking** | Combines semantic similarity (80%) with keyword matching (20%) for optimal results |
| 🔒 **100% Local** | All processing happens on your machine — zero cloud dependencies |
| 📁 **Multi-Format Support** | Index TXT, PDF, DOCX, and PPTX files |
| 🔄 **Real-Time Monitoring** | Watchdog integration auto-indexes new and modified files |
| 🚀 **Incremental Indexing** | Smart caching skips unchanged files for fast re-indexing |
| 🖼️ **OCR Support** | Extract text from scanned PDFs using Tesseract OCR |
| 🎨 **Modern UI** | Beautiful glassmorphic Electron desktop application |

### Privacy & Security

- **Zero telemetry** — We don't collect any data
- **No cloud uploads** — Documents are processed entirely on your device
- **Open source** — Audit every line of code yourself
- **SQLite storage** — Lightweight local database for state management

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SAGE Architecture                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌─────────────────┐                      ┌─────────────────┐         │
│    │   Electron App  │◀────── HTTP ────────▶│   FastAPI       │         │
│    │   (React UI)    │      REST API        │   Backend       │         │
│    └─────────────────┘                      └────────┬────────┘         │
│                                                      │                   │
│                          ┌───────────────────────────┼───────────────┐  │
│                          │                           │               │  │
│                          ▼                           ▼               ▼  │
│                   ┌─────────────┐            ┌─────────────┐  ┌────────┐│
│                   │   SQLite    │            │  Weaviate   │  │Watchdog││
│                   │   State DB  │            │  Vectors    │  │Monitor ││
│                   └─────────────┘            └─────────────┘  └────────┘│
│                                                      │                   │
│                                                      ▼                   │
│                                              ┌─────────────┐            │
│                                              │  Sentence   │            │
│                                              │ Transformers│            │
│                                              │ (MiniLM-L6) │            │
│                                              └─────────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Indexing Pipeline**
   ```
   Files → Text Extraction → Chunking (1000 chars) → Embedding → Weaviate Storage
   ```

2. **Search Pipeline**
   ```
   Query → Embedding → Vector Search → Hybrid Scoring → Ranked Results
   ```

3. **Real-Time Sync**
   ```
   File Change → Watchdog Detection → Debounce (3s) → Incremental Re-index
   ```

---

## 🛠️ Tech Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11+ | Core runtime |
| **FastAPI** | 0.110.0 | High-performance REST API |
| **Uvicorn** | 0.29.0 | ASGI server |
| **Weaviate** | 4.18.3 | Vector database for semantic search |
| **Sentence Transformers** | 2.6.1 | Embedding model (`all-MiniLM-L6-v2`) |
| **PyTorch** | 2.2.2 | Deep learning framework |
| **SQLite** | Built-in | State management & caching |
| **Watchdog** | 4.0.0 | Filesystem monitoring |
| **PyMuPDF** | 1.23.26 | PDF text extraction |
| **python-docx** | 1.1.0 | Word document extraction |
| **python-pptx** | 1.0.2 | PowerPoint extraction |
| **Pytesseract** | 0.3.13 | OCR for scanned documents |

### Frontend

| Technology | Purpose |
|------------|---------|
| **Electron** | Cross-platform desktop shell |
| **React 18** | Modern UI framework |
| **Vite** | Fast build tooling |
| **CSS3** | Custom glassmorphic design system |

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.11+ | [Download](https://www.python.org/downloads/) |
| Node.js | 18+ | [Download](https://nodejs.org/) |
| Docker | Latest | [Download](https://www.docker.com/) — for Weaviate |
| Tesseract | Optional | [Install Guide](https://github.com/tesseract-ocr/tesseract) — for OCR |

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/aravndnair/SAGE.git
cd SAGE
```

#### 2. Set Up Python Environment

```bash
# Create virtual environment
python -m venv sage_env

# Activate (Windows)
sage_env\Scripts\activate

# Activate (macOS/Linux)
source sage_env/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 3. Start Weaviate (Docker)

**macOS / Linux:**
```bash
docker run -d \
  --name weaviate \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 50051:50051 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -e PERSISTENCE_DATA_PATH=/var/lib/weaviate \
  -e CLUSTER_HOSTNAME=node1 \
  cr.weaviate.io/semitechnologies/weaviate:latest
```

**Windows (PowerShell):**
```powershell
docker run -d --name weaviate --restart unless-stopped -p 8080:8080 -p 50051:50051 -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true -e PERSISTENCE_DATA_PATH=/var/lib/weaviate -e CLUSTER_HOSTNAME=node1 cr.weaviate.io/semitechnologies/weaviate:latest
```

#### 4. Set Up Frontend

```bash
cd app-ui
npm install
```

#### 5. Launch SAGE

**Option A: Development Mode (Two Terminals)**

```bash
# Terminal 1 - Backend API
python backend/main.py

# Terminal 2 - Electron App
cd app-ui
npm start
```

**Option B: Windows Quick Start**

```bash
start_api.bat
```

---

## 📖 Usage

### First-Time Setup

1. **Launch SAGE** — Open the Electron app
2. **Welcome Screen** — Enter your name for personalization
3. **Add Folders** — Go to Settings → Add up to 5 directories
4. **Index Documents** — Click "Save Changes" to start indexing
5. **Search** — Start finding documents semantically!

### Search Tips

| Tip | Example |
|-----|---------|
| Use natural language | "documents about quarterly sales" |
| Ask questions | "what are the project requirements?" |
| Be descriptive | "research papers on machine learning optimization" |
| Use domain terms | "cardiac care nursing procedures" |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Execute search |
| `Ctrl + K` | Focus search bar |
| `Escape` | Clear search |

---

## 🔌 API Reference

### Base URL

```
http://127.0.0.1:8000
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check — returns API status |
| `GET` | `/status` | Detailed server status with indexing state |
| `GET` | `/roots` | List all monitored directories |
| `POST` | `/roots/add` | Add a directory to monitor |
| `POST` | `/roots/remove` | Remove a directory from monitoring |
| `POST` | `/index` | Trigger manual re-indexing |
| `POST` | `/search` | Perform semantic search |

### Search Request

```bash
curl -X POST http://127.0.0.1:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning notes", "top_k": 10}'
```

### Search Response

```json
{
  "results": [
    {
      "file": "ml_notes.pdf",
      "path": "C:\\Documents\\ml_notes.pdf",
      "snippet": "Neural networks are computational models inspired by biological neurons...",
      "similarity": 0.8542,
      "folder": "Documents"
    }
  ],
  "query": "machine learning notes",
  "count": 1
}
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEAVIATE_HOST` | `localhost` | Weaviate server hostname |
| `WEAVIATE_PORT` | `8080` | Weaviate REST API port |
| `WEAVIATE_GRPC_PORT` | `50051` | Weaviate gRPC port |

### Search Tuning

Edit `search.py` to adjust hybrid search weights:

```python
SEMANTIC_WEIGHT = 0.8    # Weight for semantic similarity (0-1)
KEYWORD_WEIGHT = 0.2     # Weight for keyword matching (0-1)
```

### Indexing Configuration

Edit `index_docs.py` to customize chunking:

```python
CHUNK_SIZE = 1000        # Characters per chunk
CHUNK_OVERLAP = 200      # Overlap between chunks
MIN_CHUNK_LEN = 40       # Minimum chunk length
```

### Supported File Types

| Extension | Support | Notes |
|-----------|---------|-------|
| `.txt` | ✅ Full | Plain text files |
| `.pdf` | ✅ Full | Text + OCR fallback for scanned pages |
| `.docx` | ✅ Full | Microsoft Word documents |
| `.pptx` | ✅ Full | PowerPoint presentations |

---

## 🔧 Troubleshooting

### Common Issues

<details>
<summary><strong>❌ "Weaviate connection failed"</strong></summary>

**Cause:** Weaviate Docker container is not running.

**Solution:**
```bash
# Check if container exists
docker ps -a --filter "name=weaviate"

# Start existing container
docker start weaviate

# Or create new container (see Getting Started)
```
</details>

<details>
<summary><strong>❌ "Could not find class Documents in schema"</strong></summary>

**Cause:** Weaviate is running but no documents have been indexed yet.

**Solution:**
1. Add folders in Settings
2. Click "Save Changes" to trigger indexing
3. Or manually run: `python index_docs.py`
</details>

<details>
<summary><strong>❌ "Database is locked"</strong></summary>

**Cause:** Multiple processes trying to access SQLite simultaneously.

**Solution:** This is automatically handled with a 30-second timeout. If it persists:
1. Stop all SAGE processes
2. Delete `index_state.db`
3. Restart the backend
</details>

<details>
<summary><strong>❌ "No results found"</strong></summary>

**Possible causes:**
1. No folders added for indexing
2. Indexing hasn't completed
3. Files are not in supported formats

**Solution:**
1. Check Settings → Verify folders are added
2. Check Indexing Logs → Wait for completion
3. Ensure files are `.txt`, `.pdf`, `.docx`, or `.pptx`
</details>

<details>
<summary><strong>❌ NumPy compatibility error</strong></summary>

**Cause:** NumPy 2.x incompatibility with sentence-transformers.

**Solution:**
```bash
pip install "numpy<2"
```
</details>

---

## 🗺️ Roadmap

### Completed ✅

- [x] Core semantic search engine
- [x] Hybrid search (semantic + keyword)
- [x] Real-time file monitoring with Watchdog
- [x] Electron desktop application
- [x] Glassmorphic UI design
- [x] User onboarding flow
- [x] PDF, DOCX, TXT support
- [x] PowerPoint (PPTX) support
- [x] OCR for scanned documents
- [x] Incremental indexing
- [x] Multi-directory support (up to 5)

### Planned 🚧

- [ ] Excel (.xlsx) support
- [ ] Markdown (.md) support
- [ ] Advanced search filters (date, type, folder)
- [ ] In-app file preview
- [ ] Search history persistence
- [ ] Indexing progress bar in UI
- [ ] Auto-updater
- [ ] macOS and Linux builds
- [ ] Installer packages (.exe, .dmg, .AppImage)

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit** your changes
   ```bash
   git commit -m "Add amazing feature"
   ```
4. **Push** to your branch
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open** a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use meaningful commit messages
- Add comments for complex logic
- Test changes before submitting PR

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025-2026 Aravind Nair

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

---

## 👤 Author

<p align="center">
  <strong>Aravind Nair</strong>
  <br />
  <a href="https://github.com/aravndnair">
    <img src="https://img.shields.io/badge/GitHub-aravndnair-181717?style=for-the-badge&logo=github" alt="GitHub" />
  </a>
</p>

---

## 🙏 Acknowledgments

- [Sentence Transformers](https://www.sbert.net/) — State-of-the-art embeddings
- [Weaviate](https://weaviate.io/) — Open-source vector database
- [FastAPI](https://fastapi.tiangolo.com/) — Modern Python web framework
- [Electron](https://www.electronjs.org/) — Cross-platform desktop apps
- [React](https://react.dev/) — UI component library

---

<p align="center">
  <img src="app-ui/logo/SageNoBG.png" alt="SAGE" width="60" />
  <br />
  <strong>Built with ❤️ for privacy-conscious users</strong>
  <br />
  <sub>© 2025-2026 Aravind Nair. All rights reserved.</sub>
</p>
