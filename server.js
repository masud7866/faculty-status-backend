const express = require("express");
const session = require("express-session");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Allow frontend access
app.use(cors({
  origin: "https://faculty-status-display.vercel.app",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // true = send only over HTTPS
    sameSite: "none" // must be 'none' for cross-site cookies
  }
}));

// Serve images (optional)
app.use("/images", express.static("public"));

// === API ROUTES ===
app.get("/api/faculty", (req, res) => {
  const data = fs.readFileSync(path.join(__dirname, "faculty.json"));
  res.json(JSON.parse(data));
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    req.session.loggedIn = true;
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

app.use((req, res, next) => {
  console.log("Session:", req.session);
  next();
});

app.post("/api/update", (req, res) => {
  if (!req.session.loggedIn) {
    console.log("Not logged in!");
    return res.status(403).send("Unauthorized");
  }

  const newData = req.body;

  fs.writeFileSync(path.join(__dirname, "faculty.json"), JSON.stringify(newData, null, 2));
  res.sendStatus(200);
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
