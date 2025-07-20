const express = require("express");
const session = require("express-session");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigin = "https://faculty-status-display.vercel.app";

// Allow frontend access
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: true
}));

// Serve images (optional)
app.use("/images", express.static("public"));

// === API ROUTES ===
app.get("/api/faculty", (req, res) => {
  const data = fs.readFileSync("faculty.json");
  res.json(JSON.parse(data));
});
app.get("/api/status", (req, res) => {
  const data = fs.readFileSync("faculty.json");
  res.json(JSON.parse(data));
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.post("/api/update", (req, res) => {
  if (!req.session.authenticated) return res.status(403).send("Not logged in");
  fs.writeFileSync("faculty.json", JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.get("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Default route
app.get("/", (req, res) => {
  res.send("Backend is running. Try /api/status");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
