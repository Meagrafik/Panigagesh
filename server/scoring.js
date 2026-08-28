// Panigagesh-Score: ml reiner Alkohol pro ausgegebenem Euro.
// score = Volumen_ml * (Vol.-% / 100) / Preis_EUR

// Feste, absolute Notengrenzen (siehe README/Plan: bewusst NICHT relativ zur
// aktuellen Marktverteilung, damit "A" immer objektiv "guter Deal" bedeutet,
// unabhaengig davon, was sonst noch im Regal steht). Erste Kalibrierung ohne
// echte REWE-Daten - nach dem ersten Scrape ggf. anpassen.
const GRADE_THRESHOLDS = [
  { grade: "A", min: 25 },
  { grade: "B", min: 15 },
  { grade: "C", min: 8 },
  { grade: "D", min: 4 },
  { grade: "E", min: -Infinity },
];

function panigageshScore(volumeMl, abvPercent, priceEur) {
  if (!(volumeMl > 0) || !(abvPercent > 0) || !(priceEur > 0)) {
    return null;
  }
  const pureAlcoholMl = volumeMl * (abvPercent / 100);
  return pureAlcoholMl / priceEur;
}

function gradeForScore(score) {
  if (score == null || Number.isNaN(score)) return null;
  for (const { grade, min } of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return "E";
}

function scoreAndGrade(volumeMl, abvPercent, priceEur) {
  const score = panigageshScore(volumeMl, abvPercent, priceEur);
  return { score, grade: gradeForScore(score) };
}

module.exports = { panigageshScore, gradeForScore, scoreAndGrade, GRADE_THRESHOLDS };
