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
app.set("trust proxy", 1);
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
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.use((req, res, next) => {
  console.log("Session:", req.session);
  next();
});

app.post("/api/update", (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send("Unauthorized");

  const overrides = req.body;

  // Load current data
  const data = JSON.parse(fs.readFileSync("faculty.json", "utf-8"));

  const updated = data.map((f) => {
    const override = overrides.find(o => o.name === f.name);
    if (override) {
      return {
        ...f,
        manualOverride: override.manualOverride,
        overrideExpiry: override.overrideExpiry
      };
    }
    return f;
  });

  fs.writeFileSync("faculty.json", JSON.stringify(updated, null, 2));
  res.send({ message: "Faculty data updated." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie("connect.sid", {
      sameSite: "none",
      secure: true
    });
    res.json({ success: true });
  });
});
app.get("/api/check-login", (req, res) => {
  if (req.session.loggedIn) {
    res.json({ loggedIn: true });
  } else {
    res.status(401).json({ loggedIn: false });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("Backend is running. Try /api/status");
});

// === AUTO STATUS LOGIC ===
const facultyFile = path.join(__dirname, "faculty.json");

function getCurrentStatus(faculty) {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const timeStr = now.toTimeString().substring(0, 5); // "HH:MM"

  // Check manual override
  if (faculty.manualOverride && faculty.overrideExpiry) {
    const expiry = new Date(faculty.overrideExpiry);
    if (now < expiry) {
      return faculty.manualOverride;
    } else {
      delete faculty.manualOverride; // expired
    }
  }

  // Check if today is their weekend
  if (faculty.weekend?.includes(day)) {
    return "on_weekend";
  }

  // Check if now is in class time
  const classes = faculty.classTimes?.[day];
  if (Array.isArray(classes)) {
    for (const cls of classes) {
      if (
        Array.isArray(cls) &&
        cls.length === 2 &&
        cls[0] < cls[1] &&
        timeStr >= cls[0] &&
        timeStr < cls[1]
      ) {
        return "in_class";
      }
    }
  }

  // Check if now is within office hours
  const office = faculty.officeHours?.[day];
  if (Array.isArray(office) && office.length === 2) {
    const [start, end] = office;
    if (start < end && timeStr >= start && timeStr < end) {
      return "at_dept";
    }
  }

  return "off_duty";
}

function updateStatuses() {
  try {
    const data = JSON.parse(fs.readFileSync(facultyFile));
    const updated = data.map(faculty => ({
      ...faculty,
      status: getCurrentStatus(faculty)
    }));
    fs.writeFileSync(facultyFile, JSON.stringify(updated, null, 2));
    console.log("Auto status updated at", new Date().toLocaleTimeString());
  } catch (err) {
    console.error("Failed to auto-update statuses:", err);
  }
}
updateStatuses();

setInterval(updateStatuses, 3000);


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});