// Getränke-Kategorisierung anhand des Produktnamens. Bewusst NAMEN-basiert
// (nicht z.B. anhand des REWE-categorySlug), damit dieselbe Logik für
// Live-Scrape-Daten UND für manuell/anders erhobene Datensätze funktioniert
// (siehe importManualDataset.js) - eine einzige Quelle der Wahrheit.
//
// Reihenfolge ist wichtig: spezifischere/eindeutigere Begriffe zuerst, sonst
// würde z.B. "Weizenkorn" (Kornbrand) faelschlich als Bier oder "Weingeist"
// (Trinksprit) faelschlich als Wein erkannt.

const CATEGORIES = [
  { id: "spirituosen", label: "Spirituosen (hart)" },
  { id: "sekt", label: "Sekt & Sprudelwein" },
  { id: "bier", label: "Bier" },
  { id: "wein", label: "Wein" },
  { id: "sonstige", label: "Sonstige / Mixgetränke" },
];

const SPIRIT_KEYWORDS = [
  "wodka",
  "vodka",
  "weizenkorn",
  "doppelkorn",
  "korn",
  "weingeist",
  "weinbrand",
  "rum",
  "gin",
  "whisky",
  "whiskey",
  "bourbon",
  "tequila",
  "cognac",
  "brandy",
  "likör",
  "liqueur",
  "schnaps",
  "aperitif",
  "aperitivo",
  "campari",
  "jägermeister",
  "underberg",
  "klopfer",
  "feigling",
  "pfeffi",
  "berentzen",
  "ficken",
  // Marken ohne generisches Gattungswort im Namen:
  "bacardi",
  "captain morgan",
  "havana club",
  "sierra",
  "belvedere",
  "absolut",
  "smirnoff",
  "jim beam",
  "gordons",
  "gordon's",
  "grey goose",
  "beefeater",
  "malibu",
  "southern comfort",
  "baileys",
  "kahlúa",
  "kahlua",
  "amaretto",
  "ouzo",
  "grappa",
  "sambuca",
  "ramazzotti",
  "fernet",
  "metaxa",
  "asbach",
  "jack daniel",
  "berliner luft",
  "eckes",
  "kaliskaya",
  "9mile",
  "pitú",
  "pitu",
  "strohrum",
  "360 vodka",
];

const SEKT_KEYWORDS = ["sekt", "prosecco", "champagner", "cava", "crémant", "cremant", "frizzante", "risante", "freixenet"];

const BIER_KEYWORDS = [
  "bier",
  "pils",
  "helles",
  " hell",
  "lager",
  "weizenbier",
  "desperados",
  "corona",
  "augustiner",
  "salitos",
  "löschzwerg",
  "sombersby", // Cider, im Supermarkt meist neben Bier/Biermix einsortiert
];

const WEIN_KEYWORDS = ["wein", "rosé", "rose", "riesling", "spätburgunder", "chardonnay", "primitivo", "lambrusco", "muskat"];

function matchesAny(haystack, keywords) {
  return keywords.some((kw) => haystack.includes(kw));
}

function categorizeProduct(name) {
  const n = (name || "").toLowerCase();
  if (matchesAny(n, SPIRIT_KEYWORDS)) return "spirituosen";
  if (matchesAny(n, SEKT_KEYWORDS)) return "sekt";
  if (matchesAny(n, BIER_KEYWORDS)) return "bier";
  if (matchesAny(n, WEIN_KEYWORDS)) return "wein";
  return "sonstige";
}

module.exports = { CATEGORIES, categorizeProduct };
