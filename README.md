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
