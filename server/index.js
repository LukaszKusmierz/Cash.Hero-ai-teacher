const express = require("express");
const path = require("path");

const app = express();
// Port 3001 is reserved for the student Vite app during local development.
// Heroku and other production environments still provide their own PORT.
const PORT = process.env.PORT || 3002;
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
