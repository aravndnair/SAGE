import os
import time
import sqlite3
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ---------------- CONFIG ----------------

INDEX_DB = "index_state.db"
ALLOWED_EXT = (".txt", ".pdf", ".docx", ".ppt", ".pptx")

# --------------------------------------


def load_user_roots():
    conn = sqlite3.connect(INDEX_DB, timeout=30)
    cur = conn.cursor()
    cur.execute("SELECT path FROM user_roots")
    roots = [row[0] for row in cur.fetchall()]
    conn.close()
    return roots


def is_allowed_file(path: str) -> bool:
    return path.lower().endswith(ALLOWED_EXT)


class SageEventHandler(FileSystemEventHandler):
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
        print(f"📡 {action.upper()}: {path}")

        # correctness > cleverness
        os.system("python index_docs.py")


def main():
    roots = load_user_roots()

    if not roots:
        print("⚠️ No user roots configured. Watchdog exiting.")
        return

    observer = Observer()
    handler = SageEventHandler()

    for root in roots:
        if not os.path.exists(root):
            continue
        print(f"👀 Watching: {root}")
        observer.schedule(handler, root, recursive=True)

    observer.start()
    print("📡 Watchdog running (DB-root scoped)")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()

    observer.join()


if __name__ == "__main__":
    main()
