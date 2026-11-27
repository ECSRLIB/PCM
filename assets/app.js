/* PCM Library — client app: filters, six linked SVG charts, table, details, comparison. No dependencies. */
(() => {
  "use strict";

  // ---------- families (8 colour slots, fixed order, validated palette in style.css) ----------
  const FAMS = [
    { id: "par", name: "Paraffins", cats: ["Paraffin"] },
    { id: "fat", name: "Fatty compounds", long: "Fatty acids, esters & alcohols", cats: ["Fatty / organic acid", "Fatty ester", "Fatty alcohol"] },
    { id: "hyd", name: "Salt hydrates", cats: ["Salt hydrate"] },
    { id: "pol", name: "Polyols & polymers", long: "Sugar alcohols, polymers & solid–solid", cats: ["Sugar alcohol", "Polymer / PEG", "Solid-solid"] },
    { id: "eut", name: "Eutectics", cats: ["Eutectic"] },
    { id: "mol", name: "Molten salts", long: "Molten & inorganic salts", cats: ["Molten / inorganic salt"] },
    { id: "met", name: "Metals & alloys", cats: ["Metal / alloy"] },
    { id: "oth", name: "Other", long: "Other organic & inorganic", cats: [] },
  ];
  const CAT2FAM = {};
  FAMS.forEach((f, i) => { f.i = i; f.cats.forEach((c) => (CAT2FAM[c] = f)); });
  const famOf = (cat) => CAT2FAM[cat] || FAMS[7];
  let COL = [];
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    COL = FAMS.map((_, i) => cs.getPropertyValue(`--c${i + 1}`).trim());
    SEQ = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => cs.getPropertyValue(`--s${i}`).trim());
  };
  let SEQ = [];
  const PRESETS = { cold: [-40, 8], building: [18, 30], body: [28, 40], electronics: [35, 75], solar: [40, 90], industrial: [100, 300], csp: [300, null] };
  const ZONES = [[-40, 8, "Cold chain"], [18, 30, "Buildings"], [40, 90, "Solar DHW"], [100, 300, "Industrial"], [300, 700, "CSP"]];
  const BANDS = [[-Infinity, 0, "< 0"], [0, 30, "0–30"], [30, 60, "30–60"], [60, 100, "60–100"], [100, 200, "100–200"], [200, 400, "200–400"], [400, 700, "400–700"], [700, Infinity, "> 700"]];
  const PAGE = 50;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? null : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en") : (+v.toFixed(d)).toString());
  const cell = (v, d) => fmt(v, d) ?? '<span class="dash">—</span>';
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* unavailable */ } },
  };
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quant = (s, p) => { const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };

  let DATA = [], VIEW = [], BYID = new Map();
  const state = {
    q: "", fams: new Set(), hidden: new Set(), nature: "", tmin: null, tmax: null, lhmin: null, maker: "", hasLH: false, full: false,
    sort: { key: "tm", dir: 1 }, page: 1, sy: "lh", sx: "fit", hx: "low", bm: "lh", rk: "lh",
    compare: store.get("pcm-compare", []),
  };

  // ---------- load ----------
  readColors();
  fetch("data/pcm.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(() => { $("#count").textContent = "Could not load the dataset. Please refresh the page."; });

  function init(json) {
    DATA = json.map((m) => {
      const rho = m.rhos ?? m.rhol ?? null;
      const f = famOf(m.category);
      const o = { ...m, f, fam: f.i, rho, cp: m.cps ?? m.cpl ?? null, k: m.ks ?? m.kl ?? null, vol: m.lh && rho ? (m.lh * rho) / 1000 : null };
      o._s = [m.name, m.formula, m.composition, m.manufacturer, m.category, f.name, m.synonyms, ...(m.aliases || [])]
        .filter(Boolean).join(" ").toLowerCase().normalize("NFKC")
        .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 8320)).replace(/[·•]/g, ".");
      return o;
    });
    DATA.forEach((m) => BYID.set(m.id, m));
    state.compare = state.compare.filter((id) => BYID.has(id));
    buildStatic();
    bindUI();
    apply();
    openFromHash();
  }

  function buildStatic() {
    const tms = DATA.map((m) => m.tm);
    $("#s-total").textContent = DATA.length.toLocaleString("en");
    $("#s-com").textContent = DATA.filter((m) => m.nature === "Commercial").length;
    $("#s-range").textContent = `${Math.round(Math.min(...tms))} → ${Math.round(Math.max(...tms)).toLocaleString("en")} °C`;
    $("#s-refs").textContent = new Set(DATA.flatMap((m) => m.refs || [])).size + "+";
    const counts = FAMS.map((f) => DATA.filter((m) => m.fam === f.i).length);
    $("#f-fam").innerHTML = FAMS.map((f) => `<label class="fam"><input type="checkbox" value="${f.i}"><i style="background:var(--c${f.i + 1})"></i>${esc(f.long || f.name)}<span class="n">${counts[f.i]}</span></label>`).join("");
    const makers = [...new Set(DATA.map((m) => m.manufacturer).filter(Boolean))].sort();
    $("#maker").insertAdjacentHTML("beforeend", makers.map((m) => `<option>${esc(m)}</option>`).join(""));
    // references
    const n = {};
    DATA.forEach((m) => (m.refs || []).forEach((r) => (n[r] = (n[r] || 0) + 1)));
    const generic = /^(Manufacturer datasheet|Literature compilation|PCM property database)$/;
    $("#refs").innerHTML = Object.entries(n).filter(([r]) => !generic.test(r)).sort((a, b) => b[1] - a[1])
      .map(([r, c]) => `<li>${esc(r)} <span class="note">(${c})</span></li>`).join("") +
      `<li>Manufacturer technical datasheets <span class="note">(${n["Manufacturer datasheet"] || 0})</span></li>` +
      `<li>Open PCM property databases and literature compilations <span class="note">(${(n["PCM property database"] || 0) + (n["Literature compilation"] || 0)})</span></li>`;
    drawHero();
  }

  // ---------- UI ----------
  function bindUI() {
    let t;
    const onQ = (v) => { clearTimeout(t); t = setTimeout(() => { state.q = v.trim(); state.page = 1; apply(); }, 140); };
    $("#q").addEventListener("input", (e) => { $("#hq").value = e.target.value; onQ(e.target.value); });
    $("#hq").addEventListener("input", (e) => { $("#q").value = e.target.value; onQ(e.target.value); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus(); }
      if (e.key === "Escape") { closeDetail(); $$(".pop.open").forEach(closePop); }
    });
    // popovers
    $$(".pop").forEach((p) => {
      const b = p.querySelector(".ctl");
      b.addEventListener("click", (e) => { e.stopPropagation(); const o = !p.classList.contains("open"); $$(".pop.open").forEach(closePop); if (o) { p.classList.add("open"); b.setAttribute("aria-expanded", "true"); } });
      p.querySelector(".pop-panel").addEventListener("click", (e) => e.stopPropagation());
    });
    document.addEventListener("click", () => $$(".pop.open").forEach(closePop));
    $("#f-fam").addEventListener("change", (e) => {
      const i = +e.target.value; e.target.checked ? state.fams.add(i) : state.fams.delete(i);
      state.page = 1; apply();
    });
    $$("[data-nature]").forEach((b) => b.addEventListener("click", () => { state.nature = b.dataset.nature; press(b, "[data-nature]"); state.page = 1; apply(); }));
    const numIn = (id, key, preset) => $(id).addEventListener("input", (e) => {
      const v = e.target.value === "" ? null : +e.target.value;
      state[key] = Number.isFinite(v) ? v : null; state.page = 1; if (preset) clearPresets(); apply();
    });
    numIn("#tmin", "tmin", true); numIn("#tmax", "tmax", true); numIn("#lhmin", "lhmin");
    $("#maker").addEventListener("change", (e) => { state.maker = e.target.value; state.page = 1; apply(); });
    $("#f-lh").addEventListener("change", (e) => { state.hasLH = e.target.checked; state.page = 1; apply(); });
    $("#f-full").addEventListener("change", (e) => { state.full = e.target.checked; state.page = 1; apply(); });
    $("#reset").addEventListener("click", resetFilters);
    $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      clearPresets();
      const [a, z] = on ? PRESETS[b.dataset.preset] : [null, null];
      b.setAttribute("aria-pressed", on);
      setTemp(a, z);
    }));
    // chart toggles
    const seg = (attr, key) => $$(`[data-${attr}]`).forEach((b) => b.addEventListener("click", () => { state[key] = b.dataset[attr]; press(b, `[data-${attr}]`); drawCharts(); }));
    seg("sy", "sy"); seg("sx", "sx"); seg("hx", "hx"); seg("bm", "bm"); seg("rk", "rk");
    $("#legend").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-f]"); if (!b) return;
      const i = +b.dataset.f;
      if (e.altKey || e.metaKey) { state.hidden = new Set(FAMS.map((f) => f.i).filter((x) => x !== i)); }
      else state.hidden.has(i) ? state.hidden.delete(i) : state.hidden.add(i);
      drawCharts();
    });
    // table
    $$("th button[data-sort]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : (["name", "fam", "tm"].includes(k) ? 1 : -1) };
      state.page = 1; apply(false);
    }));
    $("#rows").addEventListener("click", (e) => {
      const c = e.target.closest(".cmp"); if (c) { toggleCompare(+c.dataset.id); return; }
      const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(+tr.dataset.id);
    });
    $("#rows").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("tr[data-id]")) openDetail(+e.target.dataset.id); });
    $("#pager").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-p]"); if (!b || b.disabled) return;
      state.page = +b.dataset.p; renderTable(); $("#database").scrollIntoView({ behavior: "smooth" });
    });
    $("#export").addEventListener("click", exportCSV);
    // drawer / compare
    $("#d-close").addEventListener("click", closeDetail);
    $("#scrim").addEventListener("click", closeDetail);
    window.addEventListener("hashchange", openFromHash);
    $("#open-compare").addEventListener("click", openCompare);
    $("#clear-compare").addEventListener("click", () => { state.compare = []; saveCompare(); });
    $("#tray-items").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) toggleCompare(+b.dataset.rm); });
    $("#compare-dialog").addEventListener("click", (e) => { if (e.target.matches("[data-close]") || e.target.id === "compare-dialog") $("#compare-dialog").close(); });
    // header
    const mb = $(".menu-btn");
    mb.addEventListener("click", () => { const o = $("#nav").classList.toggle("open"); mb.setAttribute("aria-expanded", o); });
    $$("#nav a").forEach((a) => a.addEventListener("click", () => $("#nav").classList.remove("open")));
    const th = $("#theme");
    const syncTheme = () => { const d = document.documentElement.dataset.theme === "dark"; th.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode"); th.innerHTML = d ? SUN : MOON; };
    syncTheme();
    th.addEventListener("click", () => {
      const d = document.documentElement.dataset.theme === "dark";
      document.documentElement.dataset.theme = d ? "light" : "dark";
      store.set("pcm-theme", d ? "light" : "dark");
      readColors(); syncTheme(); drawHero(); drawCharts(); renderTable();
    });
    // chart interaction (delegated)
    setupTips();
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawCharts, 150); });
    renderTray();
  }
  const MOON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const SUN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const closePop = (p) => { p.classList.remove("open"); p.querySelector(".ctl").setAttribute("aria-expanded", "false"); };
  const press = (btn, sel) => $$(sel).forEach((b) => b.setAttribute("aria-pressed", b === btn));
  const clearPresets = () => $$("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  function setTemp(a, z) { state.tmin = a; state.tmax = z; $("#tmin").value = a ?? ""; $("#tmax").value = z ?? ""; state.page = 1; apply(); }
  function setFams(arr) { state.fams = new Set(arr); $$("#f-fam input").forEach((i) => (i.checked = state.fams.has(+i.value))); }

  function resetFilters() {
    Object.assign(state, { q: "", nature: "", tmin: null, tmax: null, lhmin: null, maker: "", hasLH: false, full: false, page: 1 });
    setFams([]); state.hidden.clear();
    ["#q", "#hq", "#tmin", "#tmax", "#lhmin"].forEach((s) => ($(s).value = "")); $("#maker").value = "";
    $("#f-lh").checked = false; $("#f-full").checked = false;
    press($('[data-nature=""]'), "[data-nature]"); clearPresets();
    apply();
  }

  // ---------- filtering ----------
  function apply(redraw = true) {
    const terms = state.q.toLowerCase().normalize("NFKC").replace(/[·•]/g, ".").split(/\s+/).filter(Boolean);
    VIEW = DATA.filter((m) =>
      (!state.fams.size || state.fams.has(m.fam)) &&
      (!state.nature || m.nature === state.nature) &&
      (state.tmin == null || m.tm >= state.tmin) && (state.tmax == null || m.tm <= state.tmax) &&
      (state.lhmin == null || (m.lh != null && m.lh >= state.lhmin)) &&
      (!state.maker || m.manufacturer === state.maker) &&
      (!state.hasLH || m.lh != null) &&
      (!state.full || (m.rho != null && m.cp != null && m.k != null)) &&
      terms.every((t) => m._s.includes(t)));
    const { key, dir } = state.sort;
    VIEW.sort((a, b) => {
      const x = a[key], y = b[key];
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
    });
    const nc = state.fams.size; $("#cls-n").hidden = !nc; $("#cls-n").textContent = nc;
    const nm = [state.lhmin != null, !!state.maker, state.hasLH, state.full].filter(Boolean).length; $("#more-n").hidden = !nm; $("#more-n").textContent = nm;
    renderTable();
    if (redraw) { renderKPIs(); drawCharts(); }
  }

  function renderKPIs() {
    const lh = VIEW.filter((m) => m.lh != null), vol = VIEW.filter((m) => m.vol != null);
    const bestL = lh.reduce((a, b) => (!a || b.lh > a.lh ? b : a), null);
    const bestV = vol.reduce((a, b) => (!a || b.vol > a.vol ? b : a), null);
    $("#kpis").innerHTML = [
      ["Materials shown", VIEW.length.toLocaleString("en"), `of ${DATA.length.toLocaleString("en")}`, `${VIEW.filter((m) => m.nature === "Commercial").length} commercial`],
      ["Median melting point", fmt(median(VIEW.map((m) => m.tm)), 0) ?? "—", "°C", VIEW.length ? `range ${fmt(Math.min(...VIEW.map((m) => m.tm)), 0)} to ${fmt(Math.max(...VIEW.map((m) => m.tm)), 0)} °C` : ""],
      ["Median latent heat", fmt(median(lh.map((m) => m.lh)), 0) ?? "—", "kJ/kg", `${lh.length} with data`],
      ["Highest latent heat", bestL ? fmt(bestL.lh, 0) : "—", "kJ/kg", bestL ? bestL.name : ""],
      ["Highest volumetric", bestV ? fmt(bestV.vol, 0) : "—", "MJ/m³", bestV ? bestV.name : ""],
    ].map(([l, v, u, s]) => `<div class="card kpi"><span>${l}</span><b>${esc(v)}<small>${esc(u)}</small></b><em title="${esc(s)}">${esc(s)}</em></div>`).join("");
  }

  // ---------- table ----------
  function renderTable() {
    const pages = Math.max(1, Math.ceil(VIEW.length / PAGE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE, slice = VIEW.slice(start, start + PAGE);
    $("#count").innerHTML = `${VIEW.length.toLocaleString("en")} <span>of ${DATA.length.toLocaleString("en")} materials</span>`;
    $$("th[aria-sort]").forEach((th) => th.removeAttribute("aria-sort"));
    const sb = $(`th button[data-sort="${state.sort.key}"]`);
    $$("th button[data-sort]").forEach((b) => (b.querySelector(".arrow").textContent = "↕"));
    if (sb) { sb.parentElement.setAttribute("aria-sort", state.sort.dir > 0 ? "ascending" : "descending"); sb.querySelector(".arrow").textContent = state.sort.dir > 0 ? "↑" : "↓"; }
    if (!slice.length) {
      $("#rows").innerHTML = `<tr><td colspan="9" class="empty">No materials match these filters. <button class="btn" onclick="document.getElementById('reset').click()">Reset filters</button></td></tr>`;
    } else {
      $("#rows").innerHTML = slice.map((m) => {
        const subline = m.manufacturer || m.formula || m.composition || "";
        const inC = state.compare.includes(m.id);
        const w = m.lh ? Math.min(100, (m.lh / 400) * 100) : 0;
        return `<tr data-id="${m.id}" tabindex="0">
          <td><span class="nm">${esc(m.name)}</span>${m.nature === "Commercial" ? '<span class="badge com">Product</span>' : ""}${m.added ? '<span class="badge">New</span>' : ""}${subline ? `<span class="sub">${esc(subline)}</span>` : ""}</td>
          <td><span class="tag"><i style="background:${COL[m.fam]}"></i>${esc(m.f.name)}</span></td>
          <td class="num">${cell(m.tm, 1)}</td>
          <td class="num">${cell(m.lh, 0)}${m.lh ? `<span class="lhbar" aria-hidden="true"><i style="width:${w}%;background:${COL[m.fam]}"></i></span>` : ""}</td>
          <td class="num">${cell(m.vol, 0)}</td>
          <td class="num">${cell(m.rho, 0)}</td>
          <td class="num">${cell(m.cp, 2)}</td>
          <td class="num">${cell(m.k, 2)}</td>
          <td><button class="cmp" data-id="${m.id}" aria-pressed="${inC}" aria-label="${inC ? "Remove" : "Add"} ${esc(m.name)} ${inC ? "from" : "to"} comparison">${inC ? "✓" : "+"}</button></td>
        </tr>`;
      }).join("");
    }
    if (pages <= 1) { $("#pager").innerHTML = ""; return; }
    const p = state.page, nums = [...new Set([1, pages, p - 1, p, p + 1].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
    let html = "", last = 0;
    nums.forEach((n) => { if (n - last > 1) html += `<span class="note">…</span>`; html += `<button data-p="${n}" ${n === p ? 'aria-current="page"' : ""}>${n}</button>`; last = n; });
    $("#pager").innerHTML = `<span class="note">Showing ${start + 1}–${Math.min(start + PAGE, VIEW.length)}</span>
      <div class="pages"><button data-p="${p - 1}" ${p === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>${html}<button data-p="${p + 1}" ${p === pages ? "disabled" : ""} aria-label="Next page">›</button></div>`;
  }

  // =====================================================================
  //  Chart engine (SVG)
  // =====================================================================
  const lin = (d0, d1, r0, r1) => { const f = (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0); f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0); return f; };
  const logS = (d0, d1, r0, r1) => { const a = Math.log10(d0), b = Math.log10(d1); return (v) => r0 + ((Math.log10(v) - a) / (b - a || 1)) * (r1 - r0); };
  function ticks(a, b, n) {
    const span = b - a; if (span <= 0) return [a];
    const s0 = span / n, p = 10 ** Math.floor(Math.log10(s0)), e = s0 / p;
    const step = (e >= 5 ? 10 : e >= 2 ? 5 : e >= 1 ? 2 : 1) * p, out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  const SL = (t) => Math.sign(t) * Math.log10(1 + Math.abs(t) / 10);
  const symlog = (d0, d1, r0, r1) => { const a = SL(d0), b = SL(d1); return (v) => r0 + ((SL(v) - a) / (b - a || 1)) * (r1 - r0); };
  const SYM_TICKS = [-50, -20, 0, 20, 50, 100, 200, 500, 1000, 2000];
  const logTicks = (a, b) => { const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) [1, 2, 5].forEach((m) => { const v = m * 10 ** e; if (v >= a && v <= b) out.push(v); }); return out; };
  const tk = (v) => (Math.abs(v) >= 1000 ? (v / 1000) + "k" : Math.abs(v) < 1 && v !== 0 ? String(+v.toPrecision(2)) : String(v));
  const niceMax = (v) => { const p = 10 ** Math.floor(Math.log10(v || 1)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const size = (el) => ({ W: el.clientWidth, H: el.clientHeight });
  const svgOpen = (W, H, label) => `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">`;

  function axes({ W, H, M, X, Y, xt, yt, xl, yl, xf = tk, yf = tk }) {
    let s = '<g class="grid">';
    yt.forEach((v) => (s += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}"/>`));
    s += '</g><g class="axis">';
    yt.forEach((v) => (s += `<text x="${M.l - 10}" y="${Y(v) + 4}" text-anchor="end">${yf(v)}</text>`));
    xt.forEach((v) => (s += `<text x="${X(v)}" y="${H - M.b + 18}" text-anchor="middle">${xf(v)}</text>`));
    s += `</g><line class="base" x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}"/>`;
    if (xl) s += `<text class="axis-title" x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">${xl}</text>`;
    if (yl) s += `<text class="axis-title" transform="translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle">${yl}</text>`;
    return s;
  }
  const empty = (el, msg = "No data for these filters") => { el.innerHTML = `<div class="empty" style="height:100%;display:grid;place-items:center">${msg}</div>`; };

  // registry of hit-test points per chart for nearest-point hover
  const HIT = {};

  function drawCharts() {
    if (!DATA.length) return;
    renderLegend();
    drawScatter(); drawAshby(); drawHist(); drawBox(); drawHeat(); drawRank();
  }

  function renderLegend() {
    const present = new Set(VIEW.map((m) => m.fam));
    $("#legend").innerHTML = FAMS.filter((f) => present.has(f.i)).map((f) =>
      `<button data-f="${f.i}" aria-pressed="${!state.hidden.has(f.i)}" title="Click to show/hide · Alt-click to show only this"><i style="background:${COL[f.i]}"></i>${esc(f.name)} <span class="note">${VIEW.filter((m) => m.fam === f.i).length}</span></button>`).join("");
  }
  const visible = (arr) => arr.filter((m) => !state.hidden.has(m.fam));

  // ---- 1. property map ----
  function drawScatter() {
    const el = $("#c-scatter"), { W, H } = size(el), yk = state.sy;
    let pts = visible(VIEW).filter((m) => m[yk] != null);
    let x0, x1, sym = false;
    if (state.sx === "low") { x0 = -60; x1 = 150; } else if (state.sx === "mid") { x0 = 100; x1 = 700; }
    else if (state.sx === "all") { x0 = -80; x1 = 2000; sym = true; }
    else if (pts.length) {
      const xs = pts.map((m) => m.tm).sort((a, b) => a - b);
      x0 = xs[0]; x1 = xs[xs.length - 1];
      if (x1 - x0 > 400) { sym = true; x0 = Math.min(x0, -5) - 8; x1 = x1 * 1.08; }
      else { const pad = Math.max(2, (x1 - x0) * 0.03); x0 -= pad; x1 += pad; }
    } else { x0 = 0; x1 = 100; }
    pts = pts.filter((m) => m.tm >= x0 && m.tm <= x1);
    if (!pts.length) { HIT.scatter = []; return empty(el); }
    const ys = pts.map((m) => m[yk]).sort((a, b) => a - b);
    const y1 = niceMax(quant(ys, 0.995) * 1.08);
    const M = { l: 60, r: 18, t: 18, b: 44 };
    const X = sym ? symlog(x0, x1, M.l, W - M.r) : lin(x0, x1, M.l, W - M.r), Y = lin(0, y1, H - M.b, M.t);
    let s = svgOpen(W, H, "Scatter plot of latent heat versus phase change temperature");
    // zones
    s += '<g class="zone">';
    ZONES.forEach(([a, b, name]) => {
      const xa = Math.max(X(a), M.l), xb = Math.min(X(b), W - M.r);
      if (xb - xa > 18) s += `<rect class="band" x="${xa}" y="${M.t}" width="${xb - xa}" height="${H - M.b - M.t}" rx="6"/>${xb - xa > 56 ? `<text x="${(xa + xb) / 2}" y="${M.t + 14}" text-anchor="middle">${name}</text>` : ""}`;
    });
    s += "</g>";
    s += axes({ W, H, M, X, Y, xt: sym ? SYM_TICKS.filter((v) => v >= x0 && v <= x1) : ticks(x0, x1, Math.max(4, Math.floor(W / 95))), yt: ticks(0, y1, 6), xl: sym ? "Phase change temperature (°C, compressed scale above 100 °C)" : "Phase change temperature (°C)", yl: yk === "vol" ? "Volumetric latent heat (MJ/m³)" : "Latent heat (kJ/kg)" });
    const r = pts.length > 700 ? 3.6 : pts.length > 200 ? 4.4 : 5.5;
    HIT.scatter = [];
    s += '<g>';
    pts.forEach((m) => {
      const cx = X(m.tm), cy = Y(Math.min(m[yk], y1));
      HIT.scatter.push({ x: cx, y: cy, m });
      s += `<circle class="dot${state.compare.includes(m.id) ? " hl" : ""}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${COL[m.fam]}" fill-opacity=".82" data-id="${m.id}"/>`;
    });
    s += "</g>";
    // direct labels for top 3 by y (selective)
    [...pts].sort((a, b) => b[yk] - a[yk]).slice(0, 3).forEach((m) => {
      const cx = X(m.tm), cy = Y(Math.min(m[yk], y1)), right = cx < W - 160;
      s += `<text class="lbl" x="${cx + (right ? 9 : -9)}" y="${cy + 4}" text-anchor="${right ? "start" : "end"}">${esc(m.name.length > 26 ? m.name.slice(0, 25) + "…" : m.name)}</text>`;
    });
    s += `<rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent" data-hit="scatter"/>`;
    el.innerHTML = s + "</svg>";
  }

  // ---- 2. Ashby: k vs volumetric (log-log) ----
  function drawAshby() {
    const el = $("#c-ashby"), { W, H } = size(el);
    const pts = visible(VIEW).filter((m) => m.vol > 0 && m.k > 0);
    $("#ashby-foot").textContent = `${pts.length} of ${VIEW.length} materials have both density and conductivity data.`;
    if (pts.length < 2) { HIT.ashby = []; return empty(el, "Not enough materials with both k and density"); }
    const xs = pts.map((m) => m.vol), ys = pts.map((m) => m.k);
    const x0 = 10 ** Math.floor(Math.log10(Math.min(...xs))), x1 = 10 ** Math.ceil(Math.log10(Math.max(...xs)));
    const y0 = 10 ** Math.floor(Math.log10(Math.min(...ys))), y1 = 10 ** Math.ceil(Math.log10(Math.max(...ys)));
    const M = { l: 58, r: 18, t: 14, b: 44 };
    const X = logS(x0, x1, M.l, W - M.r), Y = logS(y0, y1, H - M.b, M.t);
    let s = svgOpen(W, H, "Log-log scatter of thermal conductivity versus volumetric latent heat");
    const xt = logTicks(x0, x1).filter((v, i, a) => a.length < 9 || /^[15]/.test(String(v))), yt = logTicks(y0, y1).filter((v, i, a) => a.length < 9 || /^[1]/.test(String(v)));
    s += axes({ W, H, M, X, Y, xt, yt, xl: "Volumetric latent heat (MJ/m³, log)", yl: "Thermal conductivity (W/m·K, log)" });
    // "better" corner hint
    s += `<text class="zone" x="${W - M.r - 6}" y="${M.t + 12}" text-anchor="end" style="fill:var(--faint);font:600 10px var(--font-body);letter-spacing:.12em">BETTER ↗</text>`;
    HIT.ashby = [];
    pts.forEach((m) => {
      const cx = X(m.vol), cy = Y(m.k); HIT.ashby.push({ x: cx, y: cy, m });
      s += `<circle class="dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${COL[m.fam]}" fill-opacity=".82" data-id="${m.id}"/>`;
    });
    s += `<rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent" data-hit="ashby"/>`;
    el.innerHTML = s + "</svg>";
  }

  // ---- 3. stacked histogram ----
  function drawHist() {
    const el = $("#c-hist"), { W, H } = size(el);
    let pts = visible(VIEW);
    let x0, x1;
    if (state.hx === "low") { x0 = -60; x1 = 150; pts = pts.filter((m) => m.tm >= x0 && m.tm < x1); }
    else if (state.hx === "high") { x0 = 100; x1 = 1000; pts = pts.filter((m) => m.tm >= x0 && m.tm < x1); }
    else if (pts.length) { x0 = Math.min(...pts.map((m) => m.tm)); x1 = Math.max(...pts.map((m) => m.tm)); }
    if (!pts.length) return empty(el);
    const nb = Math.max(8, Math.min(28, Math.floor(W / 22)));
    const raw = (x1 - x0) / nb || 1, p = 10 ** Math.floor(Math.log10(raw)), e = raw / p;
    const step = (e > 5 ? 10 : e > 2.5 ? 5 : e > 2 ? 2.5 : e > 1 ? 2 : 1) * p;
    const b0 = Math.floor(x0 / step) * step, n = Math.max(1, Math.ceil((x1 - b0 + 1e-9) / step));
    const bins = Array.from({ length: n }, (_, i) => ({ a: b0 + i * step, b: b0 + (i + 1) * step, c: new Array(8).fill(0), t: 0 }));
    pts.forEach((m) => { const i = Math.min(n - 1, Math.floor((m.tm - b0) / step)); bins[i].c[m.fam]++; bins[i].t++; });
    const ymax = niceMax(Math.max(...bins.map((b) => b.t)) * 1.05);
    const M = { l: 44, r: 12, t: 14, b: 44 };
    const X = lin(b0, b0 + n * step, M.l, W - M.r), Y = lin(0, ymax, H - M.b, M.t);
    let s = svgOpen(W, H, "Stacked histogram of phase change temperatures by family");
    s += axes({ W, H, M, X, Y, xt: ticks(b0, b0 + n * step, Math.max(3, Math.floor(W / 80))), yt: ticks(0, ymax, 5), xl: "Phase change temperature (°C)", yl: "Materials" });
    const bw = Math.max(2, X(b0 + step) - X(b0) - 2);
    bins.forEach((b, bi) => {
      let y = H - M.b; const segs = FAMS.map((f) => f.i).filter((i) => b.c[i]);
      segs.forEach((i, si) => {
        const h = Y(0) - Y(b.c[i]); const top = si === segs.length - 1;
        const yy = y - h;
        const tip = `${b.a}–${b.b} °C|${FAMS[i].name}: ${b.c[i]}|Total in band: ${b.t}`;
        s += top ? `<path class="bar" d="${roundTop(X(b.a) + 1, yy, bw, Math.max(h - (si ? 1 : 0), 0.5), Math.min(4, bw / 2))}" fill="${COL[i]}" data-tip="${esc(tip)}" data-hc="${i}"/>`
          : `<rect class="bar" x="${X(b.a) + 1}" y="${yy + 1}" width="${bw}" height="${Math.max(h - 1, 0.5)}" fill="${COL[i]}" data-tip="${esc(tip)}" data-hc="${i}"/>`;
        y = yy;
      });
    });
    el.innerHTML = s + "</svg>";
  }
  const roundTop = (x, y, w, h, r) => { r = Math.min(r, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
  const roundRight = (x, y, w, h, r) => { r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };

  // ---- 4. box + strip ----
  function drawBox() {
    const el = $("#c-box"), { W, H } = size(el), key = state.bm;
    const groups = FAMS.map((f) => ({ f, v: visible(VIEW).filter((m) => m.fam === f.i && m[key] != null) })).filter((g) => g.v.length >= 3);
    if (!groups.length) return empty(el, "Need at least 3 materials with data in a family");
    const all = groups.flatMap((g) => g.v.map((m) => m[key])).sort((a, b) => a - b);
    const xmax = niceMax(quant(all, 0.99) * 1.1);
    const M = { l: 138, r: 22, t: 8, b: 44 };
    const X = lin(0, xmax, M.l, W - M.r);
    const rowH = (H - M.t - M.b) / groups.length;
    let s = svgOpen(W, H, "Box plots of latent heat by material family");
    s += '<g class="grid">'; ticks(0, xmax, 6).forEach((v) => (s += `<line x1="${X(v)}" x2="${X(v)}" y1="${M.t}" y2="${H - M.b}"/>`)); s += "</g>";
    s += '<g class="axis">'; ticks(0, xmax, 6).forEach((v) => (s += `<text x="${X(v)}" y="${H - M.b + 18}" text-anchor="middle">${tk(v)}</text>`)); s += "</g>";
    s += `<text class="axis-title" x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">${key === "vol" ? "Volumetric latent heat (MJ/m³)" : "Latent heat (kJ/kg)"}</text>`;
    HIT.box = [];
    groups.forEach((g, gi) => {
      const v = g.v.map((m) => m[key]).sort((a, b) => a - b);
      const q1 = quant(v, 0.25), q2 = quant(v, 0.5), q3 = quant(v, 0.75), iqr = q3 - q1;
      const lo = v.find((x) => x >= q1 - 1.5 * iqr), hi = [...v].reverse().find((x) => x <= q3 + 1.5 * iqr);
      const cy = M.t + rowH * gi + rowH / 2, bh = Math.min(22, rowH * 0.5), c = COL[g.f.i];
      s += `<text class="lbl" x="${M.l - 12}" y="${cy + 4}" text-anchor="end">${esc(g.f.name)}</text>`;
      // strip (deterministic jitter)
      g.v.forEach((m, i) => {
        const jit = (((m.id * 9301 + 49297) % 233280) / 233280 - 0.5) * rowH * 0.62;
        const cx = X(Math.min(m[key], xmax)); HIT.box.push({ x: cx, y: cy + jit, m });
        s += `<circle cx="${cx.toFixed(1)}" cy="${(cy + jit).toFixed(1)}" r="2.4" fill="${c}" fill-opacity=".28"/>`;
      });
      const tip = `${g.f.long || g.f.name}|n = ${v.length}|Median: ${fmt(q2, 0)}|Middle 50%: ${fmt(q1, 0)}–${fmt(q3, 0)}|Range: ${fmt(v[0], 0)}–${fmt(v[v.length - 1], 0)}`;
      s += `<line x1="${X(lo)}" x2="${X(Math.min(hi, xmax))}" y1="${cy}" y2="${cy}" stroke="${c}" stroke-width="2"/>`;
      s += `<line x1="${X(lo)}" x2="${X(lo)}" y1="${cy - 5}" y2="${cy + 5}" stroke="${c}" stroke-width="2"/><line x1="${X(Math.min(hi, xmax))}" x2="${X(Math.min(hi, xmax))}" y1="${cy - 5}" y2="${cy + 5}" stroke="${c}" stroke-width="2"/>`;
      s += `<rect class="bar" x="${X(q1)}" y="${cy - bh / 2}" width="${Math.max(2, X(Math.min(q3, xmax)) - X(q1))}" height="${bh}" rx="5" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="2" data-tip="${esc(tip)}"/>`;
      s += `<line x1="${X(q2)}" x2="${X(q2)}" y1="${cy - bh / 2}" y2="${cy + bh / 2}" stroke="var(--ink)" stroke-width="2.5"/>`;
      s += `<text class="val" x="${X(Math.min(hi, xmax)) + 8}" y="${cy + 4}">${fmt(q2, 0)}</text>`;
    });
    s += `<rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent" data-hit="box" style="pointer-events:none"/>`;
    el.innerHTML = s + "</svg>";
  }

  // ---- 5. heatmap ----
  function drawHeat() {
    const el = $("#c-heat"), { W, H } = size(el);
    const pts = visible(VIEW);
    const rows = FAMS.filter((f) => pts.some((m) => m.fam === f.i));
    if (!rows.length) return empty(el);
    const grid = rows.map((f) => BANDS.map(([a, b]) => pts.filter((m) => m.fam === f.i && m.tm >= a && m.tm < b).length));
    const max = Math.max(1, ...grid.flat());
    const M = { l: 130, r: 8, t: 8, b: 70 };
    const cw = (W - M.l - M.r) / BANDS.length, ch = Math.min(40, (H - M.t - M.b) / rows.length);
    const top = M.t + ((H - M.t - M.b) - ch * rows.length) / 2;
    let s = svgOpen(W, H, "Heatmap of material counts by family and temperature band");
    rows.forEach((f, ri) => {
      const y = top + ri * ch;
      s += `<text class="lbl" x="${M.l - 10}" y="${y + ch / 2 + 4}" text-anchor="end">${esc(f.name)}</text>`;
      grid[ri].forEach((n, ci) => {
        const step = n ? 1 + Math.min(6, Math.floor(Math.sqrt(n / max) * 6.999)) : 0;
        const x = M.l + ci * cw;
        const tip = `${f.name}|${BANDS[ci][2]} °C|${n} material${n === 1 ? "" : "s"}`;
        s += `<rect class="cell" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6" fill="${SEQ[step]}" data-tip="${esc(tip)}" data-heat="${f.i},${ci}"/>`;
        if (n && cw > 24) s += `<text x="${x + cw / 2}" y="${y + ch / 2 + 4}" text-anchor="middle" style="pointer-events:none;font:500 11px var(--font-mono);fill:${step >= 5 ? (document.documentElement.dataset.theme === "dark" ? "#0b1220" : "#fff") : "var(--ink-2)"}">${n}</text>`;
      });
    });
    s += '<g class="axis">';
    const rot = cw < 58;
    BANDS.forEach((b, ci) => { const x = M.l + ci * cw + cw / 2, y = top + rows.length * ch + 16; s += rot ? `<text transform="translate(${x + 4} ${y}) rotate(-35)" text-anchor="end">${b[2]}</text>` : `<text x="${x}" y="${y}" text-anchor="middle">${b[2]}</text>`; });
    s += `</g><text class="axis-title" x="${M.l + (W - M.l - M.r) / 2}" y="${top + rows.length * ch + (rot ? 58 : 40)}" text-anchor="middle">Temperature band (°C)</text>`;
    el.innerHTML = s + "</svg>";
  }

  // ---- 6. ranking ----
  const RK = { lh: ["Latent heat", "kJ/kg", 0], vol: ["Volumetric latent heat", "MJ/m³", 0], k: ["Thermal conductivity", "W/m·K", 2], cp: ["Specific heat", "kJ/kg·K", 2] };
  function drawRank() {
    const el = $("#c-rank"), { W, H } = size(el), key = state.rk;
    const top = visible(VIEW).filter((m) => m[key] != null).sort((a, b) => b[key] - a[key]).slice(0, 12);
    if (!top.length) return empty(el);
    const max = niceMax(top[0][key]);
    const M = { l: Math.min(260, W * 0.36), r: 70, t: 4, b: 44 };
    const X = lin(0, max, M.l, W - M.r), rh = (H - M.t - M.b) / top.length, bh = Math.min(20, rh - 8);
    let s = svgOpen(W, H, `Top materials by ${RK[key][0]}`);
    s += '<g class="grid">'; ticks(0, max, 5).forEach((v) => (s += `<line x1="${X(v)}" x2="${X(v)}" y1="${M.t}" y2="${H - M.b}"/>`)); s += "</g>";
    s += '<g class="axis">'; ticks(0, max, 5).forEach((v) => (s += `<text x="${X(v)}" y="${H - M.b + 18}" text-anchor="middle">${tk(v)}</text>`)); s += "</g>";
    top.forEach((m, i) => {
      const y = M.t + i * rh + (rh - bh) / 2, w = Math.max(2, X(m[key]) - X(0));
      const name = m.name.length > 34 ? m.name.slice(0, 33) + "…" : m.name;
      const tip = `${m.name}|${m.f.name}${m.manufacturer ? " · " + m.manufacturer : ""}|${RK[key][0]}: ${fmt(m[key], RK[key][2])} ${RK[key][1]}|T: ${fmt(m.tm)} °C`;
      s += `<text class="lbl" x="${M.l - 12}" y="${y + bh / 2 + 4}" text-anchor="end"><tspan class="val" style="fill:var(--faint)">${i + 1}  </tspan>${esc(name)}</text>`;
      s += `<path class="bar" d="${roundRight(X(0), y, w, bh, 4)}" fill="${COL[m.fam]}" data-id="${m.id}" data-tip="${esc(tip)}"/>`;
      s += `<text class="val" x="${X(0) + w + 8}" y="${y + bh / 2 + 4}">${fmt(m[key], RK[key][2])}</text>`;
    });
    s += `<line class="base" x1="${X(0)}" x2="${X(0)}" y1="${M.t}" y2="${H - M.b}"/>`;
    s += `<text class="axis-title" x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">${RK[key][0]} (${RK[key][1]})</text>`;
    el.innerHTML = s + "</svg>";
  }

  // ---- hero mini chart (decorative) ----
  function drawHero() {
    const svg = $("#hero-svg"); if (!svg || !DATA.length) return;
    const pts = DATA.filter((m) => m.lh != null && m.tm >= -60 && m.tm <= 150 && m.lh < 420);
    $("#hero-n").textContent = `${pts.length} materials`;
    const W = 520, H = 330, M = { l: 34, r: 8, t: 8, b: 26 };
    const X = lin(-60, 150, M.l, W - M.r), Y = lin(0, 420, H - M.b, M.t);
    let s = "";
    [0, 100, 200, 300, 400].forEach((v) => (s += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${M.l - 6}" y="${Y(v) + 3}" fill="#6f7f99" font-size="10" text-anchor="end" font-family="JetBrains Mono, monospace">${v}</text>`));
    [-50, 0, 50, 100, 150].forEach((v) => (s += `<text x="${X(v)}" y="${H - 8}" fill="#6f7f99" font-size="10" text-anchor="middle" font-family="JetBrains Mono, monospace">${v}°</text>`));
    const darkCols = ["#338ced", "#e76624", "#00a888", "#d28e05", "#e24d8b", "#0aac23", "#9887ef", "#6b7280"];
    pts.forEach((m) => (s += `<circle cx="${X(m.tm).toFixed(1)}" cy="${Y(m.lh).toFixed(1)}" r="3.2" fill="${darkCols[m.fam]}" fill-opacity=".85"/>`));
    svg.innerHTML = s;
  }

  // ---------- tooltips & chart clicks ----------
  function setupTips() {
    const tip = $("#tip");
    const show = (html, x, y) => { tip.innerHTML = html; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.style.opacity = 1; };
    const hide = () => (tip.style.opacity = 0);
    const ptTip = (m) => {
      const r = (k, v, u) => (v == null ? "" : `<div class="r"><span>${k}</span><span>${v} ${u}</span></div>`);
      return `<div class="k"><i style="background:${COL[m.fam]}"></i>${esc(m.f.name)}</div><b>${esc(m.name)}</b>${r("T", fmt(m.tm), "°C")}${r("ΔH", fmt(m.lh, 0), "kJ/kg")}${r("Vol.", fmt(m.vol, 0), "MJ/m³")}${r("k", fmt(m.k, 2), "W/m·K")}`;
    };
    const nearest = (key, e, svgEl) => {
      const rect = svgEl.getBoundingClientRect(), sx = svgEl.viewBox.baseVal.width / rect.width;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sx;
      let best = null, bd = 196;
      (HIT[key] || []).forEach((p) => { const d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < bd) { bd = d; best = p; } });
      return best;
    };
    let hl = null;
    const setHL = (svgEl, id) => { if (hl) hl.classList.remove("hl"); hl = id ? svgEl.querySelector(`circle[data-id="${id}"]`) : null; if (hl) hl.classList.add("hl"); };
    $("#explore").addEventListener("mousemove", (e) => {
      const svgEl = e.target.closest("svg");
      if (!svgEl) { hide(); return; }
      const t = e.target.closest("[data-tip]");
      if (t) { const parts = t.dataset.tip.split("|"); show(`<b>${esc(parts[0])}</b>${parts.slice(1).map((p) => `<div class="r"><span>${esc(p)}</span></div>`).join("")}`, e.clientX, e.clientY); return; }
      const key = e.target.closest("#c-scatter") ? "scatter" : e.target.closest("#c-ashby") ? "ashby" : e.target.closest("#c-box") ? "box" : null;
      if (key) { const p = nearest(key, e, svgEl); if (p) { setHL(svgEl, p.m.id); svgEl.style.cursor = "pointer"; show(ptTip(p.m), e.clientX, e.clientY); return; } }
      svgEl.style.cursor = ""; setHL(svgEl, null); hide();
    });
    $("#explore").addEventListener("mouseleave", hide);
    $("#explore").addEventListener("click", (e) => {
      const svgEl = e.target.closest("svg"); if (!svgEl) return;
      const idEl = e.target.closest("[data-id]"); if (idEl && idEl.tagName !== "circle") { openDetail(+idEl.dataset.id); return; }
      const h = e.target.closest("[data-heat]");
      if (h) { const [fi, ci] = h.dataset.heat.split(",").map(Number); setFams([fi]); const [a, b] = BANDS[ci]; clearPresets(); setTemp(Number.isFinite(a) ? a : null, Number.isFinite(b) ? b : null); hide(); return; }
      const hc = e.target.closest("[data-hc]");
      if (hc) { state.hidden = new Set(FAMS.map((f) => f.i).filter((x) => x !== +hc.dataset.hc)); drawCharts(); hide(); return; }
      const key = e.target.closest("#c-scatter") ? "scatter" : e.target.closest("#c-ashby") ? "ashby" : e.target.closest("#c-box") ? "box" : null;
      if (key) { const p = nearest(key, e, svgEl); if (p) { hide(); openDetail(p.m.id); } }
    });
  }

  // ---------- detail drawer ----------
  let lastFocus = null;
  function pctRank(m, key) {
    const vals = DATA.filter((x) => x.fam === m.fam && x[key] != null).map((x) => x[key]);
    if (m[key] == null || vals.length < 3) return null;
    return Math.round((vals.filter((v) => v <= m[key]).length / vals.length) * 100);
  }
  function openDetail(id) {
    const m = BYID.get(id); if (!m) return;
    lastFocus = document.activeElement;
    const kv = (label, val, unit, hl, extra = "") => `<div class="${hl ? "hl" : ""}"><dt>${label}</dt><dd>${val == null ? '<span class="dash">—</span>' : esc(val)} ${val == null ? "" : `<small>${unit}</small>`}${extra}</dd></div>`;
    const pair = (s, l, d) => (s == null && l == null ? null : `${fmt(s, d) ?? "—"} / ${fmt(l, d) ?? "—"}`);
    $("#drawer").style.setProperty("--fam", COL[m.fam]);
    $("#d-head").innerHTML = `
      <span class="tag"><i style="background:${COL[m.fam]}"></i>${esc(m.f.long || m.f.name)} · ${esc(m.category)}</span>
      ${m.nature === "Commercial" ? '<span class="badge com">Commercial product</span>' : ""}${m.added ? '<span class="badge">New</span>' : ""}
      <h2 id="d-title">${esc(m.name)}</h2>
      <div class="meta-line">${[m.manufacturer && esc(m.manufacturer), m.formula && `Formula: ${esc(m.formula)}`, m.composition && `Composition: ${esc(m.composition)}`].filter(Boolean).join(" · ")}</div>`;
    const reports = (m.reports || []).filter((r) => r.tm != null);
    const ranks = [["Latent heat", "lh"], ["Volumetric storage", "vol"], ["Conductivity", "k"], ["Specific heat", "cp"]].map(([l, k]) => [l, pctRank(m, k)]).filter((r) => r[1] != null);
    $("#d-body").innerHTML = `
      <dl class="kv">
        ${kv("Phase change temperature", fmt(m.tm, 2), "°C", true, m.tm_text ? `<br><small>reported ${esc(m.tm_text)} °C</small>` : "")}
        ${kv("Latent heat", fmt(m.lh, 1), "kJ/kg", true, m.lh_text ? `<br><small>reported ${esc(m.lh_text)} kJ/kg</small>` : "")}
        ${kv("Volumetric storage", fmt(m.vol, 0), "MJ/m³")}
        ${kv("Energy density", m.lh != null ? fmt(m.lh / 3.6, 1) : null, "Wh/kg")}
        ${kv("Density (solid / liquid)", pair(m.rhos, m.rhol, 0), "kg/m³")}
        ${kv("Specific heat (solid / liquid)", pair(m.cps, m.cpl, 2), "kJ/kg·K")}
        ${kv("Conductivity (solid / liquid)", pair(m.ks, m.kl, 3), "W/m·K")}
        ${m.tpeak != null ? kv("DSC peak temperature", fmt(m.tpeak, 1), "°C") : ""}
        ${m.htot != null ? kv("Total enthalpy (incl. sensible)", fmt(m.htot, 0), "kJ/kg") : ""}
        ${m.tmax != null ? kv("Max operating temperature", fmt(m.tmax, 0), "°C") : ""}
        ${m.mu != null ? kv("Dynamic viscosity (liquid)", fmt(m.mu, 3), "mPa·s") : ""}
        ${m.cost != null ? kv("Indicative cost", fmt(m.cost, 2), "$/kg") : ""}
      </dl>
      ${ranks.length ? `<h3>How it ranks among ${esc(m.f.name.toLowerCase())}</h3><div class="pct">${ranks.map(([l, p]) => `<div class="pct-row"><span>${l}</span><div class="pct-track"><i style="width:${p}%"></i></div><b>${p}th</b></div>`).join("")}</div><p class="note">Percentile within its family. 100th means the highest value in the family.</p>` : ""}
      ${reports.length > 1 ? `<h3>Values reported by different sources</h3>
        <table class="mini"><thead><tr><th>T (°C)</th><th>ΔH (kJ/kg)</th><th>Source</th></tr></thead><tbody>
        ${reports.map((r) => `<tr><td class="mono">${cell(r.tm, 2)}</td><td class="mono">${cell(r.lh, 1)}</td><td>${esc(r.ref)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${m.synonyms || m.aliases ? `<h3>Also known as</h3><p class="meta-line">${esc([m.synonyms, ...(m.aliases || [])].filter(Boolean).join(" · "))}</p>` : ""}
      <h3>Sources</h3><ul>${(m.refs || ["—"]).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      <div class="actions">
        <button class="btn primary" id="d-cmp">${state.compare.includes(m.id) ? "✓ In comparison" : "+ Add to compare"}</button>
        <button class="btn" id="d-link">🔗 Copy link</button>
        <a class="btn" href="https://scholar.google.com/scholar?q=${encodeURIComponent(m.name + " phase change material latent heat")}" target="_blank" rel="noopener">Search literature ↗</a>
      </div>
      <p class="note" style="margin-top:18px">Record #${m.id}. Values come from the sources listed above. Check them before using them in a design.</p>`;
    $("#d-cmp").onclick = () => { toggleCompare(m.id); $("#d-cmp").textContent = state.compare.includes(m.id) ? "✓ In comparison" : "+ Add to compare"; };
    $("#d-link").onclick = () => {
      const url = location.href.split("#")[0] + "#pcm-" + m.id;
      (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => ($("#d-link").textContent = "✓ Copied"), () => prompt("Copy this link:", url));
    };
    $("#drawer").classList.add("show"); $("#scrim").classList.add("show"); $("#drawer").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    history.replaceState(null, "", "#pcm-" + m.id);
    $("#d-close").focus();
  }
  function closeDetail() {
    if (!$("#drawer").classList.contains("show")) return;
    $("#drawer").classList.remove("show"); $("#scrim").classList.remove("show"); $("#drawer").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (/^#pcm-/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
    lastFocus?.focus?.();
  }
  function openFromHash() { const m = location.hash.match(/^#pcm-(\d+)/); if (m) openDetail(+m[1]); }

  // ---------- compare ----------
  function toggleCompare(id) {
    const i = state.compare.indexOf(id);
    if (i >= 0) state.compare.splice(i, 1);
    else { if (state.compare.length >= 4) { flash("Up to 4 materials"); return; } state.compare.push(id); }
    saveCompare();
  }
  function saveCompare() { store.set("pcm-compare", state.compare); renderTray(); renderTable(); drawScatter(); }
  function flash(msg) { const t = $("#tray-label"); const o = t.textContent; t.textContent = msg; setTimeout(() => (t.textContent = o), 1800); }
  function renderTray() {
    $("#tray").classList.toggle("show", state.compare.length > 0);
    $("#tray-items").innerHTML = state.compare.map((id) => { const m = BYID.get(id); return `<span class="pill"><i style="background:${COL[m.fam]}"></i>${esc(m.name)}<button data-rm="${id}" aria-label="Remove ${esc(m.name)}">✕</button></span>`; }).join("");
    $("#open-compare").disabled = state.compare.length < 2;
  }
  function openCompare() {
    const ms = state.compare.map((id) => BYID.get(id));
    const bars = (label, unit, key, d) => {
      const vals = ms.map((m) => m[key]), mx = Math.max(...vals.filter((v) => v != null), 0) || 1;
      return `<div class="cmp-chart"><h4>${label} <small>${unit}</small></h4>${ms.map((m) => `<div class="cmp-row"><div class="top"><span>${esc(m.name)}</span><b>${fmt(m[key], d) ?? "—"}</b></div><div class="tr"><i style="width:${m[key] != null ? (m[key] / mx) * 100 : 0}%;background:${COL[m.fam]}"></i></div></div>`).join("")}</div>`;
    };
    const rows = [
      ["Family", (m) => m.f.name], ["Class", (m) => m.category], ["Source", (m) => m.manufacturer || m.nature],
      ["Phase change temperature (°C)", (m) => m.tm, 1], ["Latent heat (kJ/kg)", (m) => m.lh, 0, 1],
      ["Volumetric (MJ/m³)", (m) => m.vol, 0, 1], ["Density (kg/m³)", (m) => m.rho, 0],
      ["cp solid (kJ/kg·K)", (m) => m.cps, 2, 1], ["cp liquid (kJ/kg·K)", (m) => m.cpl, 2, 1],
      ["k solid (W/m·K)", (m) => m.ks, 3, 1], ["k liquid (W/m·K)", (m) => m.kl, 3, 1],
      ["Max operating (°C)", (m) => m.tmax, 0], ["References", (m) => (m.refs || []).join("; ")],
    ];
    $("#compare-body").innerHTML = `<div class="cmp-charts">${bars("Latent heat", "kJ/kg", "lh", 0)}${bars("Volumetric storage", "MJ/m³", "vol", 0)}${bars("Thermal conductivity", "W/m·K", "k", 2)}</div>
      <div class="table-wrap"><table class="cmp-table"><thead><tr><th></th>${ms.map((m) => `<th scope="col"><span class="tag"><i style="background:${COL[m.fam]}"></i>${esc(m.name)}</span></th>`).join("")}</tr></thead><tbody>
      ${rows.map(([label, f, d, best]) => {
        const vals = ms.map(f), nums = vals.filter((v) => typeof v === "number");
        const top = best && nums.length > 1 ? Math.max(...nums) : null;
        return `<tr><td>${label}</td>${vals.map((v) => `<td class="${top != null && v === top ? "best" : ""}">${typeof v === "number" ? fmt(v, d) : v ? esc(v) : '<span class="dash">—</span>'}</td>`).join("")}</tr>`;
      }).join("")}</tbody></table></div><p class="note">Green marks the highest value in rows where higher is usually better.</p>`;
    $("#compare-dialog").showModal();
  }

  // ---------- export ----------
  function exportCSV() {
    const cols = [["id", "ID"], ["name", "Name"], ["category", "Class"], ["famName", "Family"], ["nature", "Type"], ["manufacturer", "Manufacturer"], ["formula", "Formula"],
      ["composition", "Composition"], ["tm", "T_pc (°C)"], ["lh", "Latent heat (kJ/kg)"], ["vol", "Volumetric (MJ/m³)"], ["cps", "cp_s (kJ/kgK)"],
      ["cpl", "cp_l (kJ/kgK)"], ["rhos", "rho_s (kg/m3)"], ["rhol", "rho_l (kg/m3)"], ["ks", "k_s (W/mK)"], ["kl", "k_l (W/mK)"], ["tmax", "T_max (°C)"], ["refs", "References"]];
    const q = (v) => (v == null ? "" : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const val = (m, k) => (k === "refs" ? (m.refs || []).join("; ") : k === "famName" ? m.f.name : k === "vol" && m.vol ? +m.vol.toFixed(1) : m[k]);
    const lines = [cols.map((c) => c[1]).join(",")].concat(VIEW.map((m) => cols.map(([k]) => q(val(m, k))).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `pcm-library-${VIEW.length}-materials.csv` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
})();
