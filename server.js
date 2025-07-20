const express = require("express");
const session = require("express-session");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "faculty.json");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(cors({
  origin: "https://faculty-status-display.vercel.app/",
  credentials: true
}));
app.use(express.json());
app.use("/images", express.static(PUBLIC_DIR));

app.use(session({
  secret: "faculty123",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname, "../frontend")));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/faculty", (req, res) => {
  const data = fs.readFileSync(DATA_FILE);
  res.json(JSON.parse(data));
});

app.post("/update", (req, res) => {
  if (!req.session.loggedIn) return res.status(403).json({ message: "Unauthorized" });
  fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
