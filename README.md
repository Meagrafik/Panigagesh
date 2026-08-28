# Panigagesh

Web-Tool, das für das Alkohol-Sortiment von REWE-Filialen (Standard: **REWE
Germering**) pro Produkt den **Panigagesh-Score** berechnet:

```
Panigagesh-Score = Volumen_ml × (Vol.-% / 100) / Preis_EUR
```

= **ml reiner Alkohol pro ausgegebenem Euro**. Zusätzlich zur nackten
Zahl bekommt jedes Produkt eine **Panigagesh-Note von A (bester Wert) bis E
(schlechtester Wert)**, optisch angelehnt an den Nutri-Score.

## Features

- Sortierbare Tabelle des Alkohol-Sortiments mit Preis, Volumen, Vol.-%,
  Score und A–E-Note.
- Freitext-Suche nach einem Produkt (erst im gecachten Datenset, sonst
  gezielter Live-Request an REWE für genau diesen einen Suchbegriff).
- Marktwechsel: andere REWE-Filiale per PLZ/Stadt/Name auswählen.
- Sonderangebote laufen als eigene Kategorie ("Sonderpreis") und fließen
  standardmäßig **nicht** in die Standard-Ansicht ein; über die Tabs
  "Standardsortiment / Sonderangebote / Beide" umschaltbar.
- Manueller Rechner für Produkte, die (noch) nicht im Datenset sind.

## Setup

```bash
npm install
npm run scrape      # scraped REWE Germering (Standard-PLZ 82110) einmalig
npm start            # startet den Server auf http://localhost:3000
```

`npm run scrape -- --plz 12345` scraped stattdessen einen anderen Markt.
Der Server kann Märkte auch **on-demand** scrapen, wenn sie über die
UI-Marktsuche ausgewählt werden und noch nicht in `data/markets/` liegen.

## Architektur

```
/scraper
  reweClient.js     # HTTP-Client für die inoffizielle shop.rewe.de-API
  scrapeMarket.js    # Scrape-Orchestrierung (Kategorien/Suchbegriffe,
                      # Parsing, Caching) — von CLI und Server genutzt
  fetchRewe.js        # CLI-Einstiegspunkt (npm run scrape)
  config.js           # Default-PLZ, Suchbegriffe, Kategorie-Slugs, Timings
/server
  index.js            # Express-App: statisches Frontend + API
  scoring.js           # Panigagesh-Score-Formel + feste A–E-Notengrenzen
  routes/markets.js    # Marktsuche/-auswahl (inkl. on-demand Scrape)
  routes/products.js   # Produktliste (aus Cache) + Live-Suchfallback
/public
  index.html / app.js / style.css / scoring.js  # reines Vanilla-JS, kein Build
/data
  markets/<wwIdent>.json   # gecachtes Datenset pro Markt
```

## ⚠️ Wichtige Einschränkungen

**REWE bietet keine offizielle Produkt-API.** Dieses Tool nutzt eine seit
Jahren von mehreren Open-Source-Projekten genutzte, aber **inoffizielle**
JSON-API unter `shop.rewe.de/api/...`, die der REWE-Online-Shop selbst
verwendet. Sie kann sich jederzeit ändern.

**Der Scraper wurde in der Entwicklungsumgebung dieses Tools nicht gegen die
echte API getestet** — die Sandbox, in der dieses Projekt gebaut wurde,
hatte keinen Netzwerkzugriff auf `shop.rewe.de`. Konkret heißt das:

- Die Request-Struktur (Endpunkte, Query-Parameter wie `market`,
  `serviceTypes`, `categorySlug`, `search`) basiert auf öffentlich bekannten,
  reverse-engineerten Projekten (u.a. `KaninchenSpeed/rewe.de_api`,
  `Neumi/cheese_scraper`, `ByteSizedMarius/rewerse-engineering`) und ist
  plausibel, aber **nicht verifiziert**.
- Die genauen Feldnamen einzelner Produkte (Preis, Titel, Grammage,
  Angebots-Flag) in `extractProductFields()` (`scraper/reweClient.js`) sind
  eine **plausible Annahme**, keine bestätigte Tatsache.
- Die Fuzzy-Marktsuche (`GET /api/marketsearch`) ist ebenfalls unbestätigt —
  falls sie nicht existiert, gibt die Marktsuche in der UI einen Hinweis aus,
  stattdessen die 5-stellige PLZ einzugeben (das nutzt den bestätigten
  `service-portfolio`-Endpunkt).

### Kalibrierung (einmalig, mit echtem Internetzugriff nötig)

1. `npm run scrape -- --dump-raw` ausführen. Das speichert eine echte
   REWE-API-Antwort unter `data/debug/raw-<wwIdent>-<slug>.json`.
2. Datei ansehen und mit `extractProductFields()` in `scraper/reweClient.js`
   abgleichen: passen die Feldnamen für Preis/Titel/Grammage/Angebots-Flag?
   Falls nicht, dort anpassen.
3. `npm run scrape` normal laufen lassen und die Ausgabe (`data/markets/…json`,
   Konsole) prüfen: Wurden Kategorie-Slugs gefunden, oder ist auf
   Suchbegriffe zurückgefallen worden? Wie viele Produkte blieben
   `unparsed`?
4. Die reale Score-Verteilung (min/max/Median) mit den festen Notengrenzen
   in `server/scoring.js` (und `public/scoring.js` — beide synchron halten)
   abgleichen und bei Bedarf nachjustieren.

### Weitere Hinweise

- Der Scraper baut absichtlich **kein** aggressives Verhalten: Delay
  zwischen Requests, Backoff/Retry bei HTTP 429/403/5xx. Wie strikt REWE
  tatsächlich rate-limitet, ist unbekannt — die Logik ist vorsorglich, nicht
  auf Basis einer bekannten offiziellen Grenze.
- Vol.-%-Parsing erfolgt per Regex aus Produkttitel/Grammage (kein
  eigenständiges Datenfeld bekannt). Unparsebare Produkte landen im
  `unparsed`-Array der Marktdatei statt verworfen zu werden.
- Ein On-Demand-Scrape bei Marktwechsel in der UI kann je nach Sortimentsgröße
  einige Sekunden bis Minuten dauern.
- Die A–E-Note nutzt **feste, marktunabhängige** Grenzen (ml Alkohol pro
  Euro) — bewusst *nicht* relativ zur aktuellen Sortimentsverteilung, damit
  "A" immer objektiv "guter Deal" bedeutet und nicht nur "besser als 80 % vom
  aktuellen Regal".
