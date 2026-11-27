/* PCM Library — client app. Loads data/pcm.json and renders search, filters, chart, details and comparison. */
(() => {
  "use strict";

  const COLORS = {
    "Paraffin": "#0b5f94",
    "Fatty / organic acid": "#d9480f",
    "Fatty ester": "#e8a10c",
    "Fatty alcohol": "#a26b00",
    "Sugar alcohol": "#c2255c",
    "Polymer / PEG": "#7048e8",
    "Organic (other)": "#868e96",
    "Salt hydrate": "#1098ad",
    "Eutectic": "#4caf2f",
    "Molten / inorganic salt": "#9c36b5",
    "Inorganic (other)": "#5c7cfa",
    "Metal / alloy": "#495057",
    "Solid-solid": "#e64980",
  };
  const PRESETS = {
    cold: [-40, 8], building: [18, 30], solar: [40, 90], electronics: [35, 75], industrial: [100, 300], csp: [300, null],
  };
  const PAGE = 50;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? null : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en") : (+v.toFixed(d)).toString());
  const cell = (v, d) => (fmt(v, d) ?? '<span class="dash">—</span>');
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  let DATA = [], VIEW = [], BYID = new Map();
  const state = {
    q: "", cats: new Set(), nature: "", tmin: null, tmax: null, lhmin: null, maker: "", hasLH: false, full: false,
    sort: { key: "tm", dir: 1 }, page: 1, yMode: "lh", xMode: "auto", compare: store.get("pcm-compare", []),
  };

  // ---------- load ----------
  fetch("data/pcm.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(() => { $("#count").textContent = "Could not load the dataset. Please refresh the page."; });

  function init(json) {
    DATA = json.map((m) => {
      const rho = m.rhos ?? m.rhol ?? null;
      const o = {
        ...m, rho, cp: m.cps ?? m.cpl ?? null, k: m.ks ?? m.kl ?? null,
        vol: m.lh && rho ? (m.lh * rho) / 1000 : null,
      };
      o._s = [m.name, m.formula, m.composition, m.manufacturer, m.category, m.synonyms, ...(m.aliases || [])]
        .filter(Boolean).join(" ").toLowerCase().normalize("NFKC")
        .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 8320)).replace(/[·•]/g, ".");
      return o;
    });
    DATA.forEach((m) => BYID.set(m.id, m));
    state.compare = state.compare.filter((id) => BYID.has(id));
    buildStats();
    buildFilters();
    buildRefs();
    bindUI();
    apply();
    openFromHash();
  }

  function buildStats() {
    const tms = DATA.map((m) => m.tm);
    const refs = new Set(DATA.flatMap((m) => m.refs || []));
    $("#s-total").textContent = DATA.length.toLocaleString("en");
    $("#s-com").textContent = DATA.filter((m) => m.nature === "Commercial").length.toLocaleString("en");
    $("#s-range").textContent = `${Math.round(Math.min(...tms))} to ${Math.round(Math.max(...tms)).toLocaleString("en")} °C`;
    $("#s-refs").textContent = refs.size + "+";
  }

  function buildFilters() {
    const counts = {};
    DATA.forEach((m) => (counts[m.category] = (counts[m.category] || 0) + 1));
    const cats = Object.keys(COLORS).filter((c) => counts[c]);
    $("#f-cat").innerHTML = cats.map((c) => `
      <label class="check"><input type="checkbox" value="${esc(c)}"><i class="dot" style="background:${COLORS[c]}"></i>${esc(c)}<span class="n">${counts[c]}</span></label>`).join("");
    const makers = [...new Set(DATA.map((m) => m.manufacturer).filter(Boolean))].sort();
    $("#maker").insertAdjacentHTML("beforeend", makers.map((m) => `<option>${esc(m)}</option>`).join(""));
    $("#legend").innerHTML = cats.map((c) => `<span><i style="background:${COLORS[c]}"></i>${esc(c)}</span>`).join("");
  }

  function buildRefs() {
    const n = {};
    DATA.forEach((m) => (m.refs || []).forEach((r) => (n[r] = (n[r] || 0) + 1)));
    const generic = /^(Manufacturer datasheet|Literature compilation|PCM property database)$/;
    const list = Object.entries(n).filter(([r]) => !generic.test(r)).sort((a, b) => b[1] - a[1]);
    $("#refs").innerHTML = list.map(([r, c]) => `<li>${esc(r)} <span class="note">(${c})</span></li>`).join("") +
      `<li>Manufacturer technical datasheets <span class="note">(${n["Manufacturer datasheet"] || 0})</span></li>` +
      `<li>Open PCM property databases and literature compilations <span class="note">(${(n["PCM property database"] || 0) + (n["Literature compilation"] || 0)})</span></li>`;
  }

  // ---------- UI bindings ----------
  function bindUI() {
    let t;
    $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; apply(); }, 140); });
    $("#f-cat").addEventListener("change", (e) => {
      e.target.checked ? state.cats.add(e.target.value) : state.cats.delete(e.target.value);
      state.page = 1; apply();
    });
    $$("[data-nature]").forEach((b) => b.addEventListener("click", () => {
      state.nature = b.dataset.nature; pressOnly(b, "[data-nature]"); state.page = 1; apply();
    }));
    const numIn = (id, key) => $(id).addEventListener("input", (e) => {
      const v = e.target.value === "" ? null : +e.target.value;
      state[key] = Number.isFinite(v) ? v : null; state.page = 1; clearPresets(); apply();
    });
    numIn("#tmin", "tmin"); numIn("#tmax", "tmax"); numIn("#lhmin", "lhmin");
    $("#maker").addEventListener("change", (e) => { state.maker = e.target.value; state.page = 1; apply(); });
    $("#f-lh").addEventListener("change", (e) => { state.hasLH = e.target.checked; state.page = 1; apply(); });
    $("#f-full").addEventListener("change", (e) => { state.full = e.target.checked; state.page = 1; apply(); });
    $("#reset").addEventListener("click", resetFilters);
    $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      clearPresets();
      const [a, z] = on ? PRESETS[b.dataset.preset] : [null, null];
      b.setAttribute("aria-pressed", on);
      state.tmin = a; state.tmax = z; $("#tmin").value = a ?? ""; $("#tmax").value = z ?? "";
      state.page = 1; apply();
      $("#explore").scrollIntoView({ behavior: "smooth" });
    }));
    $$("th button[data-sort]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : (k === "name" || k === "category" || k === "tm" ? 1 : -1) };
      state.page = 1; apply(false);
    }));
    $("#rows").addEventListener("click", (e) => {
      const c = e.target.closest(".cmp");
      if (c) { toggleCompare(+c.dataset.id); return; }
      const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(+tr.dataset.id);
    });
    $("#rows").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches("tr[data-id]")) openDetail(+e.target.dataset.id);
    });
    $("#pager").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-p]"); if (!b) return;
      state.page = +b.dataset.p; renderTable(); $("#database").scrollIntoView({ behavior: "smooth" });
    });
    $("#export").addEventListener("click", exportCSV);
    $$("[data-y]").forEach((b) => b.addEventListener("click", () => { state.yMode = b.dataset.y; pressOnly(b, "[data-y]"); drawChart(); }));
    $$("[data-x]").forEach((b) => b.addEventListener("click", () => { state.xMode = b.dataset.x; pressOnly(b, "[data-x]"); drawChart(); }));
    $("#d-close").addEventListener("click", closeDetail);
    $("#scrim").addEventListener("click", closeDetail);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
    window.addEventListener("hashchange", openFromHash);
    $("#open-compare").addEventListener("click", openCompare);
    $("#clear-compare").addEventListener("click", () => { state.compare = []; saveCompare(); });
    $("#tray-items").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) toggleCompare(+b.dataset.rm); });
    $("#compare-dialog").addEventListener("click", (e) => { if (e.target.matches("[data-close]") || e.target.id === "compare-dialog") $("#compare-dialog").close(); });
    const ft = $(".filters-toggle");
    ft.addEventListener("click", () => {
      const f = $("#filters"); const col = f.dataset.collapsed !== "true";
      f.dataset.collapsed = col; ft.setAttribute("aria-expanded", !col); ft.textContent = col ? "Show filters" : "Hide filters";
    });
    const mb = $(".menu-btn");
    mb.addEventListener("click", () => { const o = $("#nav").classList.toggle("open"); mb.setAttribute("aria-expanded", o); });
    $$("#nav a").forEach((a) => a.addEventListener("click", () => $("#nav").classList.remove("open")));
    setupChartEvents();
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawChart, 120); });
    renderTray();
  }

  const pressOnly = (btn, sel) => $$(sel).forEach((b) => b.setAttribute("aria-pressed", b === btn));
  const clearPresets = () => $$("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));

  function resetFilters() {
    Object.assign(state, { q: "", nature: "", tmin: null, tmax: null, lhmin: null, maker: "", hasLH: false, full: false, page: 1 });
    state.cats.clear();
    $("#q").value = ""; $("#tmin").value = ""; $("#tmax").value = ""; $("#lhmin").value = ""; $("#maker").value = "";
    $("#f-lh").checked = false; $("#f-full").checked = false;
    $$("#f-cat input").forEach((i) => (i.checked = false));
    pressOnly($('[data-nature=""]'), "[data-nature]"); clearPresets();
    apply();
  }

  // ---------- filtering ----------
  function apply(redrawChart = true) {
    const terms = state.q.toLowerCase().normalize("NFKC").replace(/[·•]/g, ".").split(/\s+/).filter(Boolean);
    VIEW = DATA.filter((m) =>
      (!state.cats.size || state.cats.has(m.category)) &&
      (!state.nature || m.nature === state.nature) &&
      (state.tmin == null || m.tm >= state.tmin) &&
      (state.tmax == null || m.tm <= state.tmax) &&
      (state.lhmin == null || (m.lh != null && m.lh >= state.lhmin)) &&
      (!state.maker || m.manufacturer === state.maker) &&
      (!state.hasLH || m.lh != null) &&
      (!state.full || (m.rho != null && m.cp != null && m.k != null)) &&
      terms.every((t) => m._s.includes(t)));
    const { key, dir } = state.sort;
    VIEW.sort((a, b) => {
      const x = a[key], y = b[key];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
    });
    renderTable();
    if (redrawChart) drawChart();
  }

  // ---------- table ----------
  function renderTable() {
    const pages = Math.max(1, Math.ceil(VIEW.length / PAGE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE;
    const slice = VIEW.slice(start, start + PAGE);
    $("#count").innerHTML = `${VIEW.length.toLocaleString("en")} <span>of ${DATA.length.toLocaleString("en")} materials</span>`;
    $$("th[aria-sort]").forEach((th) => th.removeAttribute("aria-sort"));
    const sb = $(`th button[data-sort="${state.sort.key}"]`);
    if (sb) { sb.parentElement.setAttribute("aria-sort", state.sort.dir > 0 ? "ascending" : "descending"); sb.querySelector(".arrow").textContent = state.sort.dir > 0 ? "↑" : "↓"; }
    $$("th button[data-sort]").forEach((b) => { if (b !== sb) b.querySelector(".arrow").textContent = "↕"; });
    if (!slice.length) {
      $("#rows").innerHTML = `<tr><td colspan="8" class="empty">No materials match these filters. <button class="btn" onclick="document.getElementById('reset').click()">Reset filters</button></td></tr>`;
    } else {
      $("#rows").innerHTML = slice.map((m) => {
        const subline = m.manufacturer || m.formula || m.composition || "";
        const inC = state.compare.includes(m.id);
        return `<tr data-id="${m.id}" tabindex="0">
          <td><span class="nm">${esc(m.name)}</span>${m.nature === "Commercial" ? '<span class="badge com">Product</span>' : ""}${m.added ? '<span class="badge">New</span>' : ""}${subline ? `<span class="sub">${esc(subline)}</span>` : ""}</td>
          <td><span class="tag"><i style="background:${COLORS[m.category] || "#999"}"></i>${esc(m.category)}</span></td>
          <td class="num">${cell(m.tm, 1)}</td>
          <td class="num">${cell(m.lh, 0)}</td>
          <td class="num">${cell(m.rho, 0)}</td>
          <td class="num">${cell(m.cp, 2)}</td>
          <td class="num">${cell(m.k, 2)}</td>
          <td><button class="cmp" data-id="${m.id}" aria-pressed="${inC}" title="${inC ? "Remove from" : "Add to"} comparison" aria-label="${inC ? "Remove" : "Add"} ${esc(m.name)} ${inC ? "from" : "to"} comparison">${inC ? "✓" : "+"}</button></td>
        </tr>`;
      }).join("");
    }
    // pager
    if (pages <= 1) { $("#pager").innerHTML = ""; return; }
    const p = state.page, nums = new Set([1, pages, p - 1, p, p + 1].filter((n) => n >= 1 && n <= pages));
    let html = "", last = 0;
    [...nums].sort((a, b) => a - b).forEach((n) => {
      if (n - last > 1) html += `<span class="note">…</span>`;
      html += `<button data-p="${n}" ${n === p ? 'aria-current="page"' : ""}>${n}</button>`; last = n;
    });
    $("#pager").innerHTML = `<span class="note">Showing ${start + 1}–${Math.min(start + PAGE, VIEW.length)}</span>
      <div class="pages"><button data-p="${p - 1}" ${p === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>${html}<button data-p="${p + 1}" ${p === pages ? "disabled" : ""} aria-label="Next page">›</button></div>`;
  }

  // ---------- chart ----------
  let PTS = [];
  function drawChart() {
    const cv = $("#chart"), box = cv.parentElement;
    const W = box.clientWidth, H = box.clientHeight, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const yk = state.yMode === "vol" ? "vol" : "lh";
    let pts = VIEW.filter((m) => m[yk] != null);
    let x0, x1;
    if (state.xMode === "low") { x0 = -60; x1 = 120; } else if (state.xMode === "high") { x0 = 100; x1 = 1000; } else {
      const xs = pts.map((m) => m.tm); x0 = Math.min(...xs); x1 = Math.max(...xs);
      if (!pts.length) { x0 = 0; x1 = 100; }
      const pad = Math.max(2, (x1 - x0) * 0.04); x0 -= pad; x1 += pad;
    }
    pts = pts.filter((m) => m.tm >= x0 && m.tm <= x1);
    const ys = pts.map((m) => m[yk]);
    let y1 = ys.length ? Math.max(...ys) : 100;
    y1 = niceCeil(y1 * 1.05);
    const y0 = 0;
    const M = { l: 58, r: 16, t: 14, b: 42 };
    const X = (v) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
    const Y = (v) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
    // grid + axes
    ctx.font = "12px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#64748b"; ctx.strokeStyle = "#e9eef4"; ctx.lineWidth = 1;
    ticks(y0, y1, 6).forEach((v) => { const y = Y(v); ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(W - M.r, y); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText(fmtTick(v), M.l - 8, y + 4); });
    ticks(x0, x1, Math.max(4, Math.floor(W / 90))).forEach((v) => { const x = X(v); ctx.beginPath(); ctx.moveTo(x, M.t); ctx.lineTo(x, H - M.b); ctx.stroke(); ctx.textAlign = "center"; ctx.fillText(fmtTick(v), x, H - M.b + 18); });
    ctx.fillStyle = "#334155"; ctx.font = "600 11px 'Space Grotesk', sans-serif"; ctx.textAlign = "center";
    ctx.fillText("PHASE CHANGE TEMPERATURE (°C)", (M.l + W - M.r) / 2, H - 6);
    ctx.save(); ctx.translate(14, (M.t + H - M.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(yk === "vol" ? "VOLUMETRIC LATENT HEAT (MJ/m³)" : "LATENT HEAT (kJ/kg)", 0, 0); ctx.restore();
    // points
    PTS = pts.map((m) => ({ m, x: X(m.tm), y: Y(m[yk]) }));
    const r = PTS.length > 600 ? 3.2 : 4.2;
    PTS.forEach((p) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = (COLORS[p.m.category] || "#999") + "c0"; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "#ffffff"; ctx.stroke();
    });
    state.compare.forEach((id) => { const p = PTS.find((q) => q.m.id === id); if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.stroke(); } });
    if (!PTS.length) { ctx.fillStyle = "#64748b"; ctx.font = "14px 'Work Sans', sans-serif"; ctx.fillText("No data points for these filters", W / 2, H / 2); }
  }
  function niceCeil(v) { const p = 10 ** Math.floor(Math.log10(v || 1)); return Math.ceil(v / p) * p; }
  function ticks(a, b, n) {
    const span = b - a, step0 = span / n, p = 10 ** Math.floor(Math.log10(step0)), e = step0 / p;
    const step = (e >= 5 ? 10 : e >= 2 ? 5 : e >= 1 ? 2 : 1) * p, out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  const fmtTick = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : String(v));
  function nearest(e) {
    const r = $("#chart").getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 100;
    PTS.forEach((p) => { const d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < bd) { bd = d; best = p; } });
    return best;
  }
  function setupChartEvents() {
    const cv = $("#chart"), tip = $("#tip");
    cv.addEventListener("mousemove", (e) => {
      const p = nearest(e);
      if (!p) { tip.style.opacity = 0; cv.style.cursor = "crosshair"; return; }
      cv.style.cursor = "pointer";
      const yk = state.yMode === "vol" ? "vol" : "lh";
      tip.innerHTML = `<b>${esc(p.m.name)}</b><br>${fmt(p.m.tm)} °C · ${fmt(p.m[yk], 0)} ${yk === "vol" ? "MJ/m³" : "kJ/kg"}`;
      tip.style.left = p.x + "px"; tip.style.top = p.y + "px"; tip.style.opacity = 1;
    });
    cv.addEventListener("mouseleave", () => (tip.style.opacity = 0));
    cv.addEventListener("click", (e) => { const p = nearest(e); if (p) openDetail(p.m.id); });
  }

  // ---------- detail drawer ----------
  let lastFocus = null;
  function openDetail(id) {
    const m = BYID.get(id); if (!m) return;
    lastFocus = document.activeElement;
    const kv = (label, val, unit, hl, extra = "") => `<div class="${hl ? "hl" : ""}"><dt>${label}</dt><dd>${val == null ? '<span class="dash">—</span>' : esc(val)} ${val == null ? "" : `<small>${unit}</small>`}${extra}</dd></div>`;
    const pair = (s, l, d) => (s == null && l == null ? null : `${fmt(s, d) ?? "—"} / ${fmt(l, d) ?? "—"}`);
    $("#d-head").innerHTML = `
      <span class="tag"><i style="background:${COLORS[m.category] || "#999"}"></i>${esc(m.category)}</span>
      ${m.nature === "Commercial" ? '<span class="badge com">Commercial product</span>' : ""}${m.added ? '<span class="badge">New</span>' : ""}
      <h2 id="d-title">${esc(m.name)}</h2>
      <div class="meta-line">${[m.manufacturer, m.formula && `Formula: ${esc(m.formula)}`, m.composition && `Composition: ${esc(m.composition)}`].filter(Boolean).join(" · ")}</div>`;
    const reports = (m.reports || []).filter((r) => r.tm != null);
    $("#d-body").innerHTML = `
      <dl class="kv">
        ${kv("Phase change temp", fmt(m.tm, 2), "°C", true, m.tm_text ? `<br><small>reported ${esc(m.tm_text)} °C</small>` : "")}
        ${kv("Latent heat", fmt(m.lh, 1), "kJ/kg", true, m.lh_text ? `<br><small>reported ${esc(m.lh_text)} kJ/kg</small>` : "")}
        ${kv("Volumetric storage", fmt(m.vol, 0), "MJ/m³")}
        ${kv("Energy density", m.lh != null ? fmt(m.lh / 3.6, 1) : null, "Wh/kg")}
        ${kv("Density (solid / liquid)", pair(m.rhos, m.rhol, 0), "kg/m³")}
        ${kv("Specific heat (s / l)", pair(m.cps, m.cpl, 2), "kJ/kg·K")}
        ${kv("Thermal conductivity (s / l)", pair(m.ks, m.kl, 3), "W/m·K")}
        ${m.tpeak != null ? kv("DSC peak temp", fmt(m.tpeak, 1), "°C") : ""}
        ${m.htot != null ? kv("Total enthalpy (incl. sensible)", fmt(m.htot, 0), "kJ/kg") : ""}
        ${m.tmax != null ? kv("Max operating temp", fmt(m.tmax, 0), "°C") : ""}
        ${m.mu != null ? kv("Dynamic viscosity (l)", fmt(m.mu, 3), "mPa·s") : ""}
        ${m.cost != null ? kv("Indicative cost", fmt(m.cost, 2), "$/kg") : ""}
      </dl>
      ${reports.length > 1 ? `<h3>Values reported by different sources</h3>
        <table class="mini"><thead><tr><th>T (°C)</th><th>ΔH (kJ/kg)</th><th>Source</th></tr></thead><tbody>
        ${reports.map((r) => `<tr><td>${cell(r.tm, 2)}</td><td>${cell(r.lh, 1)}</td><td>${esc(r.ref)}</td></tr>`).join("")}</tbody></table>` : ""}
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
    else { if (state.compare.length >= 4) { alertTray("You can compare up to 4 materials"); return; } state.compare.push(id); }
    saveCompare();
  }
  function saveCompare() { store.set("pcm-compare", state.compare); renderTray(); renderTable(); drawChart(); }
  function alertTray(msg) { const t = $("#tray strong"); const o = t.textContent; t.textContent = msg; setTimeout(() => (t.textContent = o), 1800); }
  function renderTray() {
    $("#tray").classList.toggle("show", state.compare.length > 0);
    $("#tray-items").innerHTML = state.compare.map((id) => `<span class="pill">${esc(BYID.get(id)?.name)}<button data-rm="${id}" aria-label="Remove">✕</button></span>`).join("");
    $("#open-compare").disabled = state.compare.length < 2;
  }
  function openCompare() {
    const ms = state.compare.map((id) => BYID.get(id));
    const rows = [
      ["Class", (m) => m.category], ["Type", (m) => m.manufacturer || m.nature],
      ["T phase change (°C)", (m) => m.tm, 1], ["Latent heat (kJ/kg)", (m) => m.lh, 0, "max"],
      ["Volumetric (MJ/m³)", (m) => m.vol, 0, "max"], ["Density (kg/m³)", (m) => m.rho, 0],
      ["cp solid (kJ/kg·K)", (m) => m.cps, 2, "max"], ["cp liquid (kJ/kg·K)", (m) => m.cpl, 2, "max"],
      ["k solid (W/m·K)", (m) => m.ks, 3, "max"], ["k liquid (W/m·K)", (m) => m.kl, 3, "max"],
      ["Max operating (°C)", (m) => m.tmax, 0], ["Sources", (m) => (m.refs || []).join("; ")],
    ];
    $("#compare-body").innerHTML = `<div class="table-wrap"><table class="cmp-table"><thead><tr><th></th>${ms.map((m) => `<th scope="col">${esc(m.name)}</th>`).join("")}</tr></thead><tbody>
      ${rows.map(([label, f, d, best]) => {
        const vals = ms.map(f);
        const nums = vals.filter((v) => typeof v === "number");
        const top = best && nums.length > 1 ? Math.max(...nums) : null;
        return `<tr><td>${label}</td>${vals.map((v) => `<td class="${top != null && v === top ? "best" : ""}">${typeof v === "number" ? fmt(v, d) : v ? esc(v) : '<span class="dash">—</span>'}</td>`).join("")}</tr>`;
      }).join("")}</tbody></table></div><p class="note">Green marks the highest value in each row where higher is usually better.</p>`;
    $("#compare-dialog").showModal();
  }

  // ---------- export ----------
  function exportCSV() {
    const cols = [["id", "ID"], ["name", "Name"], ["category", "Class"], ["nature", "Type"], ["manufacturer", "Manufacturer"], ["formula", "Formula"],
      ["composition", "Composition"], ["tm", "T_pc (°C)"], ["lh", "Latent heat (kJ/kg)"], ["vol", "Volumetric (MJ/m³)"], ["cps", "cp_s (kJ/kgK)"],
      ["cpl", "cp_l (kJ/kgK)"], ["rhos", "rho_s (kg/m3)"], ["rhol", "rho_l (kg/m3)"], ["ks", "k_s (W/mK)"], ["kl", "k_l (W/mK)"], ["tmax", "T_max (°C)"], ["refs", "References"]];
    const q = (v) => (v == null ? "" : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [cols.map((c) => c[1]).join(",")].concat(VIEW.map((m) => cols.map(([k]) => q(k === "refs" ? (m.refs || []).join("; ") : k === "vol" && m.vol ? +m.vol.toFixed(1) : m[k])).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `pcm-library-${VIEW.length}-materials.csv` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
})();
