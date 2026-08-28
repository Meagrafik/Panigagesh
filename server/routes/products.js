const express = require("express");
const { readCachedMarket } = require("../../scraper/scrapeMarket");
const { fetchProductsPage, extractProductFields, extractProductList } = require("../../scraper/reweClient");
const { scoreAndGrade, GRADE_THRESHOLDS } = require("../scoring");
const { CATEGORIES } = require("../../scraper/categorize");

const router = express.Router();

// Angebots-Filter: Standardsortiment vs. Sonderpreis vs. beides.
function byOffer(products, offer) {
  if (offer === "sonderpreis") return products.filter((p) => p.isSonderpreis);
  if (offer === "alle") return products;
  return products.filter((p) => !p.isSonderpreis); // Default: standard
}

// Getränke-Kategorie-Filter (Wein, Bier, Sekt, Spirituosen, Sonstige).
function byDrinkCategory(products, category) {
  if (!category || category === "alle") return products;
  return products.filter((p) => p.category === category);
}

function byQuery(products, q) {
  if (!q) return products;
  const needle = q.toLowerCase();
  return products.filter((p) => p.name.toLowerCase().includes(needle));
}

const SORTERS = {
  score_desc: (a, b) => b.score - a.score,
  score_asc: (a, b) => a.score - b.score,
  price_asc: (a, b) => a.priceEur - b.priceEur,
  price_desc: (a, b) => b.priceEur - a.priceEur,
  name_asc: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
};

router.get("/products", (req, res) => {
  const { market, q, sort = "score_desc", offer = "standard", category = "alle", limit } = req.query;
  if (!market) {
    return res.status(400).json({ error: "Query-Parameter 'market' (wwIdent) fehlt." });
  }
  const cached = readCachedMarket(market);
  if (!cached) {
    return res.status(404).json({
      error: `Markt ${market} ist noch nicht gecacht. Bitte zuerst über /api/markets/:wwIdent/select aktivieren.`,
    });
  }

  let products = byOffer(cached.products, offer);
  products = byDrinkCategory(products, category);
  products = byQuery(products, q);
  const sorter = SORTERS[sort] || SORTERS.score_desc;
  products = [...products].sort(sorter);
  if (limit) {
    products = products.slice(0, Number(limit));
  }

  res.json({
    market: cached.market,
    scrapedAt: cached.scrapedAt,
    gradeThresholds: GRADE_THRESHOLDS,
    categories: CATEGORIES,
    products,
  });
});

// Live-Fallback: gezielte Produktsuche gegen REWE, falls im Cache kein
// Treffer existiert. Kein Voll-Scrape, nur eine einzelne Suchanfrage.
router.get("/products/search", async (req, res) => {
  const { market, q, serviceType } = req.query;
  if (!market || !q) {
    return res.status(400).json({ error: "Query-Parameter 'market' und 'q' erforderlich." });
  }

  const cached = readCachedMarket(market);
  if (cached) {
    const needle = q.toLowerCase();
    const localMatches = cached.products
      .concat(cached.unparsed.map((u) => ({ ...u, score: null, grade: null })))
      .filter((p) => p.name.toLowerCase().includes(needle));
    if (localMatches.length > 0) {
      return res.json({ source: "cache", products: localMatches });
    }
  }

  const effectiveServiceType = serviceType || cached?.market?.serviceType;
  if (!effectiveServiceType) {
    return res.status(400).json({
      error: "Markt ist nicht gecacht und 'serviceType' fehlt für die Live-Suche.",
    });
  }
  if (effectiveServiceType === "MANUAL") {
    // Manuell erhobener Datensatz ohne echte REWE-Markt-ID - kein Live-Fallback möglich.
    return res.json({ source: "cache", products: [] });
  }

  try {
    const pageJson = await fetchProductsPage({
      wwIdent: market,
      serviceType: effectiveServiceType,
      search: q,
      page: 1,
    });
    const rawProducts = extractProductList(pageJson).slice(0, 10);
    const products = rawProducts.map((p) => {
      const fields = extractProductFields(p);
      const { score, grade } = scoreAndGrade(fields.volumeMl, fields.abvPercent, fields.priceEur);
      return { ...fields, score, grade };
    });
    res.json({ source: "live", products });
  } catch (err) {
    res.status(502).json({ error: `Live-Suche fehlgeschlagen: ${err.message}` });
  }
});

module.exports = router;
