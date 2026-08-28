// Client fuer die inoffizielle shop.rewe.de JSON-API.
//
// WICHTIG: Diese API ist nicht offiziell dokumentiert und wurde aus
// oeffentlich bekannten, reverse-engineerten Projekten rekonstruiert
// (u.a. KaninchenSpeed/rewe.de_api, Neumi/cheese_scraper). Sie kann sich
// jederzeit aendern. In der Entwicklungsumgebung dieses Tools war
// shop.rewe.de per Netzwerk-Policy nicht erreichbar - der Code hier ist
// daher NICHT gegen die echte API getestet worden. Bitte einmal lokal mit
// echtem Internetzugriff `npm run scrape -- --dump-raw` laufen lassen und
// bei Bedarf `extractProductFields()` unten an die tatsaechliche Antwort
// anpassen (siehe README, Abschnitt "Kalibrierung").

const { setTimeout: sleep } = require("timers/promises");
const fs = require("fs");
const path = require("path");
const { categorizeProduct } = require("./categorize");
const {
  REQUEST_DELAY_MS,
  MAX_RETRIES,
  OBJECTS_PER_PAGE,
  MAX_PAGES_PER_QUERY,
} = require("./config");

const BASE_URL = "https://shop.rewe.de/api";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function requestJson(url, { accept } = {}) {
  let attempt = 0;
  let lastError;
  while (attempt <= MAX_RETRIES) {
    if (attempt > 0) {
      const backoffMs = REQUEST_DELAY_MS * 2 ** attempt;
      await sleep(backoffMs);
    }
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept || "application/json",
        },
      });
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} von ${url}`);
        attempt += 1;
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} von ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      attempt += 1;
    }
  }
  throw lastError || new Error(`Request an ${url} fehlgeschlagen`);
}

// Loest eine PLZ auf zu Markt-Kandidaten (wwIdent + serviceType).
// Erwartete Rohform laut Recherche unklar/unbestaetigt - wir versuchen,
// so tolerant wie moeglich verschiedene plausible Response-Formen zu lesen.
async function resolveMarketByPlz(plz) {
  const data = await requestJson(`${BASE_URL}/service-portfolio/${plz}`);
  const candidates = [];

  const collect = (entry, serviceType) => {
    if (!entry) return;
    const list = Array.isArray(entry) ? entry : [entry];
    for (const item of list) {
      const wwIdent =
        item.wwIdent || item.marketId || item.market_id || item.id;
      if (!wwIdent) continue;
      candidates.push({
        wwIdent: String(wwIdent),
        serviceType: item.serviceType || serviceType,
        name: item.companyName || item.name || item.displayName || null,
        zipCode: item.zipCode || item.postalCode || plz,
      });
    }
  };

  collect(data.deliveryServices || data.delivery, "DELIVERY");
  collect(data.pickupServices || data.pickup, "PICKUP");
  collect(data.markets, undefined);

  if (candidates.length === 0) {
    throw new Error(
      `Konnte fuer PLZ ${plz} keinen Markt aus der service-portfolio-Antwort ableiten. ` +
        "Rohantwort mit --dump-raw pruefen und resolveMarketByPlz() anpassen."
    );
  }
  return candidates;
}

// Fuzzy-Marktsuche (Name/Stadt/Strasse/PLZ). Endpunkt-Name unbestaetigt -
// falls er nicht existiert, faengt fetchRewe.js das ab und faellt auf eine
// direkte PLZ-Eingabe zurueck.
async function searchMarkets(query) {
  const url = `${BASE_URL}/marketsearch?searchTerm=${encodeURIComponent(query)}`;
  const data = await requestJson(url);
  const list = data.markets || data._embedded?.markets || data;
  if (!Array.isArray(list)) {
    throw new Error("Unerwartetes Format der Marktsuche-Antwort.");
  }
  return list.map((item) => ({
    wwIdent: String(item.wwIdent || item.marketId || item.id),
    name: item.companyName || item.name || item.displayName || null,
    zipCode: item.zipCode || item.postalCode || null,
    street: item.street || null,
  }));
}

async function fetchProductsPage({
  wwIdent,
  serviceType,
  search,
  categorySlug,
  page,
}) {
  const params = new URLSearchParams({
    market: wwIdent,
    serviceTypes: serviceType || "PICKUP",
    sorting: "RELEVANCE_DESC",
    objectsPerPage: String(OBJECTS_PER_PAGE),
    page: String(page),
    source: "",
  });
  if (categorySlug) params.set("categorySlug", categorySlug);
  if (search) params.set("search", search);

  const url = `${BASE_URL}/products?${params.toString()}`;
  return requestJson(url, {
    accept: "application/vnd.rewe.productlist+json",
  });
}

// Parsed Volumen (in ml) aus Freitext wie "0,7l", "700 ml", "6x0,33l",
// "0.33l". Bei Mehrfachpackungen (NxYl) wird das Volumen EINER Einheit
// zurueckgegeben, nicht die Packungssumme - Preis bezieht sich i.d.R.
// ebenfalls auf die Gesamtpackung, das muss ggf. nachjustiert werden, wenn
// sich beim echten Scrape zeigt, dass die Preise Packungspreise sind.
function parseVolumeMl(text) {
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/\s+/g, " ");

  const literMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*l\b/);
  if (literMatch) {
    return parseFloat(literMatch[1].replace(",", ".")) * 1000;
  }
  const mlMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) {
    return parseFloat(mlMatch[1].replace(",", "."));
  }
  return null;
}

// Parsed Vol.-% aus Freitext wie "35% vol", "35 % vol.", "12%".
function parseAbvPercent(text) {
  if (!text) return null;
  const match = text
    .toLowerCase()
    .match(/(\d+(?:[.,]\d+)?)\s*%\s*(vol\.?)?/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

// Extrahiert die fuer den Panigagesh-Score noetigen Felder aus einem
// REWE-Produktobjekt. Feldnamen sind eine plausible Annahme fuer eine
// HAL-JSON-Grocery-API und MUESSEN gegen echte Responses verifiziert werden
// (siehe Datei-Kommentar oben).
function extractProductFields(product) {
  const id = product.id || product.productId || product.gtin;
  const name =
    product.title || product.name || product.description || "Unbekannt";
  const grammage = product.grammage || product.subtitle || "";

  const priceRaw =
    product.price?.value ??
    product.pricing?.currentRetailPrice ??
    product.currentRetailPrice ??
    product.price;
  // Viele Grocery-APIs geben Preise in Cent an - falls priceRaw > 1000
  // wirkt das wie Cent statt Euro (kein Bier kostet > 1000 EUR), dann
  // durch 100 teilen.
  let priceEur = typeof priceRaw === "number" ? priceRaw : null;
  if (priceEur != null && priceEur > 1000) {
    priceEur = priceEur / 100;
  }

  const isSonderpreis = Boolean(
    product.isDiscounted ??
      product.pricing?.strikePrice ??
      product.listing?.discount ??
      product.discount
  );

  const searchText = `${name} ${grammage}`;
  const volumeMl = parseVolumeMl(searchText);
  const abvPercent = parseAbvPercent(searchText);
  const category = categorizeProduct(name);

  return { id, name, grammage, priceEur, volumeMl, abvPercent, isSonderpreis, category };
}

function extractProductList(pageJson) {
  return pageJson._embedded?.products || pageJson.products || [];
}

function dumpRaw(label, data) {
  const dir = path.join(__dirname, "..", "data", "debug");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

module.exports = {
  resolveMarketByPlz,
  searchMarkets,
  fetchProductsPage,
  extractProductFields,
  extractProductList,
  parseVolumeMl,
  parseAbvPercent,
  dumpRaw,
  sleep,
  REQUEST_DELAY_MS,
  MAX_PAGES_PER_QUERY,
};
