// Geteilte Scrape-Logik: von der CLI (fetchRewe.js) UND vom Server
// (on-demand bei Marktwechsel in der UI) genutzt, damit es nur eine
// Implementierung des eigentlichen Scrape-Vorgangs gibt.

const fs = require("fs");
const path = require("path");
const {
  fetchProductsPage,
  extractProductFields,
  extractProductList,
  sleep,
  REQUEST_DELAY_MS,
  MAX_PAGES_PER_QUERY,
} = require("./reweClient");
const { CATEGORY_SLUGS, SEARCH_TERMS } = require("./config");
const { scoreAndGrade } = require("../server/scoring");

async function fetchAllPagesFor(market, queryKind, queryValue) {
  const products = [];
  for (let page = 1; page <= MAX_PAGES_PER_QUERY; page += 1) {
    const pageJson = await fetchProductsPage({
      wwIdent: market.wwIdent,
      serviceType: market.serviceType,
      [queryKind]: queryValue,
      page,
    });
    const pageProducts = extractProductList(pageJson);
    products.push(...pageProducts);
    await sleep(REQUEST_DELAY_MS);
    if (pageProducts.length === 0) break;
  }
  return products;
}

// market: { wwIdent, serviceType, name }
async function scrapeMarket(market) {
  const rawById = new Map();

  let anyCategoryHit = false;
  for (const slug of CATEGORY_SLUGS) {
    try {
      const products = await fetchAllPagesFor(market, "categorySlug", slug);
      if (products.length > 0) anyCategoryHit = true;
      for (const p of products) {
        const fields = extractProductFields(p);
        if (fields.id) rawById.set(fields.id, fields);
      }
    } catch (err) {
      console.warn(`Kategorie "${slug}" fehlgeschlagen: ${err.message}`);
    }
  }

  if (!anyCategoryHit) {
    for (const term of SEARCH_TERMS) {
      try {
        const products = await fetchAllPagesFor(market, "search", term);
        for (const p of products) {
          const fields = extractProductFields(p);
          if (fields.id) rawById.set(fields.id, fields);
        }
      } catch (err) {
        console.warn(`Suchbegriff "${term}" fehlgeschlagen: ${err.message}`);
      }
    }
  }

  const parsed = [];
  const unparsed = [];
  for (const fields of rawById.values()) {
    const { score, grade } = scoreAndGrade(
      fields.volumeMl,
      fields.abvPercent,
      fields.priceEur
    );
    if (score == null) {
      unparsed.push(fields);
    } else {
      parsed.push({ ...fields, score, grade });
    }
  }

  parsed.sort((a, b) => b.score - a.score);
  return { parsed, unparsed };
}

function marketDataPath(wwIdent) {
  return path.join(__dirname, "..", "data", "markets", `${wwIdent}.json`);
}

function readCachedMarket(wwIdent) {
  const file = marketDataPath(wwIdent);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function scrapeAndCacheMarket(market, plz) {
  const { parsed, unparsed } = await scrapeMarket(market);
  const payload = {
    market: {
      wwIdent: market.wwIdent,
      plz: plz || market.zipCode || null,
      serviceType: market.serviceType,
      name: market.name,
    },
    scrapedAt: new Date().toISOString(),
    products: parsed,
    unparsed,
  };
  const outDir = path.join(__dirname, "..", "data", "markets");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(marketDataPath(market.wwIdent), JSON.stringify(payload, null, 2));
  return payload;
}

module.exports = { scrapeMarket, scrapeAndCacheMarket, readCachedMarket, marketDataPath };
