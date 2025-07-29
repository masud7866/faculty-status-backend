const express = require("express");
const session = require("express-session");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://faculty-status-display.vercel.app",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);
app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: "none"
  }
}));

app.use("/images", express.static("public"));

// === UTILITY FUNCTIONS ===
function getCurrentTime() {
  const now = new Date();
  const dhakaOffset = 6 * 60; // +0600 in minutes
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + dhakaOffset * 60000);
}

function isNowBetween(startStr, endStr, now) {
  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);
  const start = new Date(now);
  start.setHours(startH, startM, 0, 0);
  const end = new Date(now);
  end.setHours(endH, endM, 0, 0);
  return now >= start && now < end;
}

function getToday() {
  return getCurrentTime().toISOString().split("T")[0]; // YYYY-MM-DD
}

function loadFaculty() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "faculty.json")));
}

function saveFaculty(data) {
  fs.writeFileSync(path.join(__dirname, "faculty.json"), JSON.stringify(data, null, 2));
}

// === SCHEDULED SMART STATUS LOGIC ===
setInterval(() => {
  const now = getCurrentTime();
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Dhaka" });
  const todayStr = getToday();
  const facultyData = loadFaculty();

  facultyData.forEach(fac => {
    // 1. Manual override handling
    if (fac.override && fac.override.until && new Date(fac.override.until) > now) {
      fac.status = fac.override.status;
      return;
    } else {
      delete fac.override; // clear expired
    }

    // 2. Weekend check
    if (fac.weekends && fac.weekends.includes(currentDay)) {
      fac.status = "on_weekend";
      return;
    }

    // 3. Class time check
    let inClass = false;
    if (fac.classTimes && fac.classTimes[currentDay]) {
      for (const time of fac.classTimes[currentDay]) {
        if (isNowBetween(time.start, time.end, now)) {
          fac.status = "in_class";
          inClass = true;
          break;
        }
      }
    }

    if (inClass) return;

    // 4. Office hour check
    let inOffice = false;
    if (fac.officeHours && fac.officeHours[currentDay]) {
      for (const time of fac.officeHours[currentDay]) {
        if (isNowBetween(time.start, time.end, now)) {
          fac.status = "at_department";
          inOffice = true;
          break;
        }
      }
    }

    if (inOffice) return;

    // 5. Default fallback
    fac.status = "off_duty";
  });

  saveFaculty(facultyData);
  console.log(`[AUTO] Statuses updated at ${now.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka" })}`);
}, 60 * 1000); // every minute

// === API ROUTES ===
app.get("/api/faculty", (req, res) => {
  res.json(loadFaculty());
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
  if (!req.session.loggedIn) {
    return res.status(403).send("Unauthorized");
  }

  const updates = req.body; // Expect full faculty array
  const facultyData = loadFaculty();

  updates.forEach(update => {
    const fac = facultyData.find(f => f.email === update.email);
    if (fac) {
      fac.override = {
        status: update.status,
        until: update.duration === "1hr"
          ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
          : new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
      };
      fac.status = update.status;
    }
  });

  saveFaculty(facultyData);
  res.sendStatus(200);
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
  res.json({ loggedIn: !!req.session.loggedIn });
});

// Default
app.get("/", (req, res) => {
  res.send("Backend is running. Try /api/faculty");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
