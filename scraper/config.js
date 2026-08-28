// Default-Markt: REWE Germering
const DEFAULT_PLZ = "82110";

// Suchbegriffe als Fallback, falls sich Kategorie-Slugs nicht sauber
// ermitteln lassen. Bewusst breit gefaechert, damit das meiste Alkohol-
// Sortiment (Bier, Wein, Sekt, Spirituosen) erfasst wird.
const SEARCH_TERMS = [
  "bier",
  "biermix",
  "wein",
  "rotwein",
  "weisswein",
  "sekt",
  "prosecco",
  "champagner",
  "spirituosen",
  "wodka",
  "korn",
  "rum",
  "gin",
  "whisky",
  "whiskey",
  "likoer",
  "aperitif",
  "cognac",
  "brandy",
  "tequila",
];

// Kandidaten fuer Kategorie-Slugs (werden versucht, bevor auf Suchbegriffe
// zurueckgefallen wird). Muessen beim Implementieren gegen echte Responses
// verifiziert werden - falsche Slugs liefern einfach leere Ergebnisse und
// werden dann uebersprungen.
const CATEGORY_SLUGS = [
  "bier-mixgetraenke",
  "wein-sekt-spirituosen",
  "wein",
  "sekt-und-champagner",
  "spirituosen",
];

const REQUEST_DELAY_MS = 700;
const MAX_RETRIES = 4;
const OBJECTS_PER_PAGE = 100;
const MAX_PAGES_PER_QUERY = 20;

module.exports = {
  DEFAULT_PLZ,
  SEARCH_TERMS,
  CATEGORY_SLUGS,
  REQUEST_DELAY_MS,
  MAX_RETRIES,
  OBJECTS_PER_PAGE,
  MAX_PAGES_PER_QUERY,
};
