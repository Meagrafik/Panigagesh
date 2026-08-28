const path = require("path");
const express = require("express");
const marketsRouter = require("./routes/markets");
const productsRouter = require("./routes/products");
const { scoreAndGrade, GRADE_THRESHOLDS } = require("./scoring");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api", marketsRouter);
app.use("/api", productsRouter);

// Manueller Rechner (auch serverseitig verfügbar, falls das Frontend ohne
// eigene Formel-Kopie arbeiten möchte).
app.get("/api/score", (req, res) => {
  const volumeMl = parseFloat(req.query.volumeMl);
  const abvPercent = parseFloat(req.query.abvPercent);
  const priceEur = parseFloat(req.query.priceEur);
  const { score, grade } = scoreAndGrade(volumeMl, abvPercent, priceEur);
  if (score == null) {
    return res.status(400).json({ error: "volumeMl, abvPercent und priceEur müssen positive Zahlen sein." });
  }
  res.json({ score, grade, gradeThresholds: GRADE_THRESHOLDS });
});

app.listen(PORT, () => {
  console.log(`Panigagesh-Tool laeuft auf http://localhost:${PORT}`);
});
