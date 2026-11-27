# PCM Library — Phase Change Material Database

A free, searchable database of **1,300+ phase change materials (PCMs)** for thermal energy storage research. It's built by the **Energy Conversion & Storage Research (ECSR) Lab**.

🔗 **Live site:** https://ecsrlib.github.io/pcmlibrary.github.io/

## Features

- **Search** by name, chemical formula, composition, manufacturer or synonym
- **Filter** by material class, temperature range, minimum latent heat, manufacturer, data completeness, and literature vs. commercial
- **Application presets:** cold chain, buildings, solar hot water, electronics cooling, industrial heat, CSP
- **Property map:** interactive scatter plot of latent heat (kJ/kg or MJ/m³) against phase change temperature
- **Detail panel** for each material, with solid/liquid properties, volumetric storage, values from different sources, and references. Each panel has its own shareable link (`#pcm-ID`)
- **Compare** up to four materials side by side
- **Export** filtered results as CSV, or download the whole dataset ([`data/pcm.csv`](data/pcm.csv), [`data/pcm.json`](data/pcm.json))

## What's in the data

| Class | Examples |
|---|---|
| Paraffins | n-alkanes C10–C100, paraffin waxes, Rubitherm RT, Axiotherm ATP, PlusICE A |
| Fatty acids, esters, alcohols | capric, lauric, myristic, palmitic and stearic acids; methyl/ethyl/cetyl esters; Crodatherm; PureTemp |
| Sugar alcohols & polymers | erythritol, xylitol, mannitol, inositol; PEG 400–20000; HDPE |
| Salt hydrates | CaCl₂·6H₂O, Na₂SO₄·10H₂O, CH₃COONa·3H₂O; ClimSel; PLUSS savE HS; PlusICE S |
| Molten / inorganic salts | nitrates, chlorides, fluorides, carbonates; Solar Salt; PlusICE H |
| Metals & alloys | Ga, In, Sn, Bi, Zn, Al, Mg, Cu, Si; Al–Si, Al–Cu, Al–Mg–Zn eutectics |
| Eutectics & solid–solid | organic/inorganic eutectics; NPG, TME, AMPL, pentaerythritol; PlusICE X |

### How the dataset is built

The original spreadsheets in [`data/source/`](data/source) (`pcm_data.xlsx`, `pcm_materials.xlsx`, `data1.xlsx`, `data3.xlsx`) are merged by the scripts in [`tools/`](tools):

```bash
python3 tools/extra.py                              # writes extra.json (curated handbook additions)
python3 tools/ingest.py data/source raw.json        # reads every sheet into one normalized list
python3 tools/merge.py raw.json extra.json data/pcm.json   # dedupes, checks, adds new entries
```

The merge step combines duplicates of the same material and keeps every reported value with its source. It also fixes common errors: lost minus signs, g/cm³ written as kg/m³, values in the wrong column, and impossible values. Each fix is logged in [`data/data-fixes.txt`](data/data-fixes.txt).

After you change the spreadsheets, rerun the scripts and commit the new `data/pcm.json`. Then regenerate `data/pcm.csv` (see `tools/README.md`).

## Folder structure

```
index.html          database page
about.html          about the ECSR Lab
404.html            not-found page
assets/             CSS, JavaScript, logo, icons, background video
data/pcm.json       the database (loaded by the website)
data/pcm.csv        the database as a spreadsheet
data/data-fixes.txt every automatic data correction
data/source/        original Excel spreadsheets
tools/              Python scripts that rebuild data/pcm.json
.github/workflows/  GitHub Pages auto-deploy
```

## Running locally

This is a static site: no build step and no framework. The data is loaded with `fetch`, so serve the folder rather than opening the file directly:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deployment

The site deploys automatically to GitHub Pages through `.github/workflows/static.yml` on every push to `main`.

## Disclaimer

Values come from published literature and manufacturer datasheets. They can differ between sources because of sample purity and measurement method. Always confirm critical design values against the original reference.

## Credits

- **Created by:** Sonu Singh (M.Tech)
- **Supervised by:** Dr. Shobhana Singh
- **ECSR Lab** — Energy Conversion & Storage Research Laboratory

If you use this database, please cite it (see the *How to cite* section on the About page) and the original sources of the values you use.
