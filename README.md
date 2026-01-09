<p align="center">
  <img src="app-ui/logo/SageNoBG.png" alt="SAGE Logo" width="120" />
</p>

<h1 align="center">🧠 SAGE</h1>
<h3 align="center">Semantic Analysis & Guided Exploration</h3>

<p align="center">
  <strong>A local-first semantic file search engine that understands your documents.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-blue?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Electron-Latest-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Weaviate-4.x-00D1A0?logo=weaviate" alt="Weaviate" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## ✨ What is SAGE?

SAGE is a **privacy-first semantic search engine** for your personal documents. Unlike traditional file search that relies on filenames and keywords, SAGE understands the *meaning* of your content.

**Ask questions like:**
- "Notes about machine learning optimization"
- "Documents discussing project deadlines"
- "Research papers on neural networks"

SAGE finds relevant files even if they don't contain your exact search terms.

---

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| 🔒 **100% Local** | All data stays on your machine. No cloud. No telemetry. |
| 🧠 **Semantic Search** | Finds documents by meaning, not just keywords |
| ⚡ **Hybrid Search** | Combines semantic similarity with keyword matching |
| 📁 **Multi-Format** | Supports TXT, PDF (text & scanned), DOCX |
| 🔄 **Real-Time Sync** | Watches folders and auto-indexes new/changed files |
| 🚀 **Fast Restarts** | Warm start indexing skips unchanged files |
| 🎨 **Modern UI** | Beautiful glassmorphic Electron interface |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SAGE Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌────────────┐  │
│   │   Electron   │────▶│   FastAPI    │────▶│  Weaviate  │  │
│   │   Frontend   │     │   Backend    │     │  Vectors   │  │
│   └──────────────┘     └──────────────┘     └────────────┘  │
│         │                    │                     │         │
│         │              ┌─────┴─────┐               │         │
│         │              │           │               │         │
│         ▼              ▼           ▼               ▼         │
│   ┌──────────┐   ┌──────────┐ ┌──────────┐  ┌──────────┐   │
│   │  React   │   │  SQLite  │ │ Watchdog │  │ Sentence │   │
│   │   UI     │   │  State   │ │ Monitor  │  │Transform │   │
│   └──────────┘   └──────────┘ └──────────┘  └──────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. **Indexing**: Files → Chunking → Embedding → Weaviate
2. **Search**: Query → Embedding → Vector Search → Hybrid Ranking → Results
3. **Sync**: File changes → Watchdog → Incremental update

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Python 3.10+ | Core runtime |
| FastAPI | REST API server |
| Uvicorn | ASGI server |
| sentence-transformers | Embedding model (`all-MiniLM-L6-v2`) |
| Weaviate | Vector database |
| SQLite | Index state management |
| Watchdog | Filesystem monitoring |
| PyMuPDF | PDF extraction |
| python-docx | Word document extraction |
| Tesseract OCR | Scanned PDF fallback |

### Frontend
| Technology | Purpose |
|------------|---------|
| Electron | Desktop app shell |
| React 18 | UI framework |
| Vite | Build tool |
| CSS3 | Custom glassmorphic theme |

---

## 📂 Project Structure

```
SAGE/
├── app.py                 # FastAPI application entry
├── search.py              # Semantic + hybrid search logic
├── index_docs.py          # Document indexer (cold/warm start)
├── indexer_core.py        # Core indexing functions
├── file_watcher.py        # Real-time file monitoring
├── embed_server.py        # Embedding service
├── add_root.py            # CLI: Add folder to index
├── seed_roots.py          # CLI: Seed initial folders
├── start_api.bat          # Windows batch launcher
├── requirements.txt       # Python dependencies
│
├── backend/
│   └── main.py            # Backend module entry
│
├── extractors/            # File content extractors
│
├── app-ui/                # Electron + React frontend
│   ├── electron/          # Electron main/preload
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/           # Backend API client
│   │   ├── components/    # Reusable UI components
│   │   ├── screens/       # App screens
│   │   ├── state/         # Global state management
│   │   └── theme/         # CSS styles
│   ├── logo/              # App icons/logos
│   └── package.json
│
├── weaviate_data/         # Weaviate persistent storage
└── sage_env/              # Python virtual environment
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10 or higher
- Node.js 18+ and npm
- Docker (for Weaviate) OR Weaviate binary
- Tesseract OCR (optional, for scanned PDFs)

### 1. Clone the Repository

```bash
git clone https://github.com/aravndnair/SAGE.git
cd SAGE
```

### 2. Backend Setup

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

### 3. Start Weaviate

Using Docker:
```bash
docker run -d \
  --name weaviate \
  -p 8080:8080 \
  -v weaviate_data:/var/lib/weaviate \
  semitechnologies/weaviate:latest
```

### 4. Frontend Setup

```bash
cd app-ui
npm install
npm run build
```

### 5. Run SAGE

**Terminal 1 - Backend API:**
```bash
python app.py
# or
uvicorn app:app --reload
```

**Terminal 2 - File Watcher (optional):**
```bash
python file_watcher.py
```

**Terminal 3 - Electron App:**
```bash
cd app-ui
npm run electron
```

---

## 📖 Usage Guide

### First Time Setup

1. Launch the app - you'll see the welcome screen
2. Enter your name
3. Go to **Settings** → Add folders to index
4. Click **Save & Index** - SAGE will process your documents
5. Start searching!

### Searching

- Type natural language queries
- Press `Enter` or click **Search**
- Click any result to open the file
- Use `Ctrl+K` to focus the search bar

### Managing Indexed Folders

- **Settings** → Add up to 5 folders
- Remove folders by clicking the ✕ button
- Changes require re-indexing to take effect

### Viewing Search History

- Click **Indexing Logs** in Settings
- View previous search results
- Clear logs when needed

---

## ⚙️ Configuration

### Hybrid Search Tuning

Edit `search.py`:
```python
ENABLE_HYBRID = True      # Enable/disable hybrid mode
SEMANTIC_WEIGHT = 0.8     # Semantic similarity weight
KEYWORD_WEIGHT = 0.2      # Keyword match weight
```

### Supported File Types

| Extension | Support Level |
|-----------|--------------|
| `.txt` | ✅ Full |
| `.pdf` | ✅ Full (text + OCR fallback) |
| `.docx` | ✅ Full |
| `.pptx` | ✅ Full |

---

## 🔧 API Reference

### Base URL
```
http://127.0.0.1:8000
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/status` | Server status |
| `POST` | `/search` | Semantic search |
| `GET` | `/roots` | List indexed folders |
| `POST` | `/roots/add` | Add folder to index |
| `POST` | `/roots/remove` | Remove folder |
| `POST` | `/index` | Trigger indexing |

### Search Request

```json
POST /search
{
  "query": "machine learning notes",
  "top_k": 10
}
```

### Search Response

```json
{
  "results": [
    {
      "file": "ml_notes.pdf",
      "path": "C:\\Documents\\ml_notes.pdf",
      "snippet": "Neural networks are computational models...",
      "similarity": 0.8542,
      "hybrid_score": 0.8834
    }
  ]
}
```

---

## 🎨 UI Screens

| Screen | Description |
|--------|-------------|
| **Welcome** | First-run hello animation |
| **Name Input** | User personalization |
| **Setup Complete** | Celebration with confetti 🎉 |
| **Search** | Main search interface |
| **Settings** | Folder management |
| **Indexing Logs** | Search history |
| **Profile** | User settings |

---

## 🔒 Privacy & Security

- **Zero cloud dependencies** - Everything runs locally
- **No telemetry** - We don't collect any data
- **Your files stay yours** - Documents never leave your machine
- **Open source** - Audit the code yourself

---

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Ensure `python app.py` is running on port 8000
- Check if another process is using the port

### "No results found"
- Verify folders are added in Settings
- Run indexing after adding folders
- Check if files are in supported formats

### "Weaviate connection failed"
- Ensure Weaviate is running (`docker ps`)
- Default port is 8080

### Search input not working
- Restart the Electron app
- Clear indexing logs and try again

---

## 🗺️ Roadmap

- [x] Core semantic search
- [x] Hybrid search (semantic + keyword)
- [x] Real-time file monitoring
- [x] Electron desktop app
- [x] Glassmorphic UI design
- [x] Onboarding flow
- [ ] PowerPoint (.pptx) support
- [ ] Excel (.xlsx) support
- [ ] Search filters & advanced options
- [ ] In-app file preview
- [ ] App packaging & distribution
- [ ] Cross-platform builds (macOS, Linux)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Aravind Nair**

- GitHub: [@aravndnair](https://github.com/aravndnair)

---

## 🙏 Acknowledgments

- [Sentence Transformers](https://www.sbert.net/) for embedding models
- [Weaviate](https://weaviate.io/) for vector database
- [Electron](https://www.electronjs.org/) for desktop framework
- [React](https://react.dev/) for UI framework

---

<p align="center">
  <strong>Built with ❤️ for privacy-conscious users</strong>
</p>

<p align="center">
  <sub>© 2025 Aravind Nair. All rights reserved.</sub>
</p>
