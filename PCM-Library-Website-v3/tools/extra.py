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

# ======================= batch 2 (Nov 2026) =======================
SAR = "Sarı & Kaygusuz fatty-acid eutectic series, via Yuan et al. 2014"
ABH = "Abhat 1983, Sol. Energy 30:313; via Sharma et al. 2009"
ORO = "Oró et al. 2012, Appl. Energy 99:513"
OECD = "OECD/NEA Handbook on Lead-bismuth Eutectic Alloy (2015)"
FA = "Fatty / organic acid"
O = "Organic (other)"
rows += [
    # ---- binary fatty-acid eutectics (composition in mol/wt % as reported) ----
    ("Capric–lauric acid eutectic (66:34)", E, "C10H20O2 + C12H24O2", 19.1, 132, None, None, None, None, None, None, SAR),
    ("Capric–myristic acid eutectic (73.5:26.5)", E, "C10H20O2 + C14H28O2", 21.4, 152, None, None, None, None, None, None, SAR),
    ("Capric–palmitic acid eutectic (75.2:24.8)", E, "C10H20O2 + C16H32O2", 22.1, 153, None, None, None, None, None, None, SAR),
    ("Capric–stearic acid eutectic (86.6:13.4)", E, "C10H20O2 + C18H36O2", 26.8, 160, None, None, None, None, None, None, SAR),
    ("Lauric–myristic acid eutectic (66:34)", E, "C12H24O2 + C14H28O2", 34.2, 166.8, None, None, None, None, None, None, SAR),
    ("Lauric–palmitic acid eutectic (69:31)", E, "C12H24O2 + C16H32O2", 35.2, 166.3, None, None, None, None, None, None, SAR),
    ("Lauric–stearic acid eutectic (75.5:24.5)", E, "C12H24O2 + C18H36O2", 37.0, 182.7, None, None, None, None, None, None, SAR),
    ("Myristic–palmitic acid eutectic (58:42)", E, "C14H28O2 + C16H32O2", 42.6, 169.7, None, None, None, None, None, None, SAR),
    ("Myristic–stearic acid eutectic (64:36)", E, "C14H28O2 + C18H36O2", 44.1, 182.4, None, None, None, None, None, None, SAR),
    ("Palmitic–stearic acid eutectic (64.2:35.8)", E, "C16H32O2 + C18H36O2", 52.3, 181.7, None, None, None, None, None, None, SAR),
    # ---- salt-water eutectics for cold storage ----
    ("NaCl–water eutectic (22.4 wt% NaCl)", E, "NaCl + H2O", -21.2, 222.1, None, None, 1165, None, None, None, ORO),
    ("KCl–water eutectic (19.5 wt% KCl)", E, "KCl + H2O", -10.7, 283, None, None, 1126, None, None, None, ORO),
    ("ZnSO4–water eutectic (27 wt% ZnSO4)", E, "ZnSO4 + H2O", -6.5, 235, None, None, 1220, None, None, None, ORO),
    ("K2SO4–water eutectic (6.5 wt% K2SO4)", E, "K2SO4 + H2O", -1.55, 268, None, None, 1060, None, None, None, ORO),
    # ---- more salt hydrates ----
    ("Manganese nitrate hexahydrate", H, "Mn(NO3)2·6H2O", 25.8, 125.9, None, None, 1738, 1728, None, None, ZAL),
    ("Calcium bromide hexahydrate", H, "CaBr2·6H2O", 34, 115.5, None, None, 2194, 1956, None, None, ZAL),
    ("Calcium nitrate tetrahydrate", H, "Ca(NO3)2·4H2O", 47, 153, None, None, 1820, None, None, None, ZAL),
    ("Iron(III) nitrate nonahydrate", H, "Fe(NO3)3·9H2O", 47, 155, None, None, 1684, None, None, None, ZAL),
    ("Sodium metasilicate pentahydrate", H, "Na2SiO3·5H2O", 48, 168, None, None, 1749, None, None, None, ZAL),
    ("Magnesium sulphate heptahydrate", H, "MgSO4·7H2O", 48.5, 202, None, None, 1680, None, None, None, ZAL),
    ("Nickel nitrate hexahydrate", H, "Ni(NO3)2·6H2O", 57, 169, None, None, 2050, None, None, None, ZAL),
    ("Sodium hydroxide monohydrate", H, "NaOH·H2O", 58, 272, None, None, 1720, None, None, None, ZAL),
    ("Iron(II) nitrate hexahydrate", H, "Fe(NO3)2·6H2O", 60.5, 126, None, None, None, None, None, None, ZAL),
    ("Sodium aluminium sulphate dodecahydrate", H, "NaAl(SO4)2·12H2O", 61, 181, None, None, 1610, None, None, None, ZAL),
    ("Aluminium nitrate nonahydrate", H, "Al(NO3)3·9H2O", 72, 155, None, None, 1720, None, None, None, ZAL),
    ("Aluminium sulphate octadecahydrate", H, "Al2(SO4)3·18H2O", 88, 218, None, None, 1690, None, None, None, ZAL),
    ("Strontium hydroxide octahydrate", H, "Sr(OH)2·8H2O", 89, 370, None, None, 1900, None, None, None, ZAL),
    ("Potassium alum (KAl(SO4)2·12H2O)", H, "KAl(SO4)2·12H2O", 91, 184, None, None, 1757, None, None, None, ZAL),
    ("Lithium chlorate trihydrate", H, "LiClO3·3H2O", 8.1, 253, None, None, 1720, 1530, None, None, ZAL),
    ("Calcium chloride hexahydrate", H, "CaCl2·6H2O", 29.8, 190.8, 1.42, 2.22, 1802, 1562, 1.088, 0.54, ZAL),
    ("Lithium nitrate trihydrate", H, "LiNO3·3H2O", 30, 296, 1.8, 2.8, 1550, 1430, None, None, ZAL),
    ("Sodium thiosulphate pentahydrate", H, "Na2S2O3·5H2O", 48, 201, 1.46, 2.38, 1750, 1670, None, None, ZAL),
    ("Sodium carbonate decahydrate", H, "Na2CO3·10H2O", 33, 247, 1.79, 3.04, 1442, None, None, None, ZAL),
    # ---- organics (Abhat / Sharma tables) ----
    ("Biphenyl", O, "C12H10", 71, 119.2, None, None, 1166, 991, None, None, ABH),
    ("Naphthalene", O, "C10H8", 80, 147.7, 1.31, 1.73, 1145, 976, 0.341, 0.132, ABH),
    ("Acetamide", O, "C2H5NO", 81, 241, None, None, 1159, 998, None, None, ABH),
    ("Urea", O, "CH4N2O", 133, 250, None, None, 1320, None, None, None, ABH),
    ("Benzoic acid", FA, "C7H6O2", 121.7, 142.8, None, None, 1266, 1084, None, None, ABH),
    ("Sebacic acid", FA, "C10H18O4", 133, 228, None, None, 1270, None, None, None, ABH),
    ("Maleic acid", FA, "C4H4O4", 140.8, 385, None, None, 1590, None, None, None, ABH),
    ("Salicylic acid", FA, "C7H6O3", 159, 199, None, None, 1443, None, None, None, ABH),
    ("Glutaric acid", FA, "C5H8O4", 97.5, 156, None, None, 1429, None, None, None, ABH),
    ("Phenylacetic acid", FA, "C8H8O2", 76.7, 102, None, None, None, None, None, None, ABH),
    ("Hydrocinnamic acid", FA, "C9H10O2", 48, 118, None, None, None, None, None, None, ABH),
    ("Chloroacetic acid", FA, "C2H3ClO2", 56, 130, None, None, None, None, None, None, ABH),
    ("Glycolic acid", FA, "C2H4O3", 63, 109, None, None, None, None, None, None, ABH),
    ("Acrylic acid", FA, "C3H4O2", 68, 115, None, None, None, None, None, None, ABH),
    ("Heptadecanoic acid", FA, "C17H34O2", 60.6, 189, None, None, None, None, None, None, ABH),
    ("Hydroquinone", O, "C6H6O2", 172.4, 258, None, None, 1358, None, None, None, ABH),
    ("Catechol", O, "C6H6O2", 104.3, 207, None, None, 1370, None, None, None, ABH),
    ("Quinone", O, "C6H4O2", 115, 171, None, None, 1318, None, None, None, ABH),
    ("Acetanilide", O, "C8H9NO", 118.9, 222, None, None, 1210, None, None, None, ABH),
    ("Succinic anhydride", O, "C4H4O3", 119, 204, None, None, 1104, None, None, None, ABH),
    ("Stilbene", O, "C14H12", 124, 167, None, None, None, None, None, None, ABH),
    ("Benzamide", O, "C7H7NO", 127.2, 169.4, None, None, 1341, None, None, None, ABH),
    ("Phenacetin", O, "C10H13NO2", 137, 136, None, None, None, None, None, None, ABH),
    ("alpha-Glucose", "Sugar alcohol", "C6H12O6", 141, 174, None, None, 1544, None, None, None, ABH),
    ("Acetyl-p-toluidine", O, "C9H11NO", 146, 180, None, None, None, None, None, None, ABH),
    ("Benzanilide", O, "C13H11NO", 161, 162, None, None, None, None, None, None, ABH),
    ("p-Aminobenzoic acid", FA, "C7H7NO2", 187, 153, None, None, None, None, None, None, ABH),
    ("Methyl fumarate", "Fatty ester", "C6H8O4", 102, 242, None, None, None, None, None, None, ABH),
    ("alpha-Naphthol", O, "C10H8O", 96, 163, None, None, None, None, None, None, ABH),
    ("p-Xylene dichloride", O, "C8H8Cl2", 100, 138.7, None, None, None, None, None, None, ABH),
    ("Durene", O, "C10H14", 79.3, 156, None, None, None, None, None, None, ABH),
    ("Thiosinamine", O, "C4H8N2S", 77, 140, None, None, None, None, None, None, ABH),
    ("Bromocamphor", O, "C10H15BrO", 77, 174, None, None, None, None, None, None, ABH),
    ("Azobenzene", O, "C12H10N2", 67.1, 121, None, None, None, None, None, None, ABH),
    ("p-Bromophenol", O, "C6H5BrO", 63.5, 86, None, None, None, None, None, None, ABH),
    ("Beeswax", "Paraffin", None, 61.8, 177, None, None, 950, None, None, None, ABH),
    ("Trimyristin", "Fatty ester", "C45H86O6", 54, 201, None, None, 862, None, None, None, ABH),
    ("p-Dichlorobenzene", O, "C6H4Cl2", 53.1, 121, None, None, 1458, None, None, None, ABH),
    ("Diphenylamine", O, "C12H11N", 52.9, 107, None, None, 1160, None, None, None, ABH),
    ("Methyl behenate", "Fatty ester", "C23H46O2", 52, 234, None, None, None, None, None, None, ABH),
    ("Thymol", O, "C10H14O", 51.5, 115, None, None, 970, None, None, None, ABH),
    ("Camphene", O, "C10H16", 50, 238, None, None, 842, None, None, None, ABH),
    ("o-Nitroaniline", O, "C6H6N2O2", 50, 93, None, None, None, None, None, None, ABH),
    ("Methyl eicosanoate", "Fatty ester", "C21H42O2", 45, 230, None, None, None, None, None, None, ABH),
    ("Cyanamide", O, "CH2N2", 44, 209, None, None, 1080, None, None, None, ABH),
    ("p-Toluidine", O, "C7H9N", 43.3, 167, None, None, 964, None, None, None, ABH),
    ("Phenol", O, "C6H6O", 41, 120, None, None, 1070, None, None, None, ABH),
    ("Caprylone (8-pentadecanone)", O, "C15H30O", 40, 259, None, None, None, None, None, None, ABH),
    ("Camphenilone", O, "C9H14O", 39, 205, None, None, None, None, None, None, ABH),
    # ---- more metals & alloys ----
    ("Mercury", M, "Hg", -38.8, 11.4, 0.14, 0.14, 14190, 13534, 8.3, 8.25, CRC),
    ("Cadmium", M, "Cd", 321.1, 55.2, 0.231, 0.264, 8650, 8020, 97, 42, CRC),
    ("Antimony", M, "Sb", 630.6, 162.5, 0.207, 0.26, 6697, 6530, 24, 21, CRC),
    ("Germanium", M, "Ge", 938.3, 508.6, 0.32, 0.38, 5323, 5600, 60, 39, CRC),
    ("Silver", M, "Ag", 961.8, 104.6, 0.235, 0.31, 10490, 9320, 429, 175, CRC),
    ("Gold", M, "Au", 1064.2, 63.7, 0.129, 0.149, 19300, 17310, 318, 105, CRC),
    ("Calcium", M, "Ca", 842, 213, 0.647, None, 1550, 1378, 201, None, CRC),
    ("Strontium", M, "Sr", 777, 95, 0.301, None, 2640, 2375, 35, None, CRC),
    ("Barium", M, "Ba", 727, 52, 0.204, None, 3510, 3338, 18, None, CRC),
    ("Lead–bismuth eutectic (LBE, Pb-55.5Bi)", M, "Pb-55.5 wt% Bi", 124.5, 38.6, None, 0.146, 10470, 10500, None, 11, OECD),
    ("Lithium sulphate (solid–solid transition)", SS, "Li2SO4", 576, 214, None, None, 2221, None, None, None, KEN),
    # ---- molten salts ----
    ("Sodium nitrite", S, "NaNO2", 271, 180, None, None, 2168, 1810, None, None, KEN),
    ("Sodium fluoride", S, "NaF", 996, 794, None, None, 2558, 1948, None, None, CRC),
    ("Potassium chloride", S, "KCl", 771, 355, None, None, 1984, 1527, None, None, CRC),
    ("Potassium carbonate", S, "K2CO3", 898, 200, None, None, 2290, 1880, None, None, CRC),
    ("HITEC salt (53 KNO3 – 40 NaNO2 – 7 NaNO3 wt%)", E, "KNO3-NaNO2-NaNO3", 142, None, None, 1.56, 2000, 1860, None, 0.48, "Coastal Chemical HITEC data; Kenisarin 2010"),
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
    dict(name="RT52", category="Paraffin", nature="Commercial", manufacturer="Rubitherm (Germany)", tm=52, lh=173, rhos=860, rhol=770, refs=["Rubitherm datasheet values, via Int. J. Low-Carbon Technol. 8:260 (2013)"]),
    dict(name="RT58", category="Paraffin", nature="Commercial", manufacturer="Rubitherm (Germany)", tm=58, lh=179, rhos=900, rhol=760, cps=1.8, cpl=2.4, refs=["Rubitherm datasheet values, via Int. J. Low-Carbon Technol. 8:260 (2013)"]),
    dict(name="PX58 (paraffin in silica powder)", category="Paraffin", nature="Commercial", manufacturer="Rubitherm (Germany)", tm=58, lh=117, rhos=694, cps=1.6, refs=["Rubitherm datasheet values, via Int. J. Low-Carbon Technol. 8:260 (2013)"]),
    dict(name="PureTemp17", category="Fatty ester", nature="Commercial", manufacturer="PureTemp (USA)", tm=17, lh=217, refs=["PureTemp product list (puretemp.com)"]),
    dict(name="PureTemp108", category="Fatty ester", nature="Commercial", manufacturer="PureTemp (USA)", tm=108, lh=180, refs=["PureTemp product list (puretemp.com)"]),
]
json.dump(out, open("extra.json", "w"), ensure_ascii=False, indent=1)
print(len(out), "curated entries")
