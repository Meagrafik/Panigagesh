const express = require("express");
const { resolveMarketByPlz, searchMarkets } = require("../../scraper/reweClient");
const { scrapeAndCacheMarket, readCachedMarket } = require("../../scraper/scrapeMarket");
const { DEFAULT_PLZ } = require("../../scraper/config");

const router = express.Router();

function pickPreferred(candidates) {
  return (
    candidates.find((c) => c.serviceType === "DELIVERY") ||
    candidates.find((c) => c.serviceType === "PICKUP") ||
    candidates[0]
  );
}

// Default-Markt (REWE Germering) auflösen, ohne gleich das ganze Sortiment
// zu scrapen - nur die Markt-ID wird ermittelt.
router.get("/markets/default", async (req, res) => {
  try {
    const candidates = await resolveMarketByPlz(DEFAULT_PLZ);
    const preferred = pickPreferred(candidates);
    res.json({ ...preferred, plz: DEFAULT_PLZ, cached: Boolean(readCachedMarket(preferred.wwIdent)) });
  } catch (err) {
    res.status(502).json({ error: `Default-Markt (PLZ ${DEFAULT_PLZ}) konnte nicht aufgelöst werden: ${err.message}` });
  }
});

// Marktsuche per PLZ, Stadt oder Name.
router.get("/markets", async (req, res) => {
  const query = String(req.query.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Query-Parameter 'query' fehlt." });
  }

  const isPlz = /^\d{5}$/.test(query);
  try {
    if (isPlz) {
      const candidates = await resolveMarketByPlz(query);
      return res.json(candidates.map((c) => ({ ...c, plz: query })));
    }
    const candidates = await searchMarkets(query);
    return res.json(candidates);
  } catch (err) {
    if (!isPlz) {
      return res.status(502).json({
        error:
          "Marktsuche per Name/Stadt ist derzeit nicht verfügbar. Bitte stattdessen eine 5-stellige Postleitzahl eingeben.",
        detail: err.message,
      });
    }
    return res.status(502).json({ error: `Markt für PLZ ${query} konnte nicht aufgelöst werden: ${err.message}` });
  }
});

// Markt aktivieren: liefert gecachte Daten oder scraped einmalig on-demand.
router.post("/markets/:wwIdent/select", express.json(), async (req, res) => {
  const { wwIdent } = req.params;
  const cached = readCachedMarket(wwIdent);
  if (cached) {
    return res.json(cached);
  }

  const { serviceType, name, plz } = req.body || {};
  if (!serviceType) {
    return res.status(400).json({
      error: "Markt ist noch nicht gecacht und 'serviceType' fehlt im Request-Body für den Erst-Scrape.",
    });
  }

  try {
    const payload = await scrapeAndCacheMarket({ wwIdent, serviceType, name }, plz);
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: `Scrape für Markt ${wwIdent} fehlgeschlagen: ${err.message}` });
  }
});

module.exports = router;
