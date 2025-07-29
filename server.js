const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://faculty-status-display.vercel.app",
  credentials: true
}));
app.use(express.json());
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

const facultyPath = path.join(__dirname, "faculty.json");

// Utility: Load faculty data
function loadFacultyData() {
  const data = fs.readFileSync(facultyPath);
  return JSON.parse(data);
}

// Utility: Save faculty data
function saveFacultyData(data) {
  fs.writeFileSync(facultyPath, JSON.stringify(data, null, 2));
}

// Utility: Time comparison
function isNowBetween(startTime, endTime, now = new Date()) {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const start = new Date(now);
  start.setHours(startH, startM, 0, 0);

  const end = new Date(now);
  end.setHours(endH, endM, 0, 0);

  return now >= start && now < end;
}

// API: Get all faculty data
app.get("/api/faculty", (req, res) => {
  const data = loadFacultyData();
  res.json(data);
});

// API: Update a faculty status
app.post("/api/update", (req, res) => {
  const { name, status, duration } = req.body;
  const data = loadFacultyData();

  const faculty = data.find((f) => f.name === name);
  if (!faculty) return res.status(404).json({ message: "Faculty not found" });

  faculty.status = status;
  faculty.lastUpdated = new Date().toISOString();

  const now = new Date();
  if (duration === "1hr") {
    faculty.manualOverrideUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  } else if (duration === "today") {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    faculty.manualOverrideUntil = endOfDay.toISOString();
  }

  saveFacultyData(data);
  res.json({ message: "Status updated successfully" });
});

// API: Check login
app.get("/api/check-login", (req, res) => {
  res.json({ loggedIn: req.session.loggedIn || false });
});

// API: Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    req.session.loggedIn = true;
    res.json({ message: "Login successful" });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

// API: Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ message: "Logout successful" });
});

// Auto-update every minute
setInterval(() => {
  const data = loadFacultyData();
  const now = new Date();
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });

  for (const fac of data) {
    // 1. Check manual override
    if (fac.manualOverrideUntil && new Date(fac.manualOverrideUntil) > now) {
      continue;
    }

    // 2. Check if today is a weekend for this faculty
    if (fac.weekends && fac.weekends.includes(currentDay)) {
      fac.status = "on_weekend";
      continue;
    }

    // 3. Check class times for today
    const classToday = fac.classTimes?.[currentDay] || [];
    let inClass = false;
    for (const slot of classToday) {
      if (isNowBetween(slot.start, slot.end, now)) {
        fac.status = "in_class";
        inClass = true;
        break;
      }
    }
    if (inClass) continue;

    // 4. Check office hours for today
    const officeToday = fac.officeHours?.[currentDay] || [];
    let inOffice = false;
    for (const slot of officeToday) {
      if (isNowBetween(slot.start, slot.end, now)) {
        fac.status = "at_department";
        inOffice = true;
        break;
      }
    }
    if (inOffice) continue;

    // 5. Default fallback
    fac.status = "off_duty";
  }

  saveFacultyData(data);
}, 60000); // 1 minute

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
