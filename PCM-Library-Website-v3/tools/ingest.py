"""Merge every PCM spreadsheet in the repo into one normalized dataset (data/pcm.json)."""
import json, re, sys, unicodedata
import openpyxl

SRC = sys.argv[1]
OUT = sys.argv[2]

SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹", "01234567890123456789")
NULLS = {"", "nan", "nan.", "-", "–", "—", "----", "n.a.", "na", "none", "salt hydrate", "source"}


def clean_text(v):
    if v is None:
        return None
    s = unicodedata.normalize("NFKC", str(v)).replace(" ", " ").replace("‑", "-").strip()
    s = re.sub(r"\s+", " ", s)
    return None if s.lower() in NULLS else s


def nums(v):
    """Return list of numbers found in a cell (handles ranges like 20–25, 1720(s), 1530(l))."""
    s = clean_text(v)
    if s is None:
        return []
    if isinstance(v, (int, float)):
        return [float(v)]
    s = s.replace("−", "-").replace(",", " ")
    # treat range dash between numbers as separator, keep leading minus
    s = re.sub(r"(?<=\d)\s*[–—-]\s*(?=\d)", " ", s)
    return [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", s)]


def num(v):
    n = nums(v)
    if not n:
        return None
    return round(sum(n) / len(n), 3) if len(n) > 1 else n[0]


def sl(v):
    """Split a solid/liquid cell -> (solid, liquid)."""
    s = clean_text(v)
    if s is None:
        return None, None
    if isinstance(v, (int, float)):
        return float(v), None
    sol = re.search(r"(-?\d+(?:\.\d+)?)\s*\((?:s|solid)\)", s, re.I)
    liq = re.search(r"(-?\d+(?:\.\d+)?)\s*\((?:l|liquid)\)", s, re.I)
    if sol or liq:
        return (float(sol.group(1)) if sol else None, float(liq.group(1)) if liq else None)
    if "/" in s:
        a, b = s.split("/", 1)
        return num(a), num(b)
    return num(s), None


def rng(v):
    """Keep the original text for display when a value is a range."""
    s = clean_text(v)
    if s is None or isinstance(v, (int, float)):
        return None
    return s if len(nums(v)) > 1 else None


records = []


def add(**r):
    r = {k: v for k, v in r.items() if v not in (None, "", [])}
    if not r.get("name") or r.get("tm") is None:
        return
    records.append(r)


def ws_rows(path, sheet):
    wb = openpyxl.load_workbook(f"{SRC}/{path}", data_only=True)
    return list(wb[sheet].iter_rows(values_only=True))


# ---------- 1. pcm_data.xlsx (commercial + pure compounds, richest) ----------
MAKERS = [
    (r"^ClimSel", "Climator (Sweden)"), (r"^(RT|SP|PX|GR)[-\d_ ]", "Rubitherm (Germany)"),
    (r"^SP\d", "Rubitherm (Germany)"), (r"^(HS|FS|OM)\d", "PLUSS Advanced Technologies (India)"),
    (r"^AT[PS] ", "Axiotherm (Germany)"), (r"^Crodatherm", "Croda (UK)"),
    (r"^SmartBoard", "Knauf (Germany)"), (r"^PureTemp", "PureTemp (USA)"),
]
CLASS_MAP = {
    "salt hydrate-based": "Salt hydrate", "salt hydrate": "Salt hydrate", "ester": "Fatty ester",
    "eutectic mixture": "Eutectic", "wax": "Paraffin", "paraffin": "Paraffin", "paraffin-based composite": "Paraffin",
    "alcohol": "Fatty alcohol", "acid": "Fatty acid", "polyether": "Polymer / PEG", "amine": "Organic (other)",
}
rows = ws_rows("pcm_data.xlsx", "PCM Data")
H = {h: i for i, h in enumerate(rows[0])}
for r in rows[1:]:
    g = lambda k: r[H[k]]
    name = clean_text(g("Meta Product Name")) or clean_text(g("Meta Iupac"))
    if not name:
        continue
    maker = next((m for p, m in MAKERS if re.match(p, name)), None)
    cls = CLASS_MAP.get((clean_text(g("Meta Material Class")) or "").lower())
    oi = (clean_text(g("Meta Organic Inorganic")) or "").lower()
    if not cls:
        if re.search(r"alkane|^(eicosane|octadecane|decane|dodecane|nonadecane|pentadecane|tetradecane|heptadecane|hexadecane)$", name, re.I):
            cls = "Paraffin"
        elif "hydrate" in name.lower():
            cls = "Salt hydrate"
        elif re.search(r"itol", name, re.I):
            cls = "Sugar alcohol"
        elif re.search(r"PEG", name):
            cls = "Polymer / PEG"
        elif maker and "Rubitherm" in maker and re.match(r"^RT", name):
            cls = "Paraffin"
        elif re.match(r"^ATP ", name):
            cls = "Paraffin"
        elif re.match(r"^(Crodatherm|PureTemp)", name):
            cls = "Fatty ester"  # bio-based fatty-acid ester blends
        elif oi == "inorganic":
            t = num(g("Meta Phchangetemp")) or 0
            cls = "Eutectic" if t < 0 else ("Salt hydrate" if t < 130 else "Inorganic salt")
        else:
            cls = "Organic (other)"
    add(name=name, category=cls, nature="Commercial" if maker else ("Pure / literature"),
        manufacturer=maker, formula=clean_text(g("Meta Molecular Formula")),
        synonyms=clean_text(g("Meta Synonym")), tm=num(g("Meta Phchangetemp")),
        tpeak=num(g("Heatcap H Peak Tc")), lh=round(num(g("Heatcap H Phtrenth")), 1) if num(g("Heatcap H Phtrenth")) else None,
        htot=round(num(g("H L At T Max")), 1) if num(g("H L At T Max")) else None,
        cps=num(g("Heatcap Solid Cp")), cpl=num(g("Heatcap Liquid Cp")),
        rhos=num(g("Density Solid Rho")), rhol=num(g("Density Liquid Rho")),
        ks=num(g("Thermcond Solid Lambda")), kl=num(g("Thermcond Liquid Lambda")),
        mu=num(g("Dynvisc Liquid Mu")), beta=num(g("Thermalexpansion Liquid Coef")),
        refs=["Manufacturer datasheet" if maker else "PCM property database"])

# ---------- 2. data1.xlsx: PCM Products Ltd (PlusICE) series ----------
def plusice(sheet, cat, start):
    for r in ws_rows("data1.xlsx", sheet)[start:]:
        n = clean_text(r[0])
        if not n:
            continue
        add(name=f"PlusICE {n}", category=cat, nature="Commercial", manufacturer="PCM Products Ltd / PlusICE (UK)",
            tm=num(r[1]), rhos=num(r[3]), lh=num(r[5]), cps=num(r[9]), ks=num(r[11]), tmax=num(r[13]),
            refs=["Manufacturer datasheet"])

plusice("Sheet1", "Paraffin", 2)            # A-series organics
plusice("Sheet9", "Eutectic", 1)            # E-series sub-zero eutectics
plusice("High temp", "Inorganic salt", 2)   # H-series
plusice("Solid-Solid", "Solid-solid", 1)    # X-series
for r in ws_rows("data1.xlsx", "Sheet8")[2:]:  # S-series salt hydrates
    n = clean_text(r[0])
    if n:
        add(name=f"PlusICE {n}", category="Salt hydrate", nature="Commercial",
            manufacturer="PCM Products Ltd / PlusICE (UK)", tm=num(r[1]), rhos=num(r[2]), lh=num(r[3]),
            cps=num(r[5]), ks=num(r[6]), tmax=num(r[7]), refs=["Manufacturer datasheet"])

# ---------- 3. data3.xlsx literature tables ----------
def lit(sheet, cat, has_formula=True):
    rows = ws_rows("data3.xlsx", sheet)
    for r in rows[1:]:
        if has_formula:
            name, formula, comp, tm, lh, cp, rho, k, ref = (list(r) + [None] * 9)[:9]
        else:
            name, comp, tm, lh, cp, rho, k, ref = (list(r) + [None] * 8)[:8]
            formula = None
        name = clean_text(name)
        if not name:
            continue
        rs, rl = sl(rho)
        ks_, kl_ = sl(k)
        cs, cl = sl(cp)
        comp = clean_text(comp)
        if comp and re.fullmatch(r"\d+(\.\d+)?", comp):
            comp = None
        add(name=name, category=cat, nature="Pure / literature", formula=clean_text(formula),
            composition=comp, tm=num(tm), tm_text=rng(tm), lh=num(lh), lh_text=rng(lh),
            cps=cs, cpl=cl, rhos=rs, rhol=rl, ks=ks_, kl=kl_, refs=[clean_text(ref)] if clean_text(ref) else [])

lit("Parraffins", "Paraffin")
lit("Non-Paraffins", "Organic (other)")
lit("Salt Hydrates", "Salt hydrate")
lit("Metals", "Metal / alloy", has_formula=False)
lit("Eutectics", "Eutectic")

# ---------- 4. data1.xlsx other literature sheets ----------
for r in ws_rows("data1.xlsx", "paraffin(organic)")[1:]:
    rs, rl = sl(r[6]); ks_, kl_ = sl(r[4]); cs, cl = sl(r[5])
    add(name=clean_text(r[0]), category="Paraffin", nature="Pure / literature", formula=clean_text(r[1]),
        tm=num(r[2]), tm_text=rng(r[2]), lh=num(r[3]), lh_text=rng(r[3]), ks=ks_, kl=kl_, cps=cs, cpl=cl,
        rhos=rs, rhol=rl, refs=["Literature compilation"])
for r in ws_rows("data1.xlsx", "Non-Paraffin(organic)")[1:]:
    rs, rl = sl(r[4]); cs, cl = sl(r[3]); ks_, kl_ = sl(r[7])
    if rs is not None and rs < 0:
        rs = None
    add(name=clean_text(r[0]), category="Organic (other)", nature="Pure / literature", tm=num(r[1]),
        tm_text=rng(r[1]), lh=num(r[2]), lh_text=rng(r[2]), cps=cs, cpl=cl, rhos=rs, rhol=rl, ks=ks_, kl=kl_,
        refs=["Literature compilation"])
for r in ws_rows("data1.xlsx", "salt hydrates")[1:]:
    # NB: in this sheet the cp and latent-heat columns are swapped relative to the header
    rs, rl = sl(r[4]); cs, cl = sl(r[2]); ks_, kl_ = sl(r[7])
    add(name=clean_text(r[0]), category="Salt hydrate", nature="Pure / literature", formula=clean_text(r[8]),
        tm=num(r[1]), tm_text=rng(r[1]), lh=num(r[3]), lh_text=rng(r[3]), cps=cs, cpl=cl, rhos=rs, rhol=rl,
        ks=ks_, kl=kl_, refs=["Literature compilation"])
for r in ws_rows("data1.xlsx", "inorganic ")[1:]:
    add(name=clean_text(r[0]), category="Inorganic salt", nature="Pure / literature", formula=clean_text(r[8]),
        tm=num(r[1]), lh=num(r[2]), cps=num(r[3]), rhos=num(r[4]), ks=num(r[7]), refs=["Literature compilation"])
for r in ws_rows("data1.xlsx", "metallic")[1:]:
    add(name=clean_text(r[0]), category="Metal / alloy", nature="Pure / literature", tm=num(r[1]),
        lh=num(r[2]), cps=num(r[3]), rhos=num(r[4]), ks=num(r[7]), refs=["Literature compilation"])
for r in ws_rows("data1.xlsx", "eutectic")[1:]:
    add(name=clean_text(r[0]), category="Eutectic", nature="Pure / literature", tm=num(r[1]), lh=num(r[2]),
        composition=clean_text(r[7]), refs=["Literature compilation"])
# metallic eutectics: rows come in solid/liquid pairs
prev = None
for r in ws_rows("data1.xlsx", "eutectic1")[1:]:
    n = clean_text(r[0])
    if not n:
        continue
    if prev and prev["name"] == n:
        prev.update(cpl=num(r[3]), rhol=num(r[4]))
        add(**prev); prev = None
        continue
    if prev:
        add(**prev)
    prev = dict(name=n, category="Metal / alloy", nature="Pure / literature", tm=num(r[1]), lh=num(r[2]),
                cps=num(r[3]), rhos=num(r[4]), refs=["Fernández et al. (metal alloy PCM review)"])
if prev:
    add(**prev)

# ---------- 5. pcm_materials.xlsx (union table; only fills gaps) ----------
TYPE = {"eutectic": "Eutectic", "organic": "Organic (other)", "salt hydrate": "Salt hydrate",
        "metallic": "Metal / alloy", "inorganic": "Inorganic salt", "solid-solid": "Solid-solid"}
for r in ws_rows("pcm_materials.xlsx", "PCM Materials")[1:]:
    n = clean_text(r[0]); t = (clean_text(r[1]) or "").lower()
    if not n or re.fullmatch(r"[ASHEX]-?\d+", n):
        continue  # PlusICE codes already loaded with full data
    lh, cp = num(r[3]), sl(r[4])
    cs, cl = cp
    if lh is None and cs and cs > 20:  # swapped columns in source
        lh, cs, cl = cs, None, None
    rs, rl = sl(r[5])
    add(name=n, category=TYPE.get(t, "Organic (other)"), nature="Pure / literature", tm=num(r[2]), tm_text=rng(r[2]),
        lh=lh, lh_text=rng(r[3]), cps=cs, cpl=cl, rhos=rs, rhol=rl, cost=num(r[6]), refs=["Literature compilation"])

json.dump(records, open(OUT, "w"), ensure_ascii=False, indent=0)
print(len(records), "raw records")
