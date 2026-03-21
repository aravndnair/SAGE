# SAGE

Semantic Analysis and Guided Exploration (SAGE) is a fully local desktop semantic search system.

This README is a full technical reference of the current codebase. It is intentionally detailed and based on the files that exist in this repository right now.

## 1. What SAGE Is

SAGE indexes local documents into vector embeddings and lets users search by meaning.

It consists of:
- A Python FastAPI backend that orchestrates indexing and search.
- An indexer that extracts text, chunks it, creates embeddings, and stores vectors in Weaviate.
- A search engine that combines semantic similarity, fuzzy keyword logic, optional re-ranking, and snippet extraction.
- An Electron + React desktop UI that manages onboarding, root folders, search, settings, and log/history views.

All data processing is local:
- SQLite stores indexing state and user root folders.
- Weaviate stores vectorized chunks.
- HuggingFace models are configured to run in offline mode.

## 2. Repository Structure and What Each File Does

Top-level Python files:
- `backend/main.py`: FastAPI app, lifecycle hooks, API endpoints, watchdog integration, background indexing trigger.
- `index_docs.py`: End-to-end indexing pipeline.
- `search.py`: End-to-end search pipeline.
- `requirements.txt`: Python dependencies.

Desktop app and frontend:
- `app-ui/package.json`: frontend scripts and dependencies.
- `app-ui/vite.config.js`: Vite build config.
- `app-ui/index.html`: root HTML shell.
- `app-ui/electron/main.cjs`: Electron process for dev mode (`loadURL("http://localhost:5173")`).
- `app-ui/electron/preload.cjs`: Electron preload bridge used by `electron/main.cjs`.
- `app-ui/main.js`: Electron process for packaged mode (`loadFile("dist/index.html")`).
- `app-ui/preload.js`: Alternate preload bridge paired with `app-ui/main.js`.
- `app-ui/renderer.js`: Legacy DOM-based renderer script.

React source:
- `app-ui/src/main.jsx`: React bootstrap and provider wiring.
- `app-ui/src/App.jsx`: screen router and screen transition stack.
- `app-ui/src/state/appState.jsx`: central app context, localStorage integration, screen state, search/log persistence.
- `app-ui/src/api/backend.js`: HTTP client for backend endpoints.
- `app-ui/src/animations/transitions.js`: simple fade preset export.
- `app-ui/src/components/Loader.jsx`: empty file currently.
- `app-ui/src/components/ResultCard.jsx`: reusable search result display card.
- `app-ui/src/components/SearchBar.jsx`: search input and submit UI.
- `app-ui/src/screens/Welcome.jsx`: first-run hello splash.
- `app-ui/src/screens/NameInput.jsx`: user name capture screen.
- `app-ui/src/screens/SetupComplete.jsx`: onboarding completion screen with confetti.
- `app-ui/src/screens/Search.jsx`: main search interface.
- `app-ui/src/screens/Settings.jsx`: root directory management and acknowledgement flow.
- `app-ui/src/screens/IndexingLogs.jsx`: persisted search history viewer.
- `app-ui/src/screens/Profile.jsx`: user profile display screen.
- `app-ui/src/theme/theme.css`: full visual design system and screen styling.

## 3. Backend Module: `backend/main.py` (Detailed)

### 3.1 Environment and imports
- Sets `HF_HUB_OFFLINE=1` before model imports, forcing offline hub behavior.
- Imports FastAPI, Pydantic, Uvicorn, SQLite, threading, watchdog.
- Adds the repository root to `sys.path` so it can import `search.py` and `index_docs.py` from parent directory.

### 3.2 Config constants
- `INDEX_DB = "index_state.db"`.
- `SENSITIVE_WORDS` contains specific phrase filters (`password`, `license key`, etc.).
- `ALLOWED_EXT` supports `.txt`, `.pdf`, `.docx`, `.ppt`, `.pptx`.

### 3.3 Global runtime state
- `indexing_in_progress`: boolean flag exposed to APIs.
- `indexing_lock`: non-blocking lock to prevent overlapping indexing runs.
- `watchdog_observer`: singleton observer instance.
- `last_watchdog_trigger` and `WATCHDOG_DEBOUNCE_SECONDS=3` for event debounce.

### 3.4 Lifespan startup/shutdown
At startup:
1. Initializes DB tables via `index_docs.init_db()`.
2. Cleans duplicate root entries via `cleanup_duplicate_roots()`.
3. Starts watchdog monitoring via `start_watchdog()`.

At shutdown:
1. Stops watchdog via `stop_watchdog()`.

### 3.5 DB helper functions
- `get_db_connection()`: sqlite connection with timeout 30s.
- `normalize_path(path)`: absolute path + trailing slash normalization.
- `get_user_roots()`: returns all `user_roots.path`.
- `add_user_root(path)`: validates existence, deduplicates, inserts.
- `remove_user_root(path)`: deletes root by normalized path.
- `cleanup_duplicate_roots()`: SQL dedupe preserving minimum rowid per path.

### 3.6 Background indexing trigger path
`run_indexing_background()`:
1. Tries lock acquire non-blocking.
2. If lock unavailable: prints skip and exits.
3. Resets indexing progress (`index_docs.reset_progress()`).
4. Sets `indexing_in_progress=True`.
5. Calls full `index_docs.main()`.
6. Calls `invalidate_vocabulary()` from `search.py` so fuzzy vocabulary cache refreshes post-index.
7. In `finally`: sets `indexing_in_progress=False` and releases lock.

### 3.7 Watchdog event handling
`SageEventHandler`:
- `on_created`, `on_modified`, `on_deleted`:
  - ignore directories.
  - normalize absolute path.
  - ignore disallowed extensions.
  - call shared `handle_event(action, path)`.

`handle_event`:
1. ignores temp files prefixed `~$`.
2. applies debounce window (3 seconds) globally.
3. logs event.
4. starts background thread to `run_indexing_background`.

Important behavior:
- Event path is not passed into indexer as a targeted operation.
- Any accepted file event triggers a full indexing reconciliation pass.

### 3.8 Watchdog lifecycle functions
- `start_watchdog()`:
  - loads roots from DB.
  - if none, warns and returns.
  - if already started, returns.
  - creates observer and schedules recursive watches for existing roots.
- `stop_watchdog()` stops/join observer safely.
- `restart_watchdog()` calls stop then start.

### 3.9 FastAPI endpoints
- `GET /`: health + `indexing` flag.
- `GET /roots`: dedupe then return root list.
- `POST /roots/add`:
  - validates path exists and is dir.
  - inserts root.
  - restarts watchdog.
- `POST /roots/remove`:
  - removes root.
  - restarts watchdog.
- `POST /index`:
  - rejects if already indexing.
  - rejects if no roots.
  - starts background indexing thread.
- `GET /status`:
  - returns indexing flag, root count, indexed file count.
- `GET /index/progress`:
  - returns `index_docs.indexing_progress` with computed percentage.
- `POST /search`:
  - validates query.
  - checks roots exist.
  - hard caps `top_k` to max 5 (even if request asks higher).
  - calls `semantic_search(query, top_k)`.
  - filters snippets if they match sensitive words.
  - formats output fields used by frontend.

### 3.10 Sensitive filtering behavior
`is_sensitive_text(text)` lowercases and checks any sensitive phrase substring match.
If matched, result is omitted from API response.

### 3.11 Server start
When run directly: `uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)`.

## 4. Indexing Module: `index_docs.py` (Detailed)

### 4.1 Core role
Performs full indexing reconciliation:
- discovers all supported files under configured roots,
- computes new/changed/deleted sets,
- updates Weaviate vectors and SQLite state.

### 4.2 Constants and progress state
- `CLASS_NAME = "Documents"` in Weaviate.
- `INDEX_DB = "index_state.db"`.
- `ALLOWED_EXT` same as backend.
- `indexing_progress` dict:
  - `total_files`, `processed_files`, `current_file`, `phase`.
- chunk params:
  - `CHUNK_SIZE=1000`, `CHUNK_OVERLAP=200`, `MIN_CHUNK_LEN=40`.
- OCR params:
  - `ENABLE_OCR=True`, `OCR_WORD_THRESHOLD=50`, `OCR_MAX_PAGES=5`.

### 4.3 File readers
- `read_txt(path)`:
  - UTF-8 read with `errors="ignore"`.
- `read_pdf(path)`:
  - first pass: PyMuPDF text extraction.
  - if extracted words < 50 and OCR enabled:
    - rasterizes up to 5 pages at 300 DPI,
    - OCR via pytesseract,
    - early stops if OCR text reaches threshold.
  - combines extracted + OCR text.
- `read_docx(path)`:
  - concatenates non-empty paragraph text.
- `read_pptx(path)`:
  - iterates slides/shapes/text frames/paragraphs.
- `extract_text(path)` dispatches by extension.

### 4.4 Chunking
`chunk_text(text)`:
1. normalizes whitespace to single spaces.
2. slices by fixed character window.
3. keeps chunks only if length >= 40.
4. uses overlap by setting `start = end - CHUNK_OVERLAP`.

### 4.5 SQLite schema initialization
`init_db()` ensures:
- `indexed_files(path PRIMARY KEY, mtime REAL, size INTEGER, indexed_at REAL)`.
- `user_roots(path PRIMARY KEY)`.

### 4.6 Main indexing flow (`main()`)
1. loads sentence transformer model (`all-MiniLM-L6-v2`).
2. connects to Weaviate local instance.
3. creates collection schema if missing with properties:
   - `file` (TEXT)
   - `path` (TEXT)
   - `chunk` (TEXT)
   - vectorizer set to `none` (manual vectors supplied).
4. opens SQLite and loads user roots.
5. if no roots:
   - reset progress,
   - close db/client,
   - return.
6. scanning phase:
   - recursively glob all roots by extension,
   - stores normalized absolute paths in `all_files` set.
7. loads known indexed files from sqlite (`path, mtime, size`).
8. computes:
   - `to_index`: new or modified files (mtime or size diff).
   - `deleted`: known paths not present in filesystem scan.
9. updates `indexing_progress` to indexing phase.
10. for each `deleted` path:
    - delete matching objects from Weaviate (`Filter.by_property("path").equal(path)`).
    - delete from sqlite `indexed_files`.
11. for each file in `to_index`:
    - update progress fields.
    - extract text, skip if empty.
    - chunk text, skip if no valid chunks.
    - embed chunks with model.
    - delete old chunks for same file path in Weaviate.
    - insert each chunk with vector + metadata.
    - REPLACE sqlite row with current stat + timestamp.
12. commit sqlite, close sqlite and Weaviate client.
13. mark progress phase `complete` and set processed to total.

### 4.7 Progress reset
`reset_progress()` sets totals to zero and phase `idle`.

## 5. Search Module: `search.py` (Detailed)

### 5.1 Core role
Provides semantic search with optional hybrid scoring and optional cross-encoder re-ranking.

### 5.2 Configuration
- `CLASS_NAME="Documents"`, `EMBED_MODEL="all-MiniLM-L6-v2"`, `INDEX_DB`.
- Hybrid:
  - `ENABLE_HYBRID=True`
  - `SEMANTIC_WEIGHT=0.8`
  - `KEYWORD_WEIGHT=0.2`
  - `FETCH_BUFFER=10`
- Snippets:
  - `MAX_SNIPPET_SENTENCES=3`
  - `MIN_SENTENCE_LENGTH=20`
  - `SENTENCE_SCORE_THRESHOLD=0.3`
- Fuzzy:
  - `FUZZY_MATCH_THRESHOLD=0.75`
  - `MIN_WORD_LENGTH_FOR_FUZZY=4`
- Re-ranking:
  - `ENABLE_RERANKING=True`
  - `RERANK_MODEL="cross-encoder/ms-marco-MiniLM-L-6-v2"`
  - `RERANK_CANDIDATES=20`
  - `MAX_RESULTS=5`

### 5.3 Lazy global caches
- `_model`, `_client`, `_collection`, `_reranker` initialized lazily.
- `get_model()`, `get_weaviate_client()`, `get_collection()`, `get_reranker()` manage these.
- Weaviate client has retry loop (`max_retries=3`, delay 2s).

### 5.4 Score utilities
- `normalize_scores(scores)`: min-max normalize to [0,1], with all-equal fallback 0.5.
- `sigmoid(x)`: present utility, not used in final ranking path currently.

### 5.5 Vocabulary cache and typo correction
- `_vocabulary` set built from all indexed chunks + file names in Weaviate (`[a-zA-Z]{3,}` tokenization).
- `correct_query(query)`:
  - for each term not in vocab and long enough,
  - uses `difflib.get_close_matches` with cutoff 0.75,
  - substitutes closest word while preserving initial capitalization.
- `invalidate_vocabulary()` clears cache after re-index.

### 5.6 Keyword matching helpers
- `fuzzy_term_in_text(term, text_lower)`:
  - exact substring first,
  - then per-word sequence match for long terms.
- `calculate_keyword_score(query_terms, chunk_text, filename)`:
  - +1 for chunk match,
  - +0.5 for filename match,
  - normalized by `len(query_terms)*1.5`, capped at 1.0.

### 5.7 Sentence and snippet helpers
- `split_into_sentences(text)`:
  - regex-based split with uppercase-boundary assumption,
  - filters very short sentences.
- `find_matched_terms(query, text)`:
  - returns query terms that appear in snippet (for frontend highlighting).
- `extract_query_aware_snippet(query, chunk_text, query_embedding=None)`:
  - split into sentences,
  - semantic score each sentence against query embedding,
  - select up to 3 best above threshold,
  - if gaps in original order, inserts `...`.

### 5.8 Main search flow (`semantic_search`)
1. fuzzy-correct query.
2. resolve roots from DB if not supplied.
3. create query term list for keyword scoring.
4. encode query vector.
5. call Weaviate `near_vector` with `limit=top_k * FETCH_BUFFER`.
6. iterate returned chunks:
   - optional root scope check by normalized path prefix.
   - compute semantic similarity `1 - distance`.
   - compute hybrid score if enabled.
   - keep only best chunk per file path.
7. candidate set:
   - sort by hybrid score,
   - trim to `RERANK_CANDIDATES`.
8. optional cross-encoder re-ranking:
   - if enabled and model available,
   - predict scores for `(query, chunk)` pairs,
   - sort by raw rerank score descending,
   - also store normalized rerank scores.
   - fallback if reranker unavailable: use hybrid score.
9. apply hard cap `effective_top_k=min(top_k, MAX_RESULTS)`.
10. snippet extraction for final results.
11. return list with fields:
   - `file`, `path`, `snippet`, `matched_terms`, `distance`, `similarity`, `hybrid_score`, `rerank_score`.

## 6. Frontend and Electron (Detailed)

## 6.1 Build/runtime files
- `app-ui/package.json`
  - scripts:
    - `dev`: `vite`
    - `build`: `vite build`
    - `start`: `npm run build && electron .`
  - dependencies: React/ReactDOM
  - devDependencies: Vite, plugin-react, Electron

- `app-ui/vite.config.js`
  - React plugin enabled.
  - `base: "./"` for file-based loading compatibility.
  - output to `dist`.

- `app-ui/index.html`
  - root container `#root`.
  - inline loading and global error handlers (`error`, `unhandledrejection`).
  - module script bootstraps `src/main.jsx`.

## 6.2 Electron processes and bridge files
There are two Electron paths in repository:

1) Root-level Electron files:
- `app-ui/main.js`: creates BrowserWindow, loads `dist/index.html`.
- `app-ui/preload.js`: exposes `window.sageAPI` and `window.electron`.
- `app-ui/renderer.js`: legacy direct DOM search renderer.

2) `electron/` folder files:
- `app-ui/electron/main.cjs`: creates BrowserWindow, loads `http://localhost:5173` for dev.
- `app-ui/electron/preload.cjs`: exposes `window.sage` bridge functions.

Note:
- The React app (under `src/`) actually uses `window.electron.selectFolder` and `window.electron.openFile` in current code.
- That shape matches `app-ui/preload.js`, not `app-ui/electron/preload.cjs`.
- `app-ui/electron/main.cjs` includes handlers like `/roots` POST and `/reindex` endpoint assumptions that do not match current backend APIs exactly.

This indicates a mix of active + legacy/alternate Electron wiring.

## 6.3 React app bootstrap: `src/main.jsx`
- Logs bootstrap diagnostics.
- Ensures `#root` exists.
- Creates root and renders:
  - `React.StrictMode`
  - `AppProvider`
  - `App`

## 6.4 App shell router: `src/App.jsx`
- Reads current `screen` from app context.
- Maintains `activeScreen` and `outgoingScreen` for transition layering.
- Uses 350ms fade timing with cleanup timer.
- `renderScreen(screenId)` maps IDs to screen components.
- Safety net:
  - if no screen, fallback to `<Search/>`.
  - if render throws, show error UI with reload button.

## 6.5 Global state: `src/state/appState.jsx`
Defines `SCREENS` enum-like object and global app state.

Persistent keys in localStorage:
- onboarding flags (`sage_onboarding_complete`, `sage_seen_hello`)
- `sage_user_name`
- indexing logs query/results
- legacy search keys for migration

Initialization behavior:
- determines initial screen:
  - completed onboarding -> SEARCH
  - else if hello seen -> NAME_INPUT
  - else -> WELCOME
- loads name and indexing logs from localStorage.
- migrates legacy search keys into indexing log keys when needed.
- force removes local `sage_user_routes` each load so backend is source of truth.

State areas:
- screen control and guarded `setScreen`.
- user identity.
- routes in memory.
- session search state (query/results).
- persisted indexing logs state.
- searching spinner flag.
- `pendingRoutes` used by settings acknowledgment flow.

Mutators include:
- `saveUserName`, `saveRoutes`, `addRoute`, `removeRoute`.
- `setIndexingLogs`, `clearIndexingLogs`.
- `markOnboardingComplete`.

## 6.6 Backend API client: `src/api/backend.js`
Base URL: `http://127.0.0.1:8000`.

Methods:
- `searchFiles(query, topK)` -> `POST /search`.
- `getRoots()` -> `GET /roots`.
- `addRoot(path)` -> `POST /roots/add`.
- `removeRoot(path)` -> `POST /roots/remove`.
- `triggerIndexing()` -> `POST /index`.
- `getStatus()` -> `GET /status`.
- `getIndexingProgress()` -> `GET /index/progress`.
- `checkBackend()` -> `GET /` with failure-safe false return.

## 6.7 Screen modules

### `src/screens/Welcome.jsx`
- first-run splash.
- if `sage_seen_hello` true, immediately go to NAME_INPUT.
- else set it true and auto-advance to NAME_INPUT after 2 seconds.

### `src/screens/NameInput.jsx`
- captures user name.
- on valid name + Enter/click:
  - saves trimmed name,
  - navigates to SETUP_COMPLETE.

### `src/screens/SetupComplete.jsx`
- displays completion state.
- shows generated confetti pieces.
- after 3 seconds:
  - marks onboarding complete,
  - navigates to SEARCH.

### `src/screens/Search.jsx`
Primary functional screen.

Startup effects:
- loads roots from backend and syncs into context.
- starts adaptive indexing progress polling:
  - 1s polling while indexing active,
  - 5s when idle/after complete.
- installs `Ctrl/Cmd + K` shortcut to focus search input.

Search action (`handleSearch`):
1. skip if query empty.
2. set searching true.
3. persist query to app context.
4. call `searchFiles(localQuery, 10)`.
5. store results in context.
6. persist same payload to indexing logs.
7. on error, clear results and still log query with empty results.
8. set searching false.

UI behavior:
- if routes still loading: shows spinner.
- if no routes: blocking card prompting navigation to Settings.
- shows progress bar when backend reports active indexing.
- result list renders `ResultCard` items.
- clicking a result opens file via Electron bridge.

### `src/screens/Settings.jsx`
Main folder management surface.

State:
- `localRoutes`, `loading`, `showAcknowledgement`, `confirmDelete`.

Functions:
- `loadRoutes`: fetch from backend and dedupe.
- `handleSelectFolder`: uses `window.electron.selectFolder`; enforces max 5 and duplicate checks.
- `confirmRemove`: immediately calls backend `removeRoot` and updates local state.
- `handleSave`: does not save directly; opens acknowledgment sub-flow.

Acknowledgment sub-component (`Acknowledgement`):
- shows security notice and checkbox.
- on confirm:
  1. fetches current backend roots,
  2. computes normalized add/remove diffs,
  3. applies removals then additions via API,
  4. reloads and saves updated routes,
  5. triggers indexing if any change happened,
  6. shows success state.

### `src/screens/IndexingLogs.jsx`
- reads persisted indexing logs from context.
- can clear logs with confirmation.
- renders previous results via `ResultCard`.
- provides nav actions back to Settings/Search.

### `src/screens/Profile.jsx`
- simple profile card.
- shows user initial and user name from context.
- back button routes to SEARCH.

## 6.8 Component modules

### `src/components/ResultCard.jsx`
Responsibilities:
- infer file type icon from extension.
- compute display title/folder labels from path.
- highlight query-matched terms in snippet with `<mark>`.
- keyboard accessibility (Enter/Space opens result).
- display match score chip.

### `src/components/SearchBar.jsx`
- controlled input with Enter submission.
- disables submit while searching.
- shows progress shimmer when searching.

### `src/components/Loader.jsx`
- empty file (currently no export/logic).

### `src/animations/transitions.js`
- exports one `fade` object with `initial/animate/exit/transition` fields.

## 6.9 Theme system: `src/theme/theme.css`
This is a comprehensive style system with:
- root variables (colors, spacing, typography, transitions, glassmorphism params).
- global resets and utility classes.
- animation keyframes for fade, slide, confetti, blob morphing, shimmer, spin.
- dedicated sections for:
  - hello screen
  - name input
  - generic glass cards/buttons
  - settings layout and modal
  - acknowledgement flow
  - search page ambient effects and result cards
  - indexing progress bar
  - indexing logs controls
- scrollbars and responsive adjustments.

It is large and includes some older utility blocks preserved alongside newer screen-specific classes.

## 7. Data Model

SQLite (`index_state.db`):

`indexed_files`
- `path` TEXT PRIMARY KEY
- `mtime` REAL
- `size` INTEGER
- `indexed_at` REAL

`user_roots`
- `path` TEXT PRIMARY KEY

Weaviate collection `Documents`:
- properties:
  - `file` TEXT
  - `path` TEXT
  - `chunk` TEXT
- vectors supplied manually by SentenceTransformer.

## 8. End-to-End Runtime Flows

### 8.1 App startup
1. Backend starts and initializes db tables.
2. Backend deduplicates roots and starts watchdog for configured roots.
3. Frontend starts, initializes context, decides initial screen based on onboarding flags.

### 8.2 Root folder change flow
1. User edits routes in Settings.
2. On acknowledgement confirm, frontend diffs desired vs backend roots.
3. Backend applies root add/remove endpoints.
4. Backend restarts watchdog after each root mutation.
5. Frontend triggers `POST /index` if root set changed.

### 8.3 File event flow (watchdog)
1. file create/modify/delete event arrives.
2. extension and temp-file checks applied.
3. debounce window check.
4. background full indexing run triggered.
5. indexing recomputes new/changed/deleted by full scan and db compare.
6. deleted files removed from Weaviate and SQLite.

### 8.4 Search flow
1. user query submitted from Search screen.
2. backend validates roots/query and calls `semantic_search`.
3. search module corrects typos, vector-searches Weaviate, hybrid-scores, deduplicates by file, optionally re-ranks.
4. snippet extraction selects most relevant sentences.
5. backend formats output for UI.
6. frontend renders `ResultCard` list and persists query/results to indexing logs.

## 9. API Reference (Current)

`GET /`
- response: `{ "status": "SAGE backend running", "indexing": bool }`

`GET /roots`
- response: `{ "roots": ["C:/path", ...] }`

`POST /roots/add`
- request: `{ "path": "C:/folder" }`
- success: `{ "success": true, "message": "Root added successfully" }`

`POST /roots/remove`
- request: `{ "path": "C:/folder" }`
- success: `{ "success": true, "message": "Root removed successfully" }`

`POST /index`
- success: `{ "success": true, "message": "Indexing started" }`
- if already running: `{ "success": false, "message": "Indexing already in progress" }`

`GET /status`
- response: `{ "indexing": bool, "roots_count": int, "files_indexed": int }`

`GET /index/progress`
- response includes:
  - `indexing`, `phase`, `total_files`, `processed_files`, `current_file`, `percentage`

`POST /search`
- request: `{ "query": "...", "top_k": 5 }`
- response: `{ "results": [...] }`

## 10. Dependencies and Why They Exist

From `requirements.txt`:
- FastAPI/Uvicorn: HTTP API server.
- weaviate-client: vector DB integration.
- sentence-transformers + torch: embedding and reranking models.
- watchdog: filesystem event monitoring.
- PyMuPDF/python-docx/python-pptx: text extraction by format.
- pytesseract + Pillow: OCR for scanned pages.
- numpy/pydantic: utility and model validation support.

## 11. Known Implementation Characteristics and Caveats

1. Search API hard-caps top_k to 5 in backend even if caller requests more.
2. Watchdog events trigger a full index reconciliation pass, not targeted per-file operations.
3. Debounce is global, so bursts can collapse into fewer indexing runs.
4. The repository contains mixed Electron wiring (legacy and active variants).
5. `Loader.jsx` is currently empty.
6. Some CSS blocks are legacy/overlapping but still present.
7. Sensitive-term filtering only checks returned snippet text, not full chunk/file contents.
8. In `Search.jsx`, `searchFiles(localQuery, 10)` asks 10 but backend returns max 5 due cap.

## 12. Setup and Run (Practical)

Backend:
1. Create and activate virtual environment.
2. Install requirements.
3. Run backend from `backend/main.py` (or equivalent uvicorn command).
4. Ensure Weaviate local instance is running and reachable.

Frontend:
1. `cd app-ui`
2. `npm install`
3. Use your chosen Electron entry flow (dev or packaged path) consistent with preload bridge expected by React (`window.electron.*` usage).

## 13. Summary

SAGE is implemented as a full local semantic retrieval stack with:
- deterministic filesystem indexing state in SQLite,
- semantic chunk retrieval in Weaviate,
- hybrid relevance scoring with typo tolerance and optional reranking,
- desktop UX for onboarding, folder control, live progress, and result exploration.

This document reflects current source behavior and intentionally calls out all observable module responsibilities, runtime flows, and caveats present in this repository state.
