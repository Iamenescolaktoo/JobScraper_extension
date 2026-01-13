import subprocess
import sys
import json

def handler(request):
    try:
        subprocess.check_call([
            sys.executable,
            "jobs.py",
            "--term", "software intern",
            "--location", "Chicago, IL",
            "--hours", "72",
            "--limit", "40"
        ])

        return {
            "statusCode": 200,
            "headers": { "Content-Type": "application/json" },
            "body": json.dumps({
                "status": "ok",
                "message": "jobs.json refreshed"
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": { "Content-Type": "application/json" },
            "body": json.dumps({
                "status": "error",
                "error": str(e)
            })
        }
