// Panigagesh-Score: ml reiner Alkohol pro ausgegebenem Euro.
// score = Volumen_ml * (Vol.-% / 100) / Preis_EUR

// Feste, absolute Notengrenzen (siehe README/Plan: bewusst NICHT relativ zur
// aktuellen Marktverteilung, damit "A" immer objektiv "guter Deal" bedeutet,
// unabhaengig davon, was sonst noch im Regal steht).
//
// Kalibriert anhand eines echten, manuell erhobenen Datensatzes von 50
// REWE-Produkten (Mittelwert 19.7 ml/€, Median 16.1 ml/€, Spanne ca.
// 5.7-68.3 ml/€ - siehe data/markets/germering-manual.json). Die Grenzen
// wurden so gewaehlt, dass alle 5 Noten im realen Sortiment tatsaechlich
// vorkommen (E 8%, D 24%, C 28%, B 20%, A 18% der 50 Beispielprodukte),
// statt z.B. Note E im Alltag nie zu vergeben.
const GRADE_THRESHOLDS = [
  { grade: "A", min: 28 },
  { grade: "B", min: 18 },
  { grade: "C", min: 13 },
  { grade: "D", min: 8 },
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
