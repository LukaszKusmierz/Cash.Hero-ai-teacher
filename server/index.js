const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const clientDist = path.join(__dirname, "..", "client", "dist");

app.use(express.static(clientDist));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
