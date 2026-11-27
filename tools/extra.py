"""Curated additional PCMs (well-established literature / handbook values). Writes extra.json."""
import json

CRC = "CRC Handbook of Chemistry and Physics"
KEN = "Kenisarin 2010, Renew. Sustain. Energy Rev. 14:955"
ZAL = "Zalba et al. 2003, Appl. Therm. Eng. 23:251"
SHA = "Sharma et al. 2009, Renew. Sustain. Energy Rev. 13:318"
PIE = "Pielichowska & Pielichowski 2014, Prog. Mater. Sci. 65:67"
YUA = "Yuan et al. 2014, Renew. Sustain. Energy Rev. 29:482"
SOL = "Solé et al. 2014, Sol. Energy Mater. Sol. Cells 126:125"
FAR = "Farid et al. 2004, Energy Convers. Manag. 45:1597"

M, S, H, P, A, F, SS, E = ("Metal / alloy", "Molten / inorganic salt", "Salt hydrate", "Polymer / PEG",
                           "Fatty / organic acid", "Fatty alcohol", "Solid-solid", "Eutectic")
rows = [
    # name, category, formula, Tm, LH, cps, cpl, rhos, rhol, ks, kl, ref
    # ---- pure metals ----
    ("Aluminium", M, "Al", 660.3, 397, 0.90, 1.18, 2700, 2375, 237, 91, CRC),
    ("Zinc", M, "Zn", 419.5, 112, 0.39, 0.48, 7140, 6570, 116, 50, CRC),
    ("Lead", M, "Pb", 327.5, 23.0, 0.13, 0.15, 11340, 10660, 35, 15.4, CRC),
    ("Indium", M, "In", 156.6, 28.6, 0.233, None, 7310, 7020, 82, 42, CRC),
    ("Lithium", M, "Li", 180.5, 432, 3.58, 4.38, 534, 512, 85, 43, CRC),
    ("Sodium", M, "Na", 97.8, 113, 1.23, 1.38, 968, 927, 142, 87, CRC),
    ("Potassium", M, "K", 63.5, 59.6, 0.76, 0.82, 862, 828, 102, 54, CRC),
    ("Rubidium", M, "Rb", 39.3, 25.6, 0.36, None, 1532, 1460, 58, None, CRC),
    ("Magnesium", M, "Mg", 650, 349, 1.02, 1.36, 1738, 1584, 156, 79, CRC),
    ("Copper", M, "Cu", 1084.6, 209, 0.385, 0.495, 8960, 8020, 401, 163, CRC),
    ("Silicon", M, "Si", 1414, 1787, 0.71, 0.91, 2329, 2570, 149, None, CRC),
    ("Tin", M, "Sn", 231.9, 59.2, 0.228, 0.24, 7265, 6990, 67, 30, CRC),
    ("Bismuth", M, "Bi", 271.4, 54.1, 0.122, 0.146, 9780, 10050, 8, 13, CRC),
    ("Al–12.6Si eutectic (AlSi12)", M, "Al-12.6 wt% Si", 577, 560, None, None, 2700, None, 160, None, KEN),
    ("Zn–3.9Al eutectic", M, "Zn-3.9 wt% Al", 382, 118, None, None, 6630, None, None, None, KEN),
    # ---- molten / inorganic salts ----
    ("Sodium nitrate", S, "NaNO3", 306.8, 172, None, 1.82, 2260, 1908, 0.56, 0.51, KEN),
    ("Potassium nitrate", S, "KNO3", 334, 97, None, 1.22, 2110, 1865, 0.5, 0.42, KEN),
    ("Sodium hydroxide", S, "NaOH", 318, 165, None, 2.08, 2130, 1780, 0.92, None, KEN),
    ("Sodium chloride", S, "NaCl", 801, 482, None, 1.15, 2160, 1556, 5.0, 0.5, CRC),
    ("Lithium chloride", S, "LiCl", 610, 470, None, None, 2068, 1502, None, None, CRC),
    ("Magnesium chloride", S, "MgCl2", 714, 452, None, None, 2320, 1680, None, None, KEN),
    ("Calcium chloride", S, "CaCl2", 772, 253, None, None, 2150, None, None, None, KEN),
    ("Sodium carbonate", S, "Na2CO3", 854, 276, None, None, 2533, 1972, 2.0, None, KEN),
    ("Lithium carbonate", S, "Li2CO3", 723, 509, None, None, 2110, 1830, None, None, KEN),
    ("Solar Salt (60 wt% NaNO3 – 40 wt% KNO3)", E, "NaNO3-KNO3 60/40", 222, 105, None, 1.5, 2000, 1900, None, 0.52,
     "Bauer et al., Sandia/DLR molten-salt data"),
    # ---- salt hydrates ----
    ("Barium hydroxide octahydrate", H, "Ba(OH)2·8H2O", 78, 266, 1.17, 1.92, 2180, 1937, 1.225, 0.653, ZAL),
    ("Magnesium nitrate hexahydrate", H, "Mg(NO3)2·6H2O", 89, 162.8, 1.81, 2.49, 1636, 1550, 0.611, 0.490, ZAL),
    ("Magnesium chloride hexahydrate", H, "MgCl2·6H2O", 117, 168.6, 2.25, 2.61, 1569, 1450, 0.704, 0.570, ZAL),
    ("Disodium hydrogen phosphate dodecahydrate", H, "Na2HPO4·12H2O", 35, 280, 1.69, 1.94, 1522, 1442, None, 0.476, ZAL),
    ("Potassium fluoride tetrahydrate", H, "KF·4H2O", 18.5, 231, 1.84, 2.39, 1455, 1447, None, None, ZAL),
    ("Zinc nitrate hexahydrate", H, "Zn(NO3)2·6H2O", 36, 147, 1.34, 2.26, 1937, 1828, None, 0.464, ZAL),
    ("Sodium sulphate decahydrate (Glauber's salt)", H, "Na2SO4·10H2O", 32.4, 254, 1.93, 3.26, 1485, 1458, 0.544, None, ZAL),
    ("Sodium acetate trihydrate", H, "CH3COONa·3H2O", 58, 264, 1.68, 2.37, 1450, 1280, None, None, ZAL),
    ("Ammonium alum (NH4Al(SO4)2·12H2O)", H, "NH4Al(SO4)2·12H2O", 95, 269, None, None, 1640, None, None, None, SHA),
    # ---- sugar alcohols ----
    ("Xylitol", "Sugar alcohol", "C5H12O5", 94, 263, 1.27, 2.36, 1520, 1330, None, None, SOL),
    ("D-Sorbitol", "Sugar alcohol", "C6H14O6", 97, 185, None, None, 1490, None, None, None, SOL),
    ("myo-Inositol", "Sugar alcohol", "C6H12O6", 224, 258, None, None, 1752, None, None, None, SOL),
    ("Erythritol", "Sugar alcohol", "C4H10O4", 118, 340, 1.38, 2.76, 1480, 1300, 0.733, 0.326, SOL),
    ("D-Mannitol", "Sugar alcohol", "C6H14O6", 167, 316, 1.31, 2.36, 1489, None, None, None, SOL),
    # ---- polymers ----
    ("PEG 400", P, "HO(C2H4O)nH, Mn≈400", 3.2, 91.4, None, None, 1125, 1128, None, 0.187, PIE),
    ("PEG 1000", P, "HO(C2H4O)nH, Mn≈1000", 37, 168, None, None, 1200, 1100, None, None, PIE),
    ("PEG 1500", P, "HO(C2H4O)nH, Mn≈1500", 46, 176, None, None, 1210, 1090, None, None, PIE),
    ("PEG 2000", P, "HO(C2H4O)nH, Mn≈2000", 52, 178, None, None, 1210, 1090, None, None, PIE),
    ("PEG 4000", P, "HO(C2H4O)nH, Mn≈4000", 59, 189, None, None, 1212, 1100, None, None, PIE),
    ("PEG 20000", P, "HO(C2H4O)nH, Mn≈20000", 63, 187, None, None, 1215, None, None, None, PIE),
    ("HDPE (high-density polyethylene)", P, "(C2H4)n", 132, 200, 1.9, 2.3, 950, 760, 0.45, 0.25, FAR),
    # ---- fatty acids / alcohols ----
    ("Caprylic acid (octanoic acid)", A, "C8H16O2", 16.3, 149, 1.94, 2.46, 981, 862, 0.149, None, YUA),
    ("Lauric acid (dodecanoic acid)", A, "C12H24O2", 43.8, 178, 1.76, 2.27, 1007, 862, 0.160, 0.147, YUA),
    ("Myristic acid (tetradecanoic acid)", A, "C14H28O2", 54, 187, 1.70, 2.40, 990, 861, None, None, YUA),
    ("Palmitic acid (hexadecanoic acid)", A, "C16H32O2", 62.5, 203, 1.80, 2.20, 989, 850, 0.165, 0.162, YUA),
    ("Stearic acid (octadecanoic acid)", A, "C18H36O2", 69.4, 202, 1.59, 2.20, 965, 848, 0.172, 0.162, YUA),
    ("Arachidic acid (eicosanoic acid)", A, "C20H40O2", 75.5, 227, None, None, None, 824, None, None, YUA),
    ("Behenic acid (docosanoic acid)", A, "C22H44O2", 80, 233, None, None, None, 822, None, None, YUA),
    # ---- solid-solid organics ----
    ("Neopentyl glycol (NPG)", SS, "C5H12O2", 43, 125, None, None, 1060, None, None, None, PIE),
    ("Trimethylolethane (TME)", SS, "C5H12O3", 81, 192, None, None, 1220, None, None, None, PIE),
    ("2-Amino-2-methyl-1,3-propanediol (AMPL)", SS, "C4H11NO2", 78, 264, None, None, 1200, None, None, None, PIE),
    ("Pentaerythritol (PE)", SS, "C5H12O4", 188, 269, None, None, 1390, None, None, None, PIE),
    # ---- water / ice ----
    ("Water / ice", "Inorganic (other)", "H2O", 0, 333.6, 2.05, 4.22, 917, 1000, 2.22, 0.56, CRC),
]
lh_text = {"Neopentyl glycol (NPG)": "119–131", "Solar Salt (60 wt% NaNO3 – 40 wt% KNO3)": "~100–110"}
tm_text = {"Neopentyl glycol (NPG)": "40–48", "Solar Salt (60 wt% NaNO3 – 40 wt% KNO3)": "222–238"}

out = []
for (n, c, f, tm, lh, cps, cpl, rs, rl, ks, kl, ref) in rows:
    d = dict(name=n, category=c, nature="Pure / literature", formula=f, tm=tm, lh=lh, cps=cps, cpl=cpl,
             rhos=rs, rhol=rl, ks=ks, kl=kl, refs=[ref])
    if n in lh_text: d["lh_text"] = lh_text[n]
    if n in tm_text: d["tm_text"] = tm_text[n]
    out.append({k: v for k, v in d.items() if v is not None})

# commercial products from public datasheets
out += [
    dict(name="BioPCM Q23", category="Fatty ester", nature="Commercial", manufacturer="Phase Change Solutions (USA)",
         tm=23, lh=230, lh_text="210–250", refs=["BioPCM Q23 technical data sheet"]),
    dict(name="vivtek 29 (microencapsulated)", category="Fatty ester", nature="Commercial",
         manufacturer="Microtek Laboratories (USA)", tm=31, lh=170, refs=["Microtek product announcement (PureTemp news, 2018)"]),
]
json.dump(out, open("extra.json", "w"), ensure_ascii=False, indent=1)
print(len(out), "curated entries")
