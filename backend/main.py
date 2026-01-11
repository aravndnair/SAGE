import traceback
import sys
import os
import sqlite3
import threading
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Add parent directory to path to import search.py and index_docs.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from search import semantic_search
import index_docs

# =========================
# CONFIG
# =========================
INDEX_DB = "index_state.db"
SENSITIVE_WORDS = {"password", "license", "serial", "activation", "key", "recovery", "private", "secret"}
ALLOWED_EXT = (".txt", ".pdf", ".docx", ".ppt", ".pptx")

# Global flags
indexing_in_progress = False
watchdog_observer = None

# =========================
# FASTAPI SETUP
# =========================
app = FastAPI()

# Enable CORS for Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# REQUEST MODELS
# =========================
class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5

class RootRequest(BaseModel):
    path: str


# =========================
# DATABASE HELPERS
# =========================
def get_db_connection():
    """Get SQLite connection to index_state.db"""
    return sqlite3.connect(INDEX_DB)

def normalize_path(path: str) -> str:
    """Normalize path: remove trailing slashes, resolve to absolute"""
    normalized = os.path.abspath(path)
    # Remove trailing slash/backslash
    if normalized.endswith(('/', '\\')):
        normalized = normalized.rstrip('/\\')
    return normalized


def get_user_roots() -> List[str]:
    """Get list of user-defined roots from database"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT path FROM user_roots")
    roots = [row[0] for row in cur.fetchall()]
    conn.close()
    return roots

def add_user_root(path: str) -> bool:
    """Add a root path to the database"""
    # Normalize path to prevent duplicates from trailing slashes
    normalized_path = normalize_path(path)
    
    if not os.path.exists(normalized_path):
        return False
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Check if already exists
        cur.execute("SELECT COUNT(*) FROM user_roots WHERE path = ?", (normalized_path,))
        if cur.fetchone()[0] > 0:
            print(f"⚠️ Root already exists: {normalized_path}")
            return True  # Return true since it's already there
        
        cur.execute("INSERT INTO user_roots (path) VALUES (?)", (normalized_path,))
        conn.commit()
        print(f"✅ Added root: {normalized_path}")
        return True
    except Exception as e:
        print(f"❌ Error adding root: {e}")
        return False
    finally:
        conn.close()

def remove_user_root(path: str) -> bool:
    """Remove a root path from the database"""
    normalized_path = normalize_path(path)
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM user_roots WHERE path = ?", (normalized_path,))
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Error removing root: {e}")
        return False
    finally:
        conn.close()


def cleanup_duplicate_roots():
    """Remove duplicate roots from database (keeps first occurrence)"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Delete duplicates, keeping the one with lowest rowid
        cur.execute("""
            DELETE FROM user_roots
            WHERE rowid NOT IN (
                SELECT MIN(rowid)
                FROM user_roots
                GROUP BY path
            )
        """)
        deleted = cur.rowcount
        conn.commit()
        if deleted > 0:
            print(f"🧹 Cleaned up {deleted} duplicate root(s)")
        return deleted
    except Exception as e:
        print(f"❌ Error cleaning duplicates: {e}")
        return 0
    finally:
        conn.close()


# =========================
# INDEXING CONTROL
# =========================
def run_indexing_background():
    """Run indexing in background thread"""
    global indexing_in_progress
    try:
        indexing_in_progress = True
        print("🔵 Starting indexing...")
        index_docs.main()
        print("✅ Indexing complete")
    except Exception as e:
        print(f"❌ Indexing error: {e}")
        traceback.print_exc()
    finally:
        indexing_in_progress = False


# =========================
# WATCHDOG FILE MONITORING
# =========================
def is_allowed_file(path: str) -> bool:
    """Check if file should be indexed based on extension"""
    return path.lower().endswith(ALLOWED_EXT)


class SageEventHandler(FileSystemEventHandler):
    """Handle file system events for live indexing"""
    
    def on_created(self, event):
        if event.is_directory:
            return
        path = os.path.abspath(event.src_path)
        if not is_allowed_file(path):
            return
        self.handle_event("created", path)

    def on_modified(self, event):
        if event.is_directory:
            return
        path = os.path.abspath(event.src_path)
        if not is_allowed_file(path):
            return
        self.handle_event("modified", path)

    def on_deleted(self, event):
        if event.is_directory:
            return
        path = os.path.abspath(event.src_path)
        if not is_allowed_file(path):
            return
        self.handle_event("deleted", path)

    def handle_event(self, action, path):
        """Trigger re-indexing when files change"""
        print(f"📡 Watchdog: {action.upper()} - {path}")
        # Run indexing in background to avoid blocking
        threading.Thread(target=run_indexing_background, daemon=True).start()


def start_watchdog():
    """Initialize and start watchdog observer for all user roots"""
    global watchdog_observer
    
    roots = get_user_roots()
    if not roots:
        print("⚠️ No user roots configured. Watchdog will start after roots are added.")
        return
    
    if watchdog_observer is not None:
        print("⚠️ Watchdog already running")
        return
    
    try:
        watchdog_observer = Observer()
        handler = SageEventHandler()
        
        for root in roots:
            if not os.path.exists(root):
                continue
            print(f"👀 Watching: {root}")
            watchdog_observer.schedule(handler, root, recursive=True)
        
        watchdog_observer.start()
        print("✅ Watchdog monitoring active")
    except Exception as e:
        print(f"❌ Failed to start watchdog: {e}")
        watchdog_observer = None


def stop_watchdog():
    """Stop watchdog observer"""
    global watchdog_observer
    
    if watchdog_observer is not None:
        watchdog_observer.stop()
        watchdog_observer.join()
        watchdog_observer = None
        print("🔻 Watchdog stopped")


def restart_watchdog():
    """Restart watchdog with updated roots"""
    stop_watchdog()
    start_watchdog()


# =========================
# ENDPOINTS
# =========================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "SAGE backend running", "indexing": indexing_in_progress}


@app.get("/roots")
async def list_roots():
    """Get list of current user-defined roots"""
    try:
        # Clean duplicates on every fetch to ensure data integrity
        cleanup_duplicate_roots()
        roots = get_user_roots()
        return {"roots": roots}
    except Exception as e:
        print(f"❌ Error listing roots: {e}")
        raise HTTPException(status_code=500, detail="Failed to list roots")


@app.post("/roots/add")
async def add_root(request: RootRequest):
    """Add a new root directory"""
    try:
        path = request.path
        if not os.path.exists(path):
            raise HTTPException(status_code=400, detail="Path does not exist")
        
        if not os.path.isdir(path):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        success = add_user_root(path)
        if success:
            # Restart watchdog to monitor new root
            restart_watchdog()
            return {"success": True, "message": "Root added successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to add root")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding root: {e}")
        raise HTTPException(status_code=500, detail="Failed to add root")


@app.post("/roots/remove")
async def remove_root(request: RootRequest):
    """Remove a root directory"""
    try:
        success = remove_user_root(request.path)
        if success:
            # Restart watchdog to remove monitoring from this root
            restart_watchdog()
            return {"success": True, "message": "Root removed successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to remove root")
    except Exception as e:
        print(f"❌ Error removing root: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove root")


@app.post("/index")
async def trigger_indexing():
    """Trigger background indexing process"""
    global indexing_in_progress
    
    if indexing_in_progress:
        return {"success": False, "message": "Indexing already in progress"}
    
    # Check if roots exist
    roots = get_user_roots()
    if not roots:
        raise HTTPException(status_code=400, detail="No roots configured. Add roots first.")
    
    # Start indexing in background thread
    thread = threading.Thread(target=run_indexing_background, daemon=True)
    thread.start()
    
    return {"success": True, "message": "Indexing started"}


@app.get("/status")
async def get_status():
    """Get indexing status and file count"""
    try:
        roots = get_user_roots()
        
        # Get indexed file count
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM indexed_files")
        file_count = cur.fetchone()[0]
        conn.close()
        
        return {
            "indexing": indexing_in_progress,
            "roots_count": len(roots),
            "files_indexed": file_count
        }
    except Exception as e:
        print(f"❌ Error getting status: {e}")
        return {
            "indexing": indexing_in_progress,
            "roots_count": 0,
            "files_indexed": 0
        }


@app.post("/search")
async def search_files(request: SearchRequest):
    """
    Semantic search using frozen search.py logic.
    Returns file-level deduplicated results with hybrid scoring.
    """
    try:
        query = request.query.strip()
        if not query:
            return {"results": []}
        
        # Check if roots exist
        roots = get_user_roots()
        if not roots:
            return {"results": [], "message": "No roots configured"}
        
        # Use semantic_search from search.py (frozen backend)
        top_k = request.top_k or 5
        results = semantic_search(query, top_k=top_k)
        
        # Optional: Filter sensitive content
        filtered_results = []
        for r in results:
            snippet = r.get("snippet", "")
            if is_sensitive_text(snippet):
                continue
            
            # Format for frontend
            filtered_results.append({
                "file": r.get("file"),
                "filename": r.get("file"),  # Add filename field
                "path": r.get("path"),
                "snippet": snippet,
                "chunk": snippet,  # Alias for compatibility
                "score": r.get("hybrid_score", r.get("similarity", 0)),  # Use hybrid_score as main score
                "similarity": round(r.get("similarity", 0) * 100, 2),  # Convert to percentage
                "hybrid_score": round(r.get("hybrid_score", 0) * 100, 2)  # Convert to percentage
            })
        
        return {"results": filtered_results}
    
    except Exception as e:
        print("❌ SEARCH ERROR:", e)
        traceback.print_exc()
        return {"results": [], "error": str(e)}


# =========================
# DEEPDIVE API
# =========================
import uuid
import time
import httpx

# DeepDive Request Models
class DeepDiveCreateRequest(BaseModel):
    file_path: str  # Initial file to add

class DeepDiveAddFileRequest(BaseModel):
    session_id: str
    file_path: str

class DeepDiveRemoveFileRequest(BaseModel):
    session_id: str
    file_path: str

class DeepDiveMessageRequest(BaseModel):
    session_id: str
    message: str

class DeepDiveDeleteRequest(BaseModel):
    session_id: str

# Ollama Configuration
OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "mistral"  # Can be changed to llama3.1, phi3, qwen2, etc.
OLLAMA_TIMEOUT = 120.0  # Seconds

DEEPDIVE_SYSTEM_PROMPT = """You are a helpful document analysis assistant. When document excerpts are provided, answer questions based on that content.

RULES:
1. When [DOCUMENT] sections are provided, base your answers on that content
2. If asked about something not in the provided documents, say so clearly
3. For conversational messages (thanks, ok, etc.) without document context, respond naturally and briefly
4. Be concise and helpful

You are helping the user understand their local files."""


@app.post("/deepdive/create")
async def deepdive_create(request: DeepDiveCreateRequest):
    """Create a new DeepDive session with an initial file"""
    try:
        session_id = str(uuid.uuid4())
        now = time.time()
        file_path = normalize_path(request.file_path)
        
        # Extract filename for initial title
        filename = os.path.basename(file_path)
        title = f"DeepDive: {filename}"
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create session
        cur.execute(
            "INSERT INTO deepdive_sessions (id, title, created_at, last_used) VALUES (?, ?, ?, ?)",
            (session_id, title, now, now)
        )
        
        # Add initial file
        cur.execute(
            "INSERT INTO deepdive_files (session_id, path, added_at) VALUES (?, ?, ?)",
            (session_id, file_path, now)
        )
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "session_id": session_id,
            "title": title
        }
    except Exception as e:
        print(f"❌ DeepDive create error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deepdive/sessions")
async def deepdive_list_sessions():
    """List all DeepDive sessions"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT s.id, s.title, s.created_at, s.last_used,
                   COUNT(f.path) as file_count,
                   COUNT(m.id) as message_count
            FROM deepdive_sessions s
            LEFT JOIN deepdive_files f ON s.id = f.session_id
            LEFT JOIN deepdive_messages m ON s.id = m.session_id
            GROUP BY s.id
            ORDER BY s.last_used DESC
        """)
        
        sessions = []
        for row in cur.fetchall():
            sessions.append({
                "id": row[0],
                "title": row[1],
                "created_at": row[2],
                "last_used": row[3],
                "file_count": row[4],
                "message_count": row[5]
            })
        
        conn.close()
        return {"sessions": sessions}
    except Exception as e:
        print(f"❌ DeepDive list error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deepdive/session/{session_id}")
async def deepdive_get_session(session_id: str):
    """Get a specific DeepDive session with files and messages"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get session info
        cur.execute("SELECT id, title, created_at, last_used FROM deepdive_sessions WHERE id = ?", (session_id,))
        session_row = cur.fetchone()
        if not session_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get files
        cur.execute("SELECT path, added_at FROM deepdive_files WHERE session_id = ? ORDER BY added_at", (session_id,))
        files = [{"path": row[0], "filename": os.path.basename(row[0]), "added_at": row[1]} for row in cur.fetchall()]
        
        # Get messages
        cur.execute("SELECT id, role, content, timestamp FROM deepdive_messages WHERE session_id = ? ORDER BY timestamp", (session_id,))
        messages = [{"id": row[0], "role": row[1], "content": row[2], "timestamp": row[3]} for row in cur.fetchall()]
        
        # Update last_used
        cur.execute("UPDATE deepdive_sessions SET last_used = ? WHERE id = ?", (time.time(), session_id))
        conn.commit()
        conn.close()
        
        return {
            "session": {
                "id": session_row[0],
                "title": session_row[1],
                "created_at": session_row[2],
                "last_used": session_row[3]
            },
            "files": files,
            "messages": messages
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ DeepDive get session error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deepdive/add-file")
async def deepdive_add_file(request: DeepDiveAddFileRequest):
    """Add a file to an existing DeepDive session"""
    try:
        file_path = normalize_path(request.file_path)
        now = time.time()
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check session exists
        cur.execute("SELECT id FROM deepdive_sessions WHERE id = ?", (request.session_id,))
        if not cur.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Check if file already in session
        cur.execute("SELECT path FROM deepdive_files WHERE session_id = ? AND path = ?", (request.session_id, file_path))
        if cur.fetchone():
            conn.close()
            return {"success": True, "message": "File already in session"}
        
        # Add file
        cur.execute(
            "INSERT INTO deepdive_files (session_id, path, added_at) VALUES (?, ?, ?)",
            (request.session_id, file_path, now)
        )
        
        # Update last_used
        cur.execute("UPDATE deepdive_sessions SET last_used = ? WHERE id = ?", (now, request.session_id))
        
        conn.commit()
        conn.close()
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ DeepDive add file error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deepdive/remove-file")
async def deepdive_remove_file(request: DeepDiveRemoveFileRequest):
    """Remove a file from a DeepDive session"""
    try:
        file_path = normalize_path(request.file_path)
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM deepdive_files WHERE session_id = ? AND path = ?", (request.session_id, file_path))
        
        conn.commit()
        conn.close()
        
        return {"success": True}
    except Exception as e:
        print(f"❌ DeepDive remove file error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deepdive/delete")
async def deepdive_delete_session(request: DeepDiveDeleteRequest):
    """Delete a DeepDive session and all associated data"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Delete in order: messages, files, session
        cur.execute("DELETE FROM deepdive_messages WHERE session_id = ?", (request.session_id,))
        cur.execute("DELETE FROM deepdive_files WHERE session_id = ?", (request.session_id,))
        cur.execute("DELETE FROM deepdive_sessions WHERE id = ?", (request.session_id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True}
    except Exception as e:
        print(f"❌ DeepDive delete error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deepdive/chat")
async def deepdive_chat(request: DeepDiveMessageRequest):
    """Send a message in a DeepDive session and get LLM response"""
    try:
        now = time.time()
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get session files
        cur.execute("SELECT path FROM deepdive_files WHERE session_id = ?", (request.session_id,))
        file_paths = [row[0] for row in cur.fetchall()]
        
        if not file_paths:
            conn.close()
            raise HTTPException(status_code=400, detail="No files in session")
        
        # Get message history for context
        cur.execute(
            "SELECT role, content FROM deepdive_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10",
            (request.session_id,)
        )
        history = list(reversed(cur.fetchall()))
        
        # Save user message
        cur.execute(
            "INSERT INTO deepdive_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
            (request.session_id, "user", request.message, now)
        )
        
        # Update last_used
        cur.execute("UPDATE deepdive_sessions SET last_used = ? WHERE id = ?", (now, request.session_id))
        
        # Auto-generate title after first user message
        cur.execute("SELECT COUNT(*) FROM deepdive_messages WHERE session_id = ? AND role = 'user'", (request.session_id,))
        user_msg_count = cur.fetchone()[0]
        
        if user_msg_count == 1:
            # First message - generate title from question + files
            file_names = [os.path.basename(p) for p in file_paths[:2]]
            short_question = request.message[:50] + "..." if len(request.message) > 50 else request.message
            new_title = f"{short_question}"
            cur.execute("UPDATE deepdive_sessions SET title = ? WHERE id = ?", (new_title, request.session_id))
        
        conn.commit()
        
        # Check if message is conversational (not a question/request about documents)
        conversational_phrases = {
            "thanks", "thank you", "ok", "okay", "got it", "understood", "i see",
            "nice", "great", "cool", "awesome", "perfect", "sure", "yes", "no",
            "hello", "hi", "hey", "bye", "goodbye", "good", "fine", "alright",
            "thx", "ty", "k", "yep", "nope", "yeah", "yea", "nah"
        }
        msg_lower = request.message.lower().strip().rstrip('.!?,')
        words = request.message.split()
        is_conversational = msg_lower in conversational_phrases or len(words) <= 2
        
        print(f"[DeepDive] Message: '{request.message}' | Normalized: '{msg_lower}' | Words: {len(words)} | Conversational: {is_conversational}")
        
        search_results = []
        context_parts = []
        
        # Only search/inject context for substantive questions
        if not is_conversational:
            # Perform file-scoped semantic search
            search_results = semantic_search(
                query=request.message,
                top_k=5,
                filter_paths=file_paths
            )
            
            # Build context document
            for result in search_results:
                chunk = result.get("chunk", result.get("snippet", ""))
                if chunk:
                    context_parts.append(f"[DOCUMENT: {result['file']}]\n{chunk}\n[/DOCUMENT]")
            
            # If no search results, fetch beginning of each file directly
            if not context_parts:
                for file_path in file_paths[:3]:  # Limit to first 3 files
                    try:
                        if os.path.exists(file_path):
                            # Use index_docs.extract_text to handle PDF, DOCX, etc.
                            content = index_docs.extract_text(file_path)
                            if content:
                                # Limit to first 4000 chars
                                content = content[:4000]
                                if content.strip():
                                    context_parts.append(f"[DOCUMENT: {os.path.basename(file_path)}]\n{content}\n[/DOCUMENT]")
                    except Exception as e:
                        print(f"Could not read file {file_path}: {e}")
        
        context = "\n\n".join(context_parts) if context_parts else None
        
        # Build conversation for Ollama
        messages = [{"role": "system", "content": DEEPDIVE_SYSTEM_PROMPT}]
        
        # Add history
        for role, content in history:
            messages.append({"role": role, "content": content})
        
        # Add current query - with or without document context
        if context:
            user_prompt = f"""Based on these document excerpts:

{context}

User question: {request.message}"""
        else:
            # Conversational message - no document context needed
            user_prompt = request.message
        
        messages.append({"role": "user", "content": user_prompt})
        
        # Call Ollama
        try:
            async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": messages,
                        "stream": False
                    }
                )
                
                if response.status_code != 200:
                    raise Exception(f"Ollama returned {response.status_code}")
                
                data = response.json()
                assistant_content = data.get("message", {}).get("content", "I couldn't generate a response.")
        except httpx.ConnectError:
            assistant_content = "⚠️ Cannot connect to Ollama. Please ensure Ollama is running locally with a model loaded.\n\nRun: `ollama run mistral`"
        except Exception as e:
            print(f"❌ Ollama error: {e}")
            assistant_content = f"⚠️ Error generating response: {str(e)}"
        
        # Save assistant response
        cur.execute(
            "INSERT INTO deepdive_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
            (request.session_id, "assistant", assistant_content, time.time())
        )
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "response": assistant_content,
            "sources": [{"file": r["file"], "path": r["path"], "snippet": r["snippet"]} for r in search_results]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ DeepDive chat error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deepdive/search-files")
async def deepdive_search_files(request: SearchRequest):
    """Search indexed files to add to a DeepDive session"""
    try:
        query = request.query.strip()
        if not query:
            return {"results": []}
        
        results = semantic_search(query, top_k=request.top_k or 10)
        
        # Return simplified results for file picker
        return {
            "results": [
                {
                    "file": r.get("file"),
                    "path": r.get("path"),
                    "snippet": r.get("snippet", "")[:150]
                }
                for r in results
            ]
        }
    except Exception as e:
        print(f"❌ DeepDive search error: {e}")
        traceback.print_exc()
        return {"results": [], "error": str(e)}


# =========================
# HELPER FUNCTIONS
# =========================
def is_sensitive_text(text: str | None) -> bool:
    """Check if text contains sensitive keywords"""
    if not text:
        return False
    t = text.lower()
    return any(w in t for w in SENSITIVE_WORDS)


# =========================
# STARTUP / SHUTDOWN
# =========================
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    print("🔵 Initializing SAGE backend...")
    # Ensure database tables exist
    index_docs.init_db()
    # Clean up any duplicate roots from previous runs
    cleanup_duplicate_roots()
    # Start watchdog monitoring
    start_watchdog()
    print("✅ Backend ready")


@app.on_event("shutdown")
def shutdown_event():
    """Clean shutdown"""
    print("🔻 Shutting down SAGE backend...")
    stop_watchdog()


# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
