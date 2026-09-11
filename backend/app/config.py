import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "chronojira.db"))

# Default settings
DEFAULT_HOURS_PER_SP = 8.0
DEFAULT_HOURS_PER_DAY = 8.0
DEFAULT_WEEK_OFFS = "5,6"  # Saturday and Sunday (0=Monday, 6=Sunday)
DEFAULT_WORKING_DAYS_PER_WEEK = 5

CORS_ORIGINS = ["*"]
