#!/usr/bin/env node
// CLI: scraped das Alkohol-Sortiment eines REWE-Marktes und schreibt es
// nach data/markets/<wwIdent>.json. Standardmaessig REWE Germering (PLZ
// 82110). Siehe reweClient.js fuer Hintergrund zur (inoffiziellen) API.
//
// Nutzung:
//   npm run scrape                  # Germering (Default-PLZ)
//   npm run scrape -- --plz 12345   # anderer Markt per PLZ
//   npm run scrape -- --dump-raw    # nur eine Rohantwort speichern, zum
//                                    # Kalibrieren der Feld-Extraktion

const { resolveMarketByPlz, fetchProductsPage, dumpRaw } = require("./reweClient");
const { scrapeAndCacheMarket, marketDataPath } = require("./scrapeMarket");
const { CATEGORY_SLUGS, DEFAULT_PLZ } = require("./config");

function parseArgs(argv) {
  const args = { plz: DEFAULT_PLZ, dumpRaw: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--plz") {
      args.plz = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--dump-raw") {
      args.dumpRaw = true;
    }
  }
  return args;
}

async function pickMarket(plz) {
  const candidates = await resolveMarketByPlz(plz);
  const preferred =
    candidates.find((c) => c.serviceType === "DELIVERY") ||
    candidates.find((c) => c.serviceType === "PICKUP") ||
    candidates[0];
  console.log(
    `Markt fuer PLZ ${plz}: wwIdent=${preferred.wwIdent} serviceType=${preferred.serviceType} name=${preferred.name}`
  );
  return preferred;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const market = await pickMarket(args.plz);

  if (args.dumpRaw) {
    const slug = CATEGORY_SLUGS[0];
    const pageJson = await fetchProductsPage({
      wwIdent: market.wwIdent,
      serviceType: market.serviceType,
      categorySlug: slug,
      page: 1,
    });
    const file = dumpRaw(`raw-${market.wwIdent}-${slug}`, pageJson);
    console.log(`Rohantwort gespeichert unter ${file}.`);
    console.log(
      "Bitte pruefen, ob die Feldnamen zu extractProductFields() in reweClient.js passen."
    );
    return;
  }

  const payload = await scrapeAndCacheMarket(market, args.plz);
  console.log(
    `Fertig: ${payload.products.length} Produkte mit Score, ${payload.unparsed.length} nicht parsebar.`
  );
  console.log(`Datei: ${marketDataPath(market.wwIdent)}`);
  if (payload.unparsed.length > 0) {
    console.log(
      "Hinweis: unparsebare Produkte liegen im 'unparsed'-Array der Ausgabedatei zur manuellen Kontrolle."
    );
  }
}

main().catch((err) => {
  console.error("Scrape fehlgeschlagen:", err.message);
  process.exitCode = 1;
});
