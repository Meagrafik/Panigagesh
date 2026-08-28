#!/usr/bin/env node
// Importiert einen manuell erhobenen Datensatz (JSON-Array mit
// {name, volumeMl, abvPercent, priceEur, isSonderpreis?}) und schreibt ihn
// im selben Format wie ein Scrape-Ergebnis nach data/markets/<wwIdent>.json.
//
// Sinnvoll, solange der Live-Scraper (scraper/fetchRewe.js) nicht gegen die
// echte REWE-API verifiziert ist (siehe README) - von Hand recherchierte
// Preise/Volumen/Vol.-% lassen sich so trotzdem als vollwertiger "Markt" im
// Tool nutzen, inkl. Score- und Notenberechnung.
//
// Nutzung:
//   node scraper/importManualDataset.js <input.json> [wwIdent] [marktname]

const fs = require("fs");
const path = require("path");
const { scoreAndGrade } = require("../server/scoring");

function slugify(name, index) {
  const base = (name || "unbekannt")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `manual-${base || "produkt"}-${index}`;
}

function main() {
  const [, , inputFile, wwIdentArg, nameArg] = process.argv;
  if (!inputFile) {
    console.error("Nutzung: node scraper/importManualDataset.js <input.json> [wwIdent] [marktname]");
    process.exitCode = 1;
    return;
  }
  const wwIdent = wwIdentArg || "germering-manual";
  const marketName = nameArg || "REWE Germering (manuell erhoben)";

  const raw = JSON.parse(fs.readFileSync(path.resolve(inputFile), "utf8"));
  const parsed = [];
  const unparsed = [];

  raw.forEach((entry, index) => {
    const name = entry.name && entry.name.trim() ? entry.name.trim() : "Unbekanntes Produkt";
    const { volumeMl, abvPercent, priceEur } = entry;
    const isSonderpreis = Boolean(entry.isSonderpreis);
    const { score, grade } = scoreAndGrade(volumeMl, abvPercent, priceEur);
    const fields = { id: slugify(name, index), name, grammage: null, priceEur, volumeMl, abvPercent, isSonderpreis };
    if (score == null) {
      unparsed.push(fields);
    } else {
      parsed.push({ ...fields, score, grade });
    }
  });

  parsed.sort((a, b) => b.score - a.score);

  const payload = {
    market: { wwIdent, plz: null, serviceType: "MANUAL", name: marketName },
    scrapedAt: new Date().toISOString(),
    products: parsed,
    unparsed,
  };

  const outDir = path.join(__dirname, "..", "data", "markets");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${wwIdent}.json`);
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(`Importiert: ${parsed.length} Produkte, ${unparsed.length} nicht berechenbar. Datei: ${outFile}`);
}

main();
