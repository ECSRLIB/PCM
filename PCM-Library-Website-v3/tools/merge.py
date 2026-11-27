"""Deduplicate raw records, fix categories, and merge in curated additions."""
import json, re, sys, unicodedata

raw = json.load(open(sys.argv[1]))
extra = json.load(open(sys.argv[2]))
OUT = sys.argv[3]

SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def key(s):
    s = unicodedata.normalize("NFKC", s).translate(SUB).lower()
    s = re.sub(r"\((c\d+)\)", "", s)
    s = re.sub(r"^(n|o|d|meso|d-|l-)[‑-]\s*", "", s)
    s = s.replace("sulfate", "sulphate").replace("aluminum", "aluminium").replace("nepthyl", "naphthyl")
    s = s.replace("heneicosane", "henicosane").replace("palmiate", "palmitate").replace("glycerine", "glycerin")
    return re.sub(r"[^a-z0-9]", "", s)


def fkey(s):
    if not s:
        return None
    s = unicodedata.normalize("NFKC", s).translate(SUB)
    s = re.sub(r"[\s·.•∙*]", "", s)
    return s.lower() if len(s) > 3 else None


ACID = r"\b(acid)\b"
FATTY_ESTER = r"(methyl|ethyl|propyl|butyl|isopropyl|vinyl|hexadecyl|octadecyl|tetradecyl|stearyl)\s?-?\w*(ate|anoate)\b|\w+(anoate|stearate|palmitate|laurate|myristate|oleate)\b"


def recategorize(r):
    n, c = r["name"], r["category"]
    nl = n.lower()
    if r.get("nature") == "Commercial" or c in ("Metal / alloy", "Solid-solid"):
        return c
    multi = bool(re.search(r"\+|\beutectic\b|\(\d+(\.\d+)?\)\s*[–-]|wt\s?%|\d+\s?%", n)) or " - " in n
    if c == "Salt hydrate" and not re.search(r"hydrat|h2o|h₂o|·\s?\d*h|water", nl):
        return "Eutectic" if multi and not re.search(r"cl|f\)|no₃|no3|co₃|co3|so4|so₄|oh", nl) else "Molten / inorganic salt"
    if c == "Inorganic salt":
        if re.search(r"water|h2o|h₂o|ice", nl):
            return "Inorganic (other)"
        return "Molten / inorganic salt" if (r.get("tm") or 0) > 100 else "Inorganic (other)"
    if multi and c not in ("Eutectic",):
        return "Eutectic"
    if c in ("Organic (other)", "Paraffin", "Fatty ester", "Fatty alcohol", "Fatty acid"):
        if re.search(r"polyethylene glycol|polyglycol|\bpeg\b", nl):
            return "Polymer / PEG"
        if re.search(r"(erythr|mannit|xylit|sorbit|dulcit|galactit|inosit|arabit|ribit|adonit|threit)ol|pentaerythritol", nl):
            return "Sugar alcohol"
        if re.search(ACID, nl):
            return "Fatty / organic acid"
        if re.search(FATTY_ESTER, nl):
            return "Fatty ester"
        if re.search(r"(an|en|yl)ol\b|alcohol|\bol$", nl) and "glycol" not in nl and "phenol" not in nl:
            return "Fatty alcohol"
        if re.search(r"(^|[^a-z])(n-)?\w*(decane|cosane|contane|triacontane|pentane|hexane|octane|nonane|paraffin)\b|^paraffin|wax", nl):
            return "Paraffin"
        if c == "Paraffin":  # data1 'paraffin' sheet mixes non-paraffins
            return "Organic (other)"
    return c


fixes = []
# --- drop corrupted rows ---
clean = []
for r in raw:
    if any((r.get(f) is not None and r[f] < 0) for f in ("rhos", "rhol")) and r.get("refs") == ["PCM property database"]:
        fixes.append(f"dropped corrupted duplicate row: {r['name']} (negative density, Tm {r['tm']})"); continue
    if r["name"] == "Methanoic acid" and r["tm"] < -20:
        fixes.append("dropped Methanoic acid row with Tm -49.6 °C (formic acid melts at ~8 °C)"); continue
    clean.append(r)
raw = clean
# --- lost minus signs: same compound reported at +T and -T ---
bykey = {}
for r in raw:
    bykey.setdefault(key(r["name"]), []).append(r)
raw2 = []
for r in raw:
    if r.get("nature") != "Commercial" and r["tm"] > 2 and any(o.get("nature") != "Commercial" and o is not r and abs(o["tm"] + r["tm"]) <= 4 for o in bykey[key(r["name"])]):
        fixes.append(f"dropped {r['name']} Tm +{r['tm']} (sign lost; other sources give negative)"); continue
    raw2.append(r)
raw = raw2
# --- unit / plausibility checks on properties ---
for r in raw:
    metal = r["category"] == "Metal / alloy"
    for f in ("rhos", "rhol"):
        v = r.get(f)
        if v is None: continue
        if 0 < v < 3:
            r[f] = round(v * 1000, 1); fixes.append(f"{r['name']}: {f} {v} g/cm³ → {r[f]} kg/m³")
        elif v < 0 or (v < 600 and not metal) or (metal and v < 450):
            r.pop(f); fixes.append(f"{r['name']}: removed implausible density {v}")
    for f in ("cps", "cpl"):
        if r.get(f) is not None and (r[f] > 10 or r[f] <= 0):
            fixes.append(f"{r['name']}: removed implausible cp {r[f]}"); r.pop(f)
    for f in ("ks", "kl"):
        if r.get(f) is not None and r[f] > 5 and not metal and r["tm"] < 300:
            fixes.append(f"{r['name']}: removed implausible k {r[f]}"); r.pop(f)
    if r.get("lh") is not None and (r["lh"] <= 0 or (r["lh"] > 1300 and not metal)):
        fixes.append(f"{r['name']}: removed implausible latent heat {r['lh']}"); r.pop("lh")

WORDS = sorted("""lithium sodium potassium calcium magnesium zinc aluminium aluminum manganese iron ferric nickel cobalt cadmium
barium strontium ammonium copper chromium tri tetra penta hexa hepta octa nona deca dodeca mono di hydrate hydrogen
chloride bromide iodide fluoride nitrate nitrite sulphate sulfate thiosulphate thiosulfate phosphate acetate carbonate
hydroxide chlorate perchlorate borate metaborate oxalate formate sulphite sulfite alum acid lauric stearic palmitic myristic
capric benzoic glutaric n hydrated anhydrous ethylene glycol tri""".split(), key=len, reverse=True)


def segment(s):
    out, i, low = [], 0, s.lower()
    while i < len(low):
        for w in WORDS:
            if low.startswith(w, i):
                out.append(w); i += len(w); break
        else:
            if low[i].isdigit() or low[i] == "-":
                j = i
                while j < len(low) and (low[j].isdigit() or low[j] == "-"): j += 1
                out.append(low[i:j]); i = j
            else:
                return None
    txt = " ".join(out)
    for a, b in [("tri hydrate", "trihydrate"), ("di hydrate", "dihydrate"), ("hexa hydrate", "hexahydrate"), ("tetra hydrate", "tetrahydrate"),
                 ("penta hydrate", "pentahydrate"), ("hepta hydrate", "heptahydrate"), ("octa hydrate", "octahydrate"), ("nona hydrate", "nonahydrate"),
                 ("deca hydrate", "decahydrate"), ("dodeca hydrate", "dodecahydrate"), ("mono hydrate", "monohydrate"), ("n lauric", "n-lauric")]:
        txt = txt.replace(a, b)
    return txt[0].upper() + txt[1:]


for r in raw:
    n = r["name"]
    if " " not in n and len(n) > 12 and n.isascii():
        s = segment(n)
        if s and s.count(" ") >= 1:
            r["name"] = s

for r in raw:
    r["category"] = recategorize(r)
    r["category"] = {"Fatty acid": "Fatty / organic acid", "Inorganic salt": "Molten / inorganic salt"}.get(r["category"], r["category"])

# --- union-find dedupe on (name key or formula key) with close melting point ---
parent = list(range(len(raw)))


def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i


index = {}
for i, r in enumerate(raw):
    ks = {("n", key(r["name"]))}
    fk = fkey(r.get("formula"))
    if fk and r.get("nature") != "Commercial":
        ks.add(("f", fk))
    nk = fkey(r["name"])
    if nk and r.get("nature") != "Commercial":
        ks.add(("f", nk))
    for k in ks:
        for j in index.get(k, []):
            if abs((raw[j]["tm"]) - r["tm"]) <= 4 and (raw[j].get("nature") == "Commercial") == (r.get("nature") == "Commercial"):
                parent[find(i)] = find(j)
        index.setdefault(k, []).append(i)

groups = {}
for i in range(len(raw)):
    groups.setdefault(find(i), []).append(raw[i])

FIELDS = ["formula", "composition", "synonyms", "manufacturer", "tm", "tm_text", "tpeak", "lh", "lh_text", "htot", "cps",
          "cpl", "rhos", "rhol", "ks", "kl", "mu", "beta", "tmax", "cost"]


def best_name(names):
    # prefer readable names: has spaces/hyphens, not all run-together
    return sorted(names, key=lambda n: (" " not in n and "-" not in n and len(n) > 14, names.index(n)))[0]


merged = []
for g in groups.values():
    m = {"name": best_name([r["name"] for r in g]), "category": g[0]["category"], "nature": g[0]["nature"]}
    for f in FIELDS:
        for r in g:
            if r.get(f) is not None:
                m[f] = r[f]
                break
    refs, reports, seen = [], [], set()
    for r in g:
        for ref in r.get("refs", []):
            if ref not in refs:
                refs.append(ref)
        sig = (r.get("tm"), r.get("lh"))
        if sig not in seen:
            seen.add(sig)
            reports.append({"tm": r.get("tm"), "lh": r.get("lh"), "ref": (r.get("refs") or [""])[0]})
    m["refs"] = refs
    if len(reports) > 1:
        m["reports"] = reports
    aliases = sorted({r["name"] for r in g} - {m["name"]})
    if aliases:
        m["aliases"] = aliases
    merged.append(m)

# sanity: drop latent heat outliers clearly mis-entered (e.g. kJ/m3 in kJ/kg column)
for m in merged:
    if m.get("lh") and m["lh"] > 1500 and m["category"] not in ("Metal / alloy",):
        m.pop("lh")

# --- curated additions (only if not already present) ---
existing = {key(m["name"]) for m in merged} | {key(a) for m in merged for a in m.get("aliases", [])}
existing_f = {fkey(m.get("formula")) for m in merged if fkey(m.get("formula"))}
added = 0
skipped_same = []
for e in extra:
    k = key(e["name"]); fe = fkey(e.get("formula"))
    sym = (e.get("formula") or "").lower()
    def same(m):
        if key(m["name"]) == k or k in {key(a) for a in m.get("aliases", [])}:
            return True
        if fe and fkey(m.get("formula")) == fe and abs(m["tm"] - e["tm"]) < 4:
            return True
        # pure element symbol written as the record name, e.g. 'Sn' for Tin
        if e["category"] == "Metal / alloy" and len(sym) <= 2 and m["name"].lower() == sym and abs(m["tm"] - e["tm"]) < 6:
            return True
        return False
    match = next((m for m in merged if same(m)), None)
    if match and abs(match["tm"] - e["tm"]) > 10:
        # handbook value disagrees strongly: keep handbook value as primary, keep old one as a report
        fixes.append(f"{match['name']}: Tm {match['tm']} -> {e['tm']} °C, ΔH {match.get('lh')} -> {e.get('lh')} (handbook value: {e['refs'][0]})")
        match.setdefault("reports", [{"tm": match["tm"], "lh": match.get("lh"), "ref": (match["refs"] or [""])[0]}])
        match["reports"].append({"tm": e["tm"], "lh": e.get("lh"), "ref": e["refs"][0]})
        for f in FIELDS:
            if e.get(f) is not None:
                match[f] = e[f]
    if match:
        for f in FIELDS:
            if match.get(f) is None and e.get(f) is not None:
                match[f] = e[f]
        if e["category"] == "Metal / alloy":
            match["category"] = "Metal / alloy"
        if not re.search(r"[a-z]{4}", match["name"]) and e["name"] != match["name"]:
            match.setdefault("aliases", []).append(match["name"])
            match["name"] = e["name"]
            match["formula"] = match.get("formula") or e.get("formula")
        for ref in e.get("refs", []):
            if ref not in match["refs"]:
                match["refs"].append(ref)
        continue
    if e.get("nature") != "Commercial" and e.get("lh") is not None and any(
            abs(x["tm"] - e["tm"]) <= 0.6 and x.get("lh") is not None and abs(x["lh"] - e["lh"]) <= 1.5 and x.get("nature") != "Commercial" for x in merged):
        skipped_same.append(e["name"]); continue
    e = dict(e)
    e["added"] = True
    merged.append(e)
    existing.add(k)
    added += 1

METALS = {"zn","zinc","al","aluminium","mg","magnesium","cu","copper","sn","tin","pb","lead","bi","bismuth","ga","gallium","in","indium",
          "cd","cadmium","li","lithium","na","sodium","k","potassium","si","silicon","ni","nickel","fe","iron","mn","cr","sb","rb","rubidium","cs","cesium","hg","mercury"}
for m in merged:
    if m["category"] != "Metal / alloy" and (m["name"].lower() in METALS or (m.get("formula") or "").lower() in METALS):
        fixes.append(f"{m['name']}: reclassified {m['category']} -> Metal / alloy")
        m["category"] = "Metal / alloy"


# final pass: identical names in the same class with the same melting point are one material
final, seen = [], {}
for m in merged:
    k2 = (m["name"].lower(), m["category"])
    o = seen.get(k2)
    if o is not None and abs(o["tm"] - m["tm"]) <= 3:
        for f in FIELDS:
            if o.get(f) is None and m.get(f) is not None:
                o[f] = m[f]
        o["refs"] += [r for r in m["refs"] if r not in o["refs"]]
        o.setdefault("reports", [{"tm": o["tm"], "lh": o.get("lh"), "ref": (o["refs"] or [""])[0]}]).append({"tm": m["tm"], "lh": m.get("lh"), "ref": (m["refs"] or [""])[0]})
        fixes.append(f"merged duplicate {m['name']} ({m['tm']} °C)")
        continue
    seen[k2] = m
    final.append(m)
merged = final
for m in merged:
    if m.get("aliases"):
        m["aliases"] = sorted({a for a in m["aliases"] if a.lower() != m["name"].lower()})
        if not m["aliases"]:
            m.pop("aliases")

merged.sort(key=lambda m: (m["tm"], m["name"]))
for i, m in enumerate(merged, 1):
    m["id"] = i
    for f in list(m):
        if isinstance(m[f], float):
            m[f] = round(m[f], 4)
json.dump(merged, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
open("fixes.log", "w").write("\n".join(fixes))
print(len(fixes), "data fixes logged")
from collections import Counter
print(len(merged), "unique PCMs;", added, "newly added;", len(skipped_same), "skipped as same values already present")
print(Counter(m["category"] for m in merged))
