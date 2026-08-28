const GRADE_COLORS = {
  A: "#038141",
  B: "#85bb2f",
  C: "#fecb02",
  D: "#ee8100",
  E: "#e63e11",
};

const state = {
  market: null, // { wwIdent, serviceType, name, plz }
  offer: "standard", // standard | sonderpreis | alle
  category: "alle", // wein | bier | sekt | spirituosen | sonstige | alle
  sort: "score_desc",
};

let categoryLabels = {}; // wird aus der ersten /api/products-Antwort befüllt

function gradeBarHtml(grade) {
  const grades = ["A", "B", "C", "D", "E"];
  const segments = grades
    .map((g) => {
      const isActive = g === grade;
      return `<span class="grade-seg ${isActive ? "active" : ""}" style="background:${GRADE_COLORS[g]}">${g}</span>`;
    })
    .join("");
  return `<div class="grade-bar">${segments}</div>`;
}

function categoryLabel(category) {
  return categoryLabels[category] || category || "–";
}

function formatEur(value) {
  return value == null ? "–" : `${value.toFixed(2)} €`;
}

function formatMl(value) {
  return value == null ? "–" : `${Math.round(value)} ml`;
}

function formatAbv(value) {
  return value == null ? "–" : `${value.toFixed(1)} %`;
}

function formatScore(value) {
  return value == null ? "–" : value.toFixed(1);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Fehler bei ${url}`);
  }
  return data;
}

function saveMarketToStorage(market) {
  try {
    localStorage.setItem("panigagesh.market", JSON.stringify(market));
  } catch (e) {
    // localStorage evtl. nicht verfügbar - kein Problem, dann wird beim
    // nächsten Laden einfach wieder der Default-Markt aufgelöst.
  }
}

function loadMarketFromStorage() {
  try {
    const raw = localStorage.getItem("panigagesh.market");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function renderCurrentMarket() {
  const el = document.getElementById("market-current");
  const banner = document.getElementById("example-data-banner");
  if (!state.market) {
    el.textContent = "Kein Markt ausgewählt.";
    banner.hidden = true;
    return;
  }
  const { name, plz, wwIdent, serviceType } = state.market;
  el.textContent = `Aktiver Markt: ${name || wwIdent}${plz ? ` (PLZ ${plz})` : ""}`;
  banner.hidden = serviceType !== "MANUAL";
}

async function selectMarket(market) {
  const marketPanel = document.getElementById("market-current");
  marketPanel.textContent = `Lade Markt ${market.name || market.wwIdent}… (kann beim ersten Mal etwas dauern)`;
  try {
    const payload = await fetchJson(`/api/markets/${market.wwIdent}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceType: market.serviceType,
        name: market.name,
        plz: market.plz,
      }),
    });
    state.market = {
      wwIdent: payload.market.wwIdent,
      serviceType: payload.market.serviceType,
      name: payload.market.name,
      plz: payload.market.plz,
    };
    saveMarketToStorage(state.market);
    renderCurrentMarket();
    document.getElementById("table-meta").textContent = `Stand: ${new Date(payload.scrapedAt).toLocaleString("de-DE")}`;
    document.getElementById("market-results").innerHTML = "";
    document.getElementById("market-query").value = "";
    await refresh();
  } catch (err) {
    marketPanel.textContent = `Fehler: ${err.message}`;
  }
}

async function initMarket() {
  const stored = loadMarketFromStorage();
  if (stored) {
    state.market = stored;
    renderCurrentMarket();
    try {
      await refresh();
      return;
    } catch (err) {
      // gecachte Daten evtl. nicht mehr vorhanden - Default neu auflösen.
    }
  }
  try {
    const preferred = await fetchJson("/api/markets/default");
    await selectMarket(preferred);
  } catch (err) {
    document.getElementById("market-current").textContent = `Default-Markt (REWE Germering) konnte nicht geladen werden: ${err.message}`;
  }
}

async function searchMarkets() {
  const query = document.getElementById("market-query").value.trim();
  const resultsEl = document.getElementById("market-results");
  if (!query) return;
  resultsEl.innerHTML = "<li>Suche…</li>";
  try {
    const results = await fetchJson(`/api/markets?query=${encodeURIComponent(query)}`);
    if (results.length === 0) {
      resultsEl.innerHTML = "<li>Keine Treffer.</li>";
      return;
    }
    resultsEl.innerHTML = "";
    for (const market of results) {
      const li = document.createElement("li");
      li.textContent = `${market.name || market.wwIdent}${market.zipCode ? ` (${market.zipCode})` : ""}`;
      li.addEventListener("click", () => selectMarket(market));
      resultsEl.appendChild(li);
    }
  } catch (err) {
    resultsEl.innerHTML = `<li class="error">${err.message}</li>`;
  }
}

function renderProductRow(p) {
  const tr = document.createElement("tr");
  if (p.isSonderpreis) tr.classList.add("sonderpreis-row");
  tr.innerHTML = `
    <td>${p.name}${p.isSonderpreis ? ' <span class="badge">Angebot</span>' : ""}</td>
    <td>${categoryLabel(p.category)}</td>
    <td>${formatEur(p.priceEur)}</td>
    <td>${formatMl(p.volumeMl)}</td>
    <td>${formatAbv(p.abvPercent)}</td>
    <td>${formatScore(p.score)}</td>
    <td>${gradeBarHtml(p.grade)}</td>
  `;
  return tr;
}

function renderCategoryTabsOnce(categories) {
  const tabs = document.getElementById("category-tabs");
  if (tabs.dataset.populated) return;
  for (const { id, label } of categories) {
    const btn = document.createElement("button");
    btn.dataset.category = id;
    btn.textContent = label;
    tabs.appendChild(btn);
  }
  tabs.dataset.populated = "true";
}

function buildFilterParams(extra = {}) {
  return new URLSearchParams({
    market: state.market.wwIdent,
    offer: state.offer,
    category: state.category,
    sort: state.sort,
    ...extra,
  });
}

async function loadProducts() {
  if (!state.market) return;
  const tableBody = document.getElementById("product-table-body");
  tableBody.innerHTML = "<tr><td colspan='7'>Lade…</td></tr>";
  try {
    const data = await fetchJson(`/api/products?${buildFilterParams().toString()}`);
    if (data.categories) {
      categoryLabels = Object.fromEntries(data.categories.map((c) => [c.id, c.label]));
      renderCategoryTabsOnce(data.categories);
    }
    document.getElementById("table-meta").textContent = `Stand: ${new Date(data.scrapedAt).toLocaleString("de-DE")} — ${data.products.length} Produkte`;
    tableBody.innerHTML = "";
    if (data.products.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='7'>Keine Produkte in dieser Auswahl.</td></tr>";
      return;
    }
    for (const p of data.products) {
      tableBody.appendChild(renderProductRow(p));
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="error">${err.message}</td></tr>`;
    throw err;
  }
}

async function loadLeaderboard() {
  if (!state.market) return;
  const listEl = document.getElementById("leaderboard-list");
  listEl.innerHTML = "<li>Lade…</li>";
  try {
    const params = buildFilterParams({ sort: "score_desc", limit: "10" });
    const data = await fetchJson(`/api/products?${params.toString()}`);
    if (data.products.length === 0) {
      listEl.innerHTML = "<li>Keine Produkte in dieser Auswahl.</li>";
      return;
    }
    listEl.innerHTML = data.products
      .map(
        (p) => `
      <li>
        <span class="rank-name"><strong>${p.name}</strong> <span class="meta">(${categoryLabel(p.category)})</span></span>
        <span class="rank-score">${formatScore(p.score)} ml/€ ${gradeBarHtml(p.grade)}</span>
      </li>`
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<li class="error">${err.message}</li>`;
  }
}

async function refresh() {
  await Promise.all([loadProducts(), loadLeaderboard()]);
}

function setupOfferTabs() {
  const tabs = document.getElementById("offer-tabs");
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-offer]");
    if (!btn) return;
    tabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.offer = btn.dataset.offer;
    refresh();
  });
}

function setupCategoryTabs() {
  const tabs = document.getElementById("category-tabs");
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-category]");
    if (!btn) return;
    tabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.category = btn.dataset.category;
    refresh();
  });
}

function setupSorting() {
  document.querySelectorAll("#product-table thead th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      const isDesc = state.sort === `${key}_desc`;
      state.sort = isDesc ? `${key}_asc` : `${key}_desc`;
      loadProducts();
    });
  });
}

let searchDebounce;
function setupProductSearch() {
  const input = document.getElementById("product-query");
  const resultEl = document.getElementById("search-result");
  input.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = input.value.trim();
    if (!q) {
      resultEl.innerHTML = "";
      return;
    }
    searchDebounce = setTimeout(async () => {
      if (!state.market) return;
      resultEl.innerHTML = "<p>Suche…</p>";
      try {
        const params = new URLSearchParams({
          market: state.market.wwIdent,
          q,
          serviceType: state.market.serviceType,
        });
        const data = await fetchJson(`/api/products/search?${params.toString()}`);
        if (data.products.length === 0) {
          resultEl.innerHTML = "<p>Kein Treffer.</p>";
          return;
        }
        resultEl.innerHTML = data.products
          .map(
            (p) => `
          <div class="search-hit">
            <strong>${p.name}</strong>${p.isSonderpreis ? ' <span class="badge">Angebot</span>' : ""}
            <span class="meta">(${categoryLabel(p.category)})</span>
            — ${formatEur(p.priceEur)}, ${formatMl(p.volumeMl)}, ${formatAbv(p.abvPercent)}
            — Score ${formatScore(p.score)} ${p.grade ? gradeBarHtml(p.grade) : "(nicht berechenbar)"}
          </div>`
          )
          .join("");
      } catch (err) {
        resultEl.innerHTML = `<p class="error">${err.message}</p>`;
      }
    }, 400);
  });
}

function setupCalculator() {
  document.getElementById("calc-btn").addEventListener("click", () => {
    const price = parseFloat(document.getElementById("calc-price").value);
    const volume = parseFloat(document.getElementById("calc-volume").value);
    const abv = parseFloat(document.getElementById("calc-abv").value);
    const name = document.getElementById("calc-name").value.trim() || "Produkt";
    const resultEl = document.getElementById("calc-result");

    const score = panigageshScore(volume, abv, price);
    if (score == null) {
      resultEl.innerHTML = '<p class="error">Bitte Preis, Volumen und Vol.-% als positive Zahlen angeben.</p>';
      return;
    }
    const grade = gradeForScore(score);
    resultEl.innerHTML = `
      <div class="search-hit">
        <strong>${name}</strong> — Score ${formatScore(score)} ml/€ ${gradeBarHtml(grade)}
      </div>
    `;
  });
}

document.getElementById("market-search-btn").addEventListener("click", searchMarkets);
document.getElementById("market-query").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchMarkets();
});

setupOfferTabs();
setupCategoryTabs();
setupSorting();
setupProductSearch();
setupCalculator();
initMarket();
