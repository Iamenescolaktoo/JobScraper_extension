import subprocess
import sys
from fastapi import FastAPI

app = FastAPI()

@app.get("/refresh")
def refresh():
    try:
        subprocess.check_call([
            sys.executable,
            "jobs.py",
            "--term", "software intern",
            "--location", "Chicago, IL",
            "--hours", "72",
            "--limit", "40"
        ])
        return {"status": "ok", "message": "jobs.json refreshed"}
    except Exception as e:
        return {"status": "error", "error": str(e)}
