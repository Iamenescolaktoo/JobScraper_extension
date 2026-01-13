from fastapi import FastAPI
import os

app = FastAPI()

@app.get("/")
def health():
    return {"status": "ok"}

@app.get("/jobs")
def jobs():
    return {"jobs": []}

# Railway uses PORT env var
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
