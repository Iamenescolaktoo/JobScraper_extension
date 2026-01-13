from jobspy import scrape_jobs
import json
import argparse
from pathlib import Path
import re
import pandas as pd

def extract_grad_window(text):
    """
    Extract a year window from job description text.
    Returns: {"min_year": 2025, "max_year": 2027} or None
    """
    if text is None:
        return None

    # Pandas NaN shows up as float
    if isinstance(text, float) and pd.isna(text):
        return None

    if not isinstance(text, str):
        text = str(text)

    t = text.lower()

    years = re.findall(r"20\d{2}", t)
    years = sorted(set(int(y) for y in years))
    if not years:
        return None

    return {"min_year": min(years), "max_year": max(years)}

def best_url(row):
    # Prefer direct URL if present
    cand = row.get("job_url_direct")
    if isinstance(cand, float) and pd.isna(cand):
        cand = None
    if not cand:
        cand = row.get("job_url")

    if isinstance(cand, float) and pd.isna(cand):
        cand = None

    if not cand:
        return None

    cand = str(cand).strip()
    if cand == "" or cand == "about:blank":
        return None

    return cand

def detect_output_path():
    """
    If there's an ./extension folder next to jobs.py, write there.
    Otherwise write next to jobs.py.
    """
    here = Path(__file__).resolve().parent
    ext_dir = here / "extension"
    if ext_dir.exists() and (ext_dir / "manifest.json").exists():
        return ext_dir / "jobs.json"
    return here / "jobs.json"

parser = argparse.ArgumentParser()
parser.add_argument("--term", default="data internship")
parser.add_argument("--location", default="Chicago, IL")
parser.add_argument("--hours", type=int, default=72)
parser.add_argument("--limit", type=int, default=40)
parser.add_argument("--out", default=None)
args = parser.parse_args()

jobs = scrape_jobs(
    site_name=["linkedin", "indeed"],
    search_term=args.term,
    location=args.location,
    results_wanted=args.limit,
    hours_old=args.hours,
)

# Sort newest â†’ oldest
if "date_posted" in jobs.columns:
    jobs = jobs.sort_values(by="date_posted", ascending=False, na_position="last")

out = []
seen = set()

for _, row in jobs.iterrows():
    url = best_url(row)
    if not url:
        continue

    if url in seen:
        continue
    seen.add(url)

    date_posted = row.get("date_posted")
    date_iso = None
    if hasattr(date_posted, "isoformat"):
        date_iso = date_posted.isoformat()
    elif isinstance(date_posted, str) and date_posted.strip():
        date_iso = date_posted.strip()

    desc = row.get("description", None)
    grad_window = extract_grad_window(desc)

    out.append({
        "id": url,
        "site": row.get("site"),
        "title": row.get("title"),
        "company": row.get("company"),
        "location": row.get("location"),
        "job_url": url,
        "date_posted": date_iso,
        "grad_window": grad_window,
        "status": "new",
    })

out_path = Path(args.out) if args.out else detect_output_path()
out_path.parent.mkdir(parents=True, exist_ok=True)

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"âœ… Wrote {len(out)} jobs to {out_path}")
print("   (Overwritten fresh; newest â†’ oldest)")