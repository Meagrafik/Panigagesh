// Clientseitiges Pendant zu server/scoring.js (kein Build-Step im Projekt,
// daher bewusst dupliziert statt importiert - bei Änderungen an den festen
// Notengrenzen BEIDE Dateien anpassen). Kalibrierung siehe Kommentar dort.
const GRADE_THRESHOLDS = [
  { grade: "A", min: 28 },
  { grade: "B", min: 18 },
  { grade: "C", min: 13 },
  { grade: "D", min: 8 },
  { grade: "E", min: -Infinity },
];

function panigageshScore(volumeMl, abvPercent, priceEur) {
  if (!(volumeMl > 0) || !(abvPercent > 0) || !(priceEur > 0)) return null;
  return (volumeMl * (abvPercent / 100)) / priceEur;
}

function gradeForScore(score) {
  if (score == null || Number.isNaN(score)) return null;
  for (const { grade, min } of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return "E";
}
