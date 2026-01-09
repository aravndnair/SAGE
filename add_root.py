import sqlite3

DB = "index_state.db"
ROOT = r"C:\SageTest"   # <-- change this if needed

conn = sqlite3.connect(DB, timeout=30)
cur = conn.cursor()

cur.execute("CREATE TABLE IF NOT EXISTS user_roots (path TEXT PRIMARY KEY)")
cur.execute("DELETE FROM user_roots")
cur.execute("INSERT INTO user_roots VALUES (?)", (ROOT,))

conn.commit()

cur.execute("SELECT * FROM user_roots")
print("ROOTS IN DB:", cur.fetchall())

conn.close()
