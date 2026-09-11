"""
Root database wrapper for ChronoJira.
Delegates to modular backend.app.database.
"""
from backend.app.database import get_db_connection, init_db, seed_data, DB_PATH

if __name__ == "__main__":
    init_db()
    print("Database initialized/migrated successfully at", DB_PATH)