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

- Sortierbare Tabelle des Alkohol-Sortiments mit Kategorie, Preis, Volumen,
  Vol.-%, Score und A–E-Note.
- **Bestenliste (Top 10)**: die aktuell beste Score-Auswahl, respektiert die
  gewählten Filter (Angebot + Getränke-Kategorie).
- **Getränke-Kategorie-Filter**: Wein, Bier, Sekt & Sprudelwein, Spirituosen
  (hart), Sonstige/Mixgetränke — automatisch anhand des Produktnamens
  vergeben (`scraper/categorize.js`), egal ob die Daten vom Live-Scraper oder
  manuell importiert stammen.
- Freitext-Suche nach einem Produkt (erst im gecachten Datenset, sonst
  gezielter Live-Request an REWE für genau diesen einen Suchbegriff).
- Marktwechsel: andere REWE-Filiale per PLZ/Stadt/Name auswählen.
- Sonderangebote laufen als eigene Angebots-Kategorie ("Sonderpreis") und
  fließen standardmäßig **nicht** in die Standard-Ansicht ein; über die Tabs
  "Standardsortiment / Sonderangebote / Beide" umschaltbar.
- Manueller Rechner für Produkte, die (noch) nicht im Datenset sind.

## Setup

```bash
npm install
npm start            # startet den Server auf http://localhost:3000
```

Das Tool ist **sofort vorführbar**: `data/markets/germering-beispiel.json`
enthält 50 händisch recherchierte Beispielprodukte (Name, Preis, Volumen,
Vol.-%) inkl. berechnetem Score, Note und Kategorie und dient als
Fallback-Default, solange kein echter Scrape vorliegt.

**Wichtig: Das ist nur ein Beispieldatensatz, keine echte Datenbank.** Die
eigentliche Produktdatenbank soll aus dem Live-Scraper kommen (auch für
dieselben Produkte, die aktuell im Beispieldatensatz stehen) — siehe unten.
Solange kein Markt live gescraped wurde, zeigt die UI dafür einen deutlichen
Hinweis ("Beispieldaten") an.

Live-Scrape (optional, siehe Einschränkungen unten):

```bash
npm run scrape                  # Live-Scrape REWE Germering (PLZ 82110)
npm run scrape -- --plz 12345   # Live-Scrape eines anderen Marktes
```

Der Server kann Märkte auch **on-demand** live scrapen, wenn sie über die
UI-Marktsuche ausgewählt werden und noch nicht in `data/markets/` liegen.

### Beispiel-/Übergangsdaten aktualisieren

Nur als Krücke, solange der Live-Scraper nicht läuft: ein JSON-Array
`[{ "name", "volumeMl", "abvPercent", "priceEur", "isSonderpreis"?,
"category"? }, ...]` anlegen und importieren:

```bash
node scraper/importManualDataset.js pfad/zu/daten.json germering-beispiel "REWE Germering – Beispieldaten"
```

`category` ist optional — fehlt es, wird es automatisch anhand des
Produktnamens erkannt (`scraper/categorize.js`). Das überschreibt die
angegebene Datei in `data/markets/` mit Score, Note und Kategorie pro
Produkt.

## Architektur

```
/scraper
  categorize.js       # Getränke-Kategorie (Wein/Bier/Sekt/Spirituosen/...)
                       # anhand des Produktnamens — für Scrape UND Import
  reweClient.js        # HTTP-Client für die inoffizielle shop.rewe.de-API
  scrapeMarket.js       # Scrape-Orchestrierung (REWE-Kategorie-Slugs/
                         # Suchbegriffe, Parsing, Caching) — von CLI und
                         # Server genutzt
  fetchRewe.js           # CLI-Einstiegspunkt (npm run scrape)
  config.js              # Default-PLZ, Suchbegriffe, REWE-Kategorie-Slugs, Timings
  importManualDataset.js # Import eines Beispiel-/Übergangsdatensatzes
/server
  index.js            # Express-App: statisches Frontend + API
  scoring.js           # Panigagesh-Score-Formel + feste A–E-Notengrenzen
  routes/markets.js    # Marktsuche/-auswahl (inkl. on-demand Scrape)
  routes/products.js   # Produktliste (aus Cache) + Live-Suchfallback,
                        # Filter nach Angebot UND Getränke-Kategorie
/public
  index.html / app.js / style.css / scoring.js  # reines Vanilla-JS, kein Build
/data
  markets/
    germering-beispiel.json  # Beispieldatensatz (siehe Hinweis oben), NICHT
                              # die echte REWE-Datenbank
    <wwIdent>.json            # echte Live-Scrape-Datensets (nach npm run scrape)
```

## Datenmodell

Ein **Produkt-Objekt** sieht so aus (egal ob aus Live-Scrape, Beispieldatensatz
oder Live-Suchfallback — überall dieselbe Form):

```json
{
  "id": "manual-jagermeister-0-7-23",
  "name": "Jägermeister (0,7)",
  "grammage": null,
  "priceEur": 14.49,
  "volumeMl": 700,
  "abvPercent": 35,
  "isSonderpreis": false,
  "category": "spirituosen",
  "score": 16.91,
  "grade": "C"
}
```

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | string | Eindeutige ID (REWE-Produkt-ID beim Scrape, sonst generierter Slug) |
| `name` | string | Produktname |
| `grammage` | string \| null | Roh-Text zu Packungsgröße, falls vom Scraper vorhanden (nur intern zum Parsen genutzt) |
| `priceEur` | number | Preis in Euro |
| `volumeMl` | number | Volumen in ml |
| `abvPercent` | number | Alkoholgehalt in Vol.-% |
| `isSonderpreis` | boolean | Angebots-Flag (siehe Angebots-Filter) |
| `category` | string | Eine von `wein`, `bier`, `sekt`, `spirituosen`, `sonstige` (siehe `scraper/categorize.js`) |
| `score` | number \| null | Panigagesh-Score (ml Alkohol/€); `null` bei `unparsed`-Einträgen |
| `grade` | string \| null | Panigagesh-Note `A`–`E`; `null` bei `unparsed`-Einträgen |

Eine **Marktdatei** (`data/markets/<wwIdent>.json`) bündelt das so:

```json
{
  "market": { "wwIdent": "...", "plz": "82110", "serviceType": "PICKUP", "name": "..." },
  "scrapedAt": "2026-08-28T11:25:19.298Z",
  "products": [ /* Produkt-Objekte, siehe oben */ ],
  "unparsed": [ /* Produkt-Objekte ohne score/grade, konnten nicht berechnet werden */ ]
}
```

## API

Alle Endpunkte laufen unter dem Express-Server (`npm start`, Default Port 3000).

| Methode & Pfad | Query/Body | Beschreibung |
|---|---|---|
| `GET /api/markets/default` | – | Liefert den Default-Markt: den mitgelieferten Beispieldatensatz, falls vorhanden, sonst Live-Auflösung von PLZ 82110 |
| `GET /api/markets` | `query` (PLZ, Stadt oder Name) | Marktsuche; bei 5-stelliger PLZ über den bestätigten `service-portfolio`-Endpunkt, sonst über die unbestätigte Fuzzy-Suche |
| `POST /api/markets/:wwIdent/select` | Body: `{ serviceType, name?, plz? }` | Aktiviert einen Markt: liest den Cache, oder scraped einmalig on-demand und cached das Ergebnis |
| `GET /api/products` | `market` (Pflicht), `q`, `sort`, `offer`, `category`, `limit` | Produktliste des aktiven Marktes, gefiltert/sortiert (siehe Parameter unten) |
| `GET /api/products/search` | `market`, `q` (Pflicht), `serviceType` | Live-Fallback-Suche nach einem einzelnen Begriff, falls im Cache kein Treffer |
| `GET /api/score` | `volumeMl`, `abvPercent`, `priceEur` | Reine Score/Note-Berechnung ohne Marktbezug (serverseitiges Pendant zum Rechner im Frontend) |

**Parameter für `GET /api/products`:**

- `sort`: `score_desc` (Default), `score_asc`, `price_asc`, `price_desc`, `name_asc`, `name_desc`
- `offer`: `standard` (Default, blendet Sonderangebote aus), `sonderpreis`, `alle`
- `category`: `alle` (Default) oder eine der Kategorien aus dem Datenmodell oben
- `limit`: optional, z. B. `10` für eine Bestenliste

Beispiel-Antwort von `GET /api/products?market=germering-beispiel&category=wein`:

```json
{
  "market": { "wwIdent": "germering-beispiel", "plz": null, "serviceType": "MANUAL", "name": "REWE Germering – Beispieldaten (kein Live-Scrape)" },
  "scrapedAt": "2026-08-28T11:25:19.298Z",
  "gradeThresholds": [ { "grade": "A", "min": 28 }, "..." ],
  "categories": [ { "id": "wein", "label": "Wein" }, "..." ],
  "products": [ /* gefilterte, sortierte Produkt-Objekte */ ]
}
```

### Manuell testen (curl)

```bash
npm start &

# Default-Markt auflösen
curl -s http://localhost:3000/api/markets/default

# Markt aktivieren (nötig, bevor /api/products etwas liefert)
curl -s -X POST http://localhost:3000/api/markets/germering-beispiel/select \
  -H "Content-Type: application/json" -d '{"serviceType":"MANUAL"}'

# Bestenliste: Top 5 Spirituosen
curl -s "http://localhost:3000/api/products?market=germering-beispiel&category=spirituosen&limit=5"

# Manueller Score ohne Markt
curl -s "http://localhost:3000/api/score?volumeMl=700&abvPercent=40&priceEur=15"
```

## Kalibrierung der A–E-Note

Die festen Notengrenzen in `server/scoring.js` (und identisch in
`public/scoring.js`) sind **anhand echter Preisrecherche kalibriert**: 50
händisch bei REWE Germering recherchierte Beispielprodukte (Mittelwert 19,7
ml/€, Median 16,1 ml/€, Spanne ca. 5,7–68,3 ml/€ — der komplette Datensatz
liegt in `data/markets/germering-beispiel.json`). Die Grenzen (A ≥ 28, B 18–<28, C
13–<18, D 8–<13, E < 8) wurden so gewählt, dass alle fünf Noten im echten
Sortiment tatsächlich vorkommen (E 8 %, D 26 %, C 28 %, B 20 %, A 18 % der
50 Beispielprodukte) statt z. B. Note E im Alltag nie zu vergeben. Kommen
neue, deutlich andere Marktdaten hinzu, lohnt es sich, diese Verteilung
erneut zu prüfen und die Grenzen ggf. nachzuziehen (in **beiden** Dateien).

## ⚠️ Wichtige Einschränkungen zum Live-Scraper

**REWE bietet keine offizielle Produkt-API.** Der optionale Live-Scraper
(`npm run scrape`, `scraper/fetchRewe.js`) nutzt eine seit Jahren von
mehreren Open-Source-Projekten genutzte, aber **inoffizielle** JSON-API
unter `shop.rewe.de/api/...`, die der REWE-Online-Shop selbst verwendet. Sie
kann sich jederzeit ändern. Das Tool selbst ist davon **nicht** abhängig —
es funktioniert von Haus aus mit dem mitgelieferten Beispieldatensatz (siehe
oben), aber die **echte Produktdatenbank soll aus diesem Scraper kommen**.

**Der Live-Scraper wurde in der Entwicklungsumgebung dieses Tools nicht
gegen die echte API getestet** — die Sandbox, in der dieses Projekt gebaut
wurde, hatte keinen Netzwerkzugriff auf `shop.rewe.de`. Konkret heißt das:

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

### Live-Scraper testen/reparieren (einmalig, mit echtem Internetzugriff nötig)

1. `npm run scrape -- --dump-raw` ausführen. Das speichert eine echte
   REWE-API-Antwort unter `data/debug/raw-<wwIdent>-<slug>.json`.
2. Datei ansehen und mit `extractProductFields()` in `scraper/reweClient.js`
   abgleichen: passen die Feldnamen für Preis/Titel/Grammage/Angebots-Flag?
   Falls nicht, dort anpassen.
3. `npm run scrape` normal laufen lassen und die Ausgabe (`data/markets/…json`,
   Konsole) prüfen: Wurden REWE-Kategorie-Slugs gefunden, oder ist auf
   Suchbegriffe zurückgefallen worden? Wie viele Produkte blieben
   `unparsed`? Stimmt die automatisch erkannte Getränke-Kategorie
   (`scraper/categorize.js`) grob, oder müssen Markennamen in den
   Stichwortlisten ergänzt werden?

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
