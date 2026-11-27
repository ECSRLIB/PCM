# Dataset build tools

Run from the repository root (needs Python 3 and `openpyxl`):

```bash
pip install openpyxl
cd tools && python3 extra.py && cd ..          # curated additions -> tools/extra.json
python3 tools/ingest.py data/source tools/raw.json        # read all spreadsheets
python3 tools/merge.py tools/raw.json tools/extra.json data/pcm.json
```

`merge.py` writes `fixes.log` in the current folder. Copy it to `data/data-fixes.txt`.

To regenerate the CSV:

```bash
python3 - <<'EOF'
import json, csv
d = json.load(open("data/pcm.json"))
cols = ["id","name","category","nature","manufacturer","formula","composition","tm","tm_text","lh","lh_text",
        "cps","cpl","rhos","rhol","ks","kl","tmax","refs"]
with open("data/pcm.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(cols)
    for m in d: w.writerow(["; ".join(m.get(k, [])) if k == "refs" else m.get(k, "") for k in cols])
EOF
```

To add a material by hand, add a row to `rows` in `extra.py` with its source, then rerun the steps above.
