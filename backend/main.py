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
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM user_roots WHERE path = ?", (path,))
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
