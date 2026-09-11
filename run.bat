@echo off
echo ====================================================
echo Starting ChronoJira - Visual Agile ^& Time-Slot Tracker
echo ====================================================
echo.

if not exist "frontend\dist" (
    echo Building React frontend bundle...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

python database.py
echo Starting server on http://127.0.0.1:8000 ...
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
