import express from "express";
import * as cheerio from "cheerio";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchLivesportResults } from "./scrapers/livesportResults.js";
import { simulateMatchup, recommendLineup, recommendLineupAdvanced } from "./services/matchupPredictor.js";
// ======================
// Load players.json
// ======================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pickDataDir() {
  const candidates = [
    path.join(__dirname, "data"),
    path.join(process.cwd(), "data"),
    path.join(__dirname, "..", "data"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(__dirname, "data");
}

const DATA_DIR = pickDataDir();

// Coaches are stored in repo-root ./data so they can be edited/managed separately
// from the model/cache data under server/data.
const COACHES_DATA_DIR = path.join(__dirname, "..", "data");
const COACHES_FILE = path.join(COACHES_DATA_DIR, "coaches.json");
const BOOKINGS_FILE = path.join(COACHES_DATA_DIR, "bookings.json");

const PLAYERS_FILE = path.join(DATA_DIR, "players.json");

// Users are stored in repo-root ./data so they can be shared with coaches/bookings.
const USERS_FILE = path.join(COACHES_DATA_DIR, "users.json");
const LEGACY_USERS_FILE = path.join(DATA_DIR, "users.json");

function parseJsonSafe(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  return JSON.parse(text || "{}");
}

function ensureCoachesFile() {
  if (!fs.existsSync(COACHES_DATA_DIR)) {
    fs.mkdirSync(COACHES_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(COACHES_FILE)) {
    fs.writeFileSync(COACHES_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

function ensureBookingsFile() {
  if (!fs.existsSync(COACHES_DATA_DIR)) {
    fs.mkdirSync(COACHES_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

function toStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 64);
}

function normalizeCoachRecord(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const id = Number(c.id);
  const ownerUserIdRaw = c.ownerUserId;
  const ownerUserId =
    ownerUserIdRaw == null || ownerUserIdRaw === ""
      ? null
      : Number.isFinite(Number(ownerUserIdRaw))
        ? Number(ownerUserIdRaw)
        : null;
  const name = String(c.name || "").trim();
  const city = String(c.city || "").trim();
  const years = Number(c.years);
  const level = String(c.level || "").trim();
  const skills = toStringArray(c.skills);
  const students = toStringArray(c.students);
  const style = String(c.style || "").trim();
  const teachingMode = toStringArray(c.teachingMode);
  const price = Number(c.price);
  const rating = Number(c.rating);
  const intro = String(c.intro || c.bio || "").trim();
  const avatar = String(c.avatar || "").trim();
  const gender = String(c.gender || "").trim();
  const coachType = String(c.coachType || "").trim();
  const affiliationType = String(c.affiliationType || "").trim(); // school | org
  const affiliationName = String(c.affiliationName || "").trim();
  const focus = toStringArray(c.focus || c.students);
  const personality = String(c.personality || c.style || "").trim();
  const lat = Number(c?.location?.lat);
  const lng = Number(c?.location?.lng);
  const location =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  return {
    id: Number.isFinite(id) ? id : 0,
    ownerUserId,
    name,
    city,
    years: Number.isFinite(years) && years >= 0 ? years : 0,
    level,
    skills,
    students,
    style,
    teachingMode,
    price: Number.isFinite(price) ? price : 0,
    rating: Number.isFinite(rating) && rating >= 0 ? rating : 0,
    gender,
    coachType,
    affiliationType,
    affiliationName,
    focus,
    personality,
    location,
    avatar,
    intro,
  };
}

function readCoaches() {
  ensureCoachesFile();
  try {
    const raw = fs.readFileSync(COACHES_FILE, "utf-8");
    const data = parseJsonSafe(raw);
    const arr = Array.isArray(data) ? data : [];
    return arr.map(normalizeCoachRecord).filter((c) => c && c.id !== 0);
  } catch (e) {
    console.error("readCoaches failed:", e);
    return [];
  }
}

function writeCoaches(list) {
  ensureCoachesFile();
  const arr = Array.isArray(list)
    ? list.map(normalizeCoachRecord).filter((c) => c && c.id !== 0)
    : [];
  fs.writeFileSync(COACHES_FILE, JSON.stringify(arr, null, 2), "utf-8");
}

function readBookings() {
  ensureBookingsFile();
  try {
    const raw = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    const data = parseJsonSafe(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("readBookings failed:", e);
    return [];
  }
}

function writeBookings(list) {
  ensureBookingsFile();
  const arr = Array.isArray(list) ? list : [];
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(arr, null, 2), "utf-8");
}

function ensureUsersFile() {
  if (!fs.existsSync(COACHES_DATA_DIR)) fs.mkdirSync(COACHES_DATA_DIR, { recursive: true });
  if (fs.existsSync(USERS_FILE)) return;

  // Migrate legacy server/data/users.json if present.
  if (fs.existsSync(LEGACY_USERS_FILE)) {
    try {
      const raw = fs.readFileSync(LEGACY_USERS_FILE, "utf-8");
      const data = parseJsonSafe(raw);
      const legacyArr = Array.isArray(data) ? data : [];
      const migrated = legacyArr
        .map((u) => {
          const id = Number(u?.id);
          const legacyName = String(u?.username || u?.name || "").trim();
          const city = String(u?.city || "").trim() || "北京";
          const trainings = Array.isArray(u?.trainings) ? u.trainings : [];
          const lat = Number(u?.location?.lat);
          const lng = Number(u?.location?.lng);
          const location =
            Number.isFinite(lat) && Number.isFinite(lng)
              ? { lat, lng }
              : { lat: 39.991, lng: 116.31 };

          return {
            id: Number.isFinite(id) ? id : 0,
            username: legacyName || `user${Number.isFinite(id) ? id : Date.now()}`,
            password: String(u?.password || "123456"),
            role: String(u?.role || "user"),
            coachId: u?.coachId == null ? null : Number(u?.coachId),
            city,
            location,
            trainings,
          };
        })
        .filter((u) => u && u.id !== 0);
      fs.writeFileSync(USERS_FILE, JSON.stringify(migrated, null, 2), "utf-8");
      return;
    } catch (e) {
      console.error("migrate users.json failed:", e);
    }
  }

  const seed = [
    {
      id: 1,
      username: "默认用户",
      password: "123456",
      role: "user",
      coachId: null,
      city: "北京",
      location: { lat: 39.991, lng: 116.31 },
      trainings: [],
    },
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(seed, null, 2), "utf-8");
}

function normalizeUserRecord(raw) {
  const u = raw && typeof raw === "object" ? raw : {};
  const id = Number(u.id);
  const username = String(u.username || u.name || "").trim();
  const password = String(u.password || "").trim();
  const role = String(u.role || "user").trim() || "user";
  const coachIdRaw = u.coachId;
  const coachId =
    coachIdRaw == null || coachIdRaw === ""
      ? null
      : Number.isFinite(Number(coachIdRaw))
        ? Number(coachIdRaw)
        : null;
  const city = String(u.city || "").trim() || "北京";
  const trainings = Array.isArray(u.trainings) ? u.trainings : [];
  const lat = Number(u?.location?.lat);
  const lng = Number(u?.location?.lng);
  const location =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: 39.991, lng: 116.31 };

  return {
    id: Number.isFinite(id) ? id : 0,
    username: username || `user${Number.isFinite(id) ? id : Date.now()}`,
    password,
    role,
    coachId,
    city,
    location,
    trainings,
  };
}

function readUsers() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const data = parseJsonSafe(raw);
    const arr = Array.isArray(data) ? data : [];
    return arr.map(normalizeUserRecord).filter((u) => u && u.id !== 0);
  } catch (e) {
    console.error("readUsers failed:", e);
    return [];
  }
}

function writeUsers(list) {
  ensureUsersFile();
  const arr = Array.isArray(list) ? list : [];
  fs.writeFileSync(USERS_FILE, JSON.stringify(arr, null, 2), "utf-8");
}

function normNameKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let players = [];
let playerNameToIdMap = new Map();

try {
  if (fs.existsSync(PLAYERS_FILE)) {
    const raw = fs.readFileSync(PLAYERS_FILE, "utf-8");
    players = parseJsonSafe(raw);

    players.forEach(p => {
      playerNameToIdMap.set(p.name, p.id);
    });

    console.log("players.json loaded:", players.length);
  } else {
    console.log("players.json not found");
  }
} catch (err) {
  console.error("Failed to read players.json:", err);
}
// 1) Environment
// Use absolute path so loading is stable no matter where node is launched from.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;

// 2) Proxy (Clash)
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  "http://127.0.0.1:7897";

setGlobalDispatcher(new ProxyAgent(proxyUrl));
console.log("✅️proxy enabled:", proxyUrl);

// 3) DeepSeek (OpenAI-compatible)
// /api/player-matches works even without OPENAI_API_KEY
// /api/tt-assistant requires valid key
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "EMPTY_KEY_FOR_MATCHES_ONLY",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    port,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
  });
});
// Read player_threat_metrics.json
app.get("/api/player-threat-metrics", (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const file = path.join(DATA_DIR, "player_threat_metrics.json");
    const data = parseJsonSafe(fs.readFileSync(file, "utf-8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to read player_threat_metrics.json" });
  }
});

app.get("/api/player-dominance-metrics", (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const file = path.join(DATA_DIR, "player_dominance_metrics.json");
    const data = parseJsonSafe(fs.readFileSync(file, "utf-8"));
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to read player_dominance_metrics.json" });
  }
});

// -----------------
// Coaches
// GET /api/coaches
// POST /api/register-coach { name, city, years, level, skills, students, style, teachingMode, price, intro }
// -----------------
app.get("/api/coaches", (req, res) => {
  // Hydrate missing location/city for user-created coaches so they can appear in nearby lists
  // even if older records were created before we started persisting coach.location.
  const coaches = readCoaches();
  const users = readUsers();
  const userById = new Map(users.map((u) => [Number(u?.id), u]));

  const hydrated = coaches.map((c) => {
    const ownerId = Number(c?.ownerUserId);
    if (!Number.isFinite(ownerId) || ownerId <= 0) return c;
    const owner = userById.get(ownerId);
    if (!owner || typeof owner !== "object") return c;

    const next = { ...c };
    if (!next.city) next.city = String(owner?.city || "").trim();

    const hasLoc = next.location && typeof next.location === "object";
    if (!hasLoc && owner?.location && typeof owner.location === "object") {
      const lat = Number(owner.location?.lat);
      const lng = Number(owner.location?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        next.location = { lat, lng };
      }
    }
    return next;
  });

  res.json(hydrated);
});

function registerCoachHandler(req, res) {
  try {
    const userId = Number(req.body?.userId);
    const name = String(req.body?.name || "").trim();
    const city = String(req.body?.city || "").trim();
    const yearsRaw = req.body?.years;
    const years = yearsRaw === undefined || yearsRaw === null || yearsRaw === ""
      ? 0
      : Number(yearsRaw);
    const level = String(req.body?.level || "").trim();
    const skills = toStringArray(req.body?.skills);
    const students = toStringArray(req.body?.students);
    const style = String(req.body?.style || "").trim();
    const teachingMode = toStringArray(req.body?.teachingMode);
    const price = Number(req.body?.price);
    const intro = String(req.body?.intro || "").trim();
    const avatar = String(req.body?.avatar || "").trim();
    const gender = String(req.body?.gender || "").trim();
    const coachType = String(req.body?.coachType || "").trim();
    const affiliationType = String(req.body?.affiliationType || "").trim();
    const affiliationName = String(req.body?.affiliationName || "").trim();
    const focus = toStringArray(req.body?.focus || req.body?.students);
    const personality = String(req.body?.personality || req.body?.style || "").trim();
    const locLat = Number(req.body?.location?.lat);
    const locLng = Number(req.body?.location?.lng);
    let location =
      Number.isFinite(locLat) && Number.isFinite(locLng) ? { lat: locLat, lng: locLng } : null;

    let users = null;
    let userIdx = -1;
    let requester = null;
    if (Number.isFinite(userId) && userId > 0) {
      users = readUsers();
      userIdx = users.findIndex((u) => Number(u?.id) === userId);
      requester = userIdx >= 0 ? users[userIdx] : null;
    }

    // If caller didn't provide a location, default to user's location so newly created
    // peer coaches can be found by the nearby filter immediately.
    if (!location && requester?.location && typeof requester.location === "object") {
      const ulat = Number(requester.location?.lat);
      const ulng = Number(requester.location?.lng);
      if (Number.isFinite(ulat) && Number.isFinite(ulng)) {
        location = { lat: ulat, lng: ulng };
      }
    }

    if (!name) return res.status(400).json({ error: "name_required" });
    if (!city) return res.status(400).json({ error: "city_required" });
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ error: "skills_required" });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: "price_invalid" });
    }
    if (!Number.isFinite(years) || years < 0) {
      return res.status(400).json({ error: "years_invalid" });
    }
    if (coachType === "peer") {
      if (affiliationType !== "school" || !affiliationName) {
        return res.status(400).json({ error: "school_required" });
      }
    }
    if (coachType === "professional") {
      if (affiliationType !== "org" || !affiliationName) {
        return res.status(400).json({ error: "org_required" });
      }
    }
    if (affiliationName && affiliationName.length > 64) {
      return res.status(400).json({ error: "affiliationName_invalid" });
    }

    const list = readCoaches();
    const maxId = list.reduce((m, c) => Math.max(m, Number(c?.id) || 0), 0);
    const coach = {
      id: maxId + 1,
      ownerUserId: Number.isFinite(userId) && userId > 0 ? userId : undefined,
      name,
      city,
      years,
      level: level || "普通爱好者",
      skills,
      students,
      style,
      price,
      teachingMode,
      rating: 0,
      gender,
      coachType,
      affiliationType,
      affiliationName,
      focus,
      personality,
      location,
      avatar,
      intro,
    };
    list.push(coach);
    writeCoaches(list);

    let updatedUser = null;
    if (users && userIdx >= 0) {
      const cur = users[userIdx] && typeof users[userIdx] === "object" ? users[userIdx] : {};
      users[userIdx] = { ...cur, role: "coach", coachId: coach.id };
      writeUsers(users);
      updatedUser = { ...users[userIdx], name: users[userIdx].username, password: undefined };
    }

    res.json({ ok: true, coach, user: updatedUser });
  } catch (e) {
    console.error("POST /api/register-coach failed:", e);
    res.status(500).json({ error: "coaches_write_failed" });
  }
}

app.post("/api/register-coach", registerCoachHandler);
// Backward-compatible alias (old UI used /api/coaches)
app.post("/api/coaches", registerCoachHandler);

// DELETE /api/coaches/:id?userId=...
// Only allow deleting coach profiles created/owned by the requesting user.
app.delete("/api/coaches/:id", (req, res) => {
  try {
    const coachId = Number(req.params.id);
    const userId = Number(req.query?.userId ?? req.body?.userId);

    if (!Number.isFinite(coachId) || coachId <= 0) {
      return res.status(400).json({ ok: false, error: "coachId_invalid" });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, error: "userId_required" });
    }

    const users = readUsers();
    const requester = users.find((u) => Number(u?.id) === userId);
    if (!requester) return res.status(404).json({ ok: false, error: "user_not_found" });

    const coaches = readCoaches();
    const idx = coaches.findIndex((c) => Number(c?.id) === coachId);
    if (idx < 0) return res.status(404).json({ ok: false, error: "coach_not_found" });

    const coach = coaches[idx];
    const ownsByLink = Number(requester?.coachId) === coachId;
    const ownsByOwnerId = Number(coach?.ownerUserId) === userId;
    if (!ownsByLink && !ownsByOwnerId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    coaches.splice(idx, 1);
    writeCoaches(coaches);

    let updatedUsersCount = 0;
    const updatedUsers = users.map((u) => {
      if (Number(u?.coachId) !== coachId) return u;
      updatedUsersCount += 1;
      const nextRole = String(u?.role || "user") === "coach" ? "user" : String(u?.role || "user");
      return { ...u, coachId: null, role: nextRole };
    });
    if (updatedUsersCount > 0) writeUsers(updatedUsers);

    const bookings = readBookings();
    const remainingBookings = bookings.filter((b) => Number(b?.coachId) !== coachId);
    const removedBookings = bookings.length - remainingBookings.length;
    if (removedBookings > 0) writeBookings(remainingBookings);

    res.json({
      ok: true,
      removedCoachId: coachId,
      updatedUsers: updatedUsersCount,
      removedBookings,
    });
  } catch (e) {
    console.error("DELETE /api/coaches/:id failed:", e);
    res.status(500).json({ ok: false, error: "coach_delete_failed" });
  }
});

// -----------------
// Users training data
// GET /api/users
// GET /api/users/:id/trainings
// POST /api/users/:id/trainings { date, content, rating, result }
// -----------------
app.get("/api/users", (req, res) => {
  const users = readUsers();
  res.json(users.map((u) => ({ id: u.id, name: u.username, username: u.username, role: u.role, coachId: u.coachId })));
});

app.get("/api/users/:id", (req, res) => {
  const userId = Number(req.params.id);
  const users = readUsers();
  const user = users.find((u) => Number(u?.id) === userId);
  if (!user) return res.status(404).json({ error: "user_not_found" });
  // Keep backward-compatible `name` for existing UI code.
  const { password, ...safe } = user || {};
  res.json({ ...safe, name: safe.username });
});

app.get("/api/users/:id/trainings", (req, res) => {
  const userId = Number(req.params.id);
  const users = readUsers();
  const user = users.find((u) => Number(u?.id) === userId);
  if (!user) return res.status(404).json({ error: "user_not_found" });
  res.json(Array.isArray(user.trainings) ? user.trainings : []);
});

// -----------------
// Bookings
// GET /api/bookings?userName=...
// POST /api/bookings { coachId, coachName, date, time, trainingContent, location, phone, userName? }
// -----------------
app.get("/api/bookings", (req, res) => {
  const userName = String(req.query?.userName || "").trim();
  const userId = Number(req.query?.userId);
  const coachId = Number(req.query?.coachId);
  const list = readBookings();
  let filtered = list;
  if (Number.isFinite(coachId) && coachId > 0) {
    filtered = filtered.filter((b) => Number(b?.coachId) === coachId);
  }
  if (Number.isFinite(userId) && userId > 0) {
    filtered = filtered.filter((b) => {
      const bid = Number(b?.userId);
      if (Number.isFinite(bid) && bid > 0) return bid === userId;
      if (!userName) return false;
      return String(b?.userName || b?.username || "").trim() === userName;
    });
  } else if (userName) {
    filtered = filtered.filter((b) => String(b?.userName || b?.username || "").trim() === userName);
  }
  res.json(filtered);
});

app.post("/api/bookings", (req, res) => {
  try {
    const coachId = Number(req.body?.coachId);
    const coachName = String(req.body?.coachName || "").trim();
    const date = String(req.body?.date || "").trim();
    const time = String(req.body?.time || "").trim();
    const trainingContent = String(req.body?.trainingContent || "").trim();
    const location = String(req.body?.location || "").trim();
    const phone = String(req.body?.phone || "").trim();

    const userId = Number(req.body?.userId);
    const username = String(req.body?.username || req.body?.userName || "当前用户").trim() || "当前用户";

    if (!Number.isFinite(coachId) || coachId <= 0) {
      return res.status(400).json({ ok: false, error: "coachId_invalid" });
    }
    if (!coachName) return res.status(400).json({ ok: false, error: "coachName_required" });
    if (!date) return res.status(400).json({ ok: false, error: "date_required" });
    if (!time) return res.status(400).json({ ok: false, error: "time_required" });
    if (!trainingContent) {
      return res.status(400).json({ ok: false, error: "trainingContent_required" });
    }
    if (!location) return res.status(400).json({ ok: false, error: "location_required" });
    if (!phone) return res.status(400).json({ ok: false, error: "phone_required" });

    const booking = {
      id: Date.now(),
      coachId,
      coachName,
      userId: Number.isFinite(userId) && userId > 0 ? userId : undefined,
      username,
      userName: username,
      date,
      time,
      content: trainingContent,
      location,
      phone,
      status: "pending",
    };

    const list = readBookings();
    list.push(booking);
    writeBookings(list);
    res.json({ ok: true, booking });
  } catch (e) {
    console.error("POST /api/bookings failed:", e);
    res.status(500).json({ ok: false, error: "bookings_write_failed" });
  }
});

// Coach side confirm booking (simple demo)
// POST /api/bookings/:id/confirm
app.post("/api/bookings/:id/confirm", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "id_invalid" });
    }

    const list = readBookings();
    const idx = list.findIndex((b) => Number(b?.id) === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: "booking_not_found" });

    const cur = list[idx] && typeof list[idx] === "object" ? list[idx] : {};
    list[idx] = { ...cur, status: "confirmed" };
    writeBookings(list);
    res.json({ ok: true, booking: list[idx] });
  } catch (e) {
    console.error("POST /api/bookings/:id/confirm failed:", e);
    res.status(500).json({ ok: false, error: "bookings_write_failed" });
  }
});

// DELETE /api/bookings/:id?userId=...&userName=...&coachId=...
app.delete("/api/bookings/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "id_invalid" });
    }

    const scopeUserId = Number(req.query?.userId ?? req.body?.userId);
    const scopeUserName = String(
      req.query?.userName ??
        req.query?.username ??
        req.body?.username ??
        req.body?.userName ??
        ""
    ).trim();
    const scopeCoachId = Number(req.query?.coachId ?? req.body?.coachId);

    if (
      !(Number.isFinite(scopeUserId) && scopeUserId > 0) &&
      !scopeUserName &&
      !(Number.isFinite(scopeCoachId) && scopeCoachId > 0)
    ) {
      return res.status(400).json({ ok: false, error: "delete_scope_required" });
    }

    const list = readBookings();
    const idx = list.findIndex((b) => Number(b?.id) === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: "booking_not_found" });

    const booking = list[idx] && typeof list[idx] === "object" ? list[idx] : {};

    if (Number.isFinite(scopeCoachId) && scopeCoachId > 0) {
      if (Number(booking?.coachId) !== scopeCoachId) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
    }

    if (Number.isFinite(scopeUserId) && scopeUserId > 0) {
      const bid = Number(booking?.userId);
      if (Number.isFinite(bid) && bid > 0) {
        if (bid !== scopeUserId) return res.status(403).json({ ok: false, error: "forbidden" });
      } else if (scopeUserName) {
        const bn = String(booking?.username || booking?.userName || "").trim();
        if (bn !== scopeUserName) return res.status(403).json({ ok: false, error: "forbidden" });
      } else {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
    } else if (scopeUserName) {
      const bn = String(booking?.username || booking?.userName || "").trim();
      if (bn !== scopeUserName) return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const removed = list.splice(idx, 1)[0];
    writeBookings(list);
    res.json({ ok: true, removed });
  } catch (e) {
    console.error("DELETE /api/bookings/:id failed:", e);
    res.status(500).json({ ok: false, error: "bookings_write_failed" });
  }
});

app.post("/api/users/:id/trainings", (req, res) => {
  try {
    const userId = Number(req.params.id);
    const users = readUsers();
    const idx = users.findIndex((u) => Number(u?.id) === userId);
    if (idx < 0) return res.status(404).json({ error: "user_not_found" });

    const date = String(req.body?.date || "").trim();
    const content = String(req.body?.content || "").trim();
    const type = String(req.body?.type || "").trim();
    const rating = String(req.body?.rating || "").trim();
    const result = String(req.body?.result || "").trim();
    const durationHoursRaw = req.body?.durationHours;
    const difficultyRaw = req.body?.difficulty;

    if (!date) return res.status(400).json({ error: "date_required" });
    if (!content) return res.status(400).json({ error: "content_required" });
    if (!rating) return res.status(400).json({ error: "rating_required" });
    if (type && type.length > 32) return res.status(400).json({ error: "type_invalid" });

    const durationHours =
      durationHoursRaw === undefined || durationHoursRaw === null || durationHoursRaw === ""
        ? 1
        : Number(durationHoursRaw);
    if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24) {
      return res.status(400).json({ error: "durationHours_invalid" });
    }

    const difficulty =
      difficultyRaw === undefined || difficultyRaw === null || difficultyRaw === ""
        ? 3
        : Number(difficultyRaw);
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
      return res.status(400).json({ error: "difficulty_invalid" });
    }

    const trainings = Array.isArray(users[idx].trainings) ? users[idx].trainings : [];
    const maxId = trainings.reduce((m, t) => Math.max(m, Number(t?.id) || 0), 0);
    const rec = { id: maxId + 1, date, content, type, rating, result, durationHours, difficulty };
    trainings.push(rec);
    users[idx].trainings = trainings;
    writeUsers(users);

    res.json({ ok: true, training: rec });
  } catch (e) {
    console.error("POST /api/users/:id/trainings failed:", e);
    res.status(500).json({ error: "users_write_failed" });
  }
});

// DELETE /api/users/:id/trainings/:trainingId
app.delete("/api/users/:id/trainings/:trainingId", (req, res) => {
  try {
    const userId = Number(req.params.id);
    const trainingId = Number(req.params.trainingId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, error: "userId_invalid" });
    }
    if (!Number.isFinite(trainingId) || trainingId <= 0) {
      return res.status(400).json({ ok: false, error: "trainingId_invalid" });
    }

    const users = readUsers();
    const userIdx = users.findIndex((u) => Number(u?.id) === userId);
    if (userIdx < 0) return res.status(404).json({ ok: false, error: "user_not_found" });

    const trainings = Array.isArray(users[userIdx]?.trainings) ? users[userIdx].trainings : [];
    const idx = trainings.findIndex((t) => Number(t?.id) === trainingId);
    if (idx < 0) return res.status(404).json({ ok: false, error: "training_not_found" });

    const removed = trainings.splice(idx, 1)[0];
    users[userIdx].trainings = trainings;
    writeUsers(users);

    return res.json({ ok: true, removed });
  } catch (e) {
    console.error("DELETE /api/users/:id/trainings/:trainingId failed:", e);
    return res.status(500).json({ ok: false, error: "users_write_failed" });
  }
});

// -----------------
// Auth (simple demo; plaintext passwords)
// POST /api/auth/register { username, password }
// POST /api/auth/login { username, password }
// -----------------
app.post("/api/auth/register", (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!username) return res.status(400).json({ ok: false, error: "username_required" });
    if (!password) return res.status(400).json({ ok: false, error: "password_required" });

    const users = readUsers();
    if (users.some((u) => String(u?.username || "").trim() === username)) {
      return res.status(409).json({ ok: false, error: "username_exists" });
    }
    const maxId = users.reduce((m, u) => Math.max(m, Number(u?.id) || 0), 0);
    const user = {
      id: maxId + 1,
      username,
      password,
      role: "user",
      coachId: null,
      city: "北京",
      location: { lat: 39.991, lng: 116.31 },
      trainings: [],
    };
    users.push(user);
    writeUsers(users);
    res.json({ ok: true, user: { ...user, name: user.username, password: undefined } });
  } catch (e) {
    console.error("POST /api/auth/register failed:", e);
    res.status(500).json({ ok: false, error: "users_write_failed" });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!username) return res.status(400).json({ ok: false, error: "username_required" });
    if (!password) return res.status(400).json({ ok: false, error: "password_required" });

    const users = readUsers();
    const user = users.find((u) => String(u?.username || "").trim() === username);
    if (!user) return res.status(401).json({ ok: false, error: "invalid_credentials" });
    if (String(user?.password || "") !== password) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }
    res.json({
      ok: true,
      user: { ...user, name: user.username, password: undefined },
    });
  } catch (e) {
    console.error("POST /api/auth/login failed:", e);
    res.status(500).json({ ok: false, error: "login_failed" });
  }
});

// -----------------
// AI recommend coaches (questionnaire)
// POST /api/recommend-coaches {
//   location, budget, coachGender, coachType, trainingGoal, improveSkill, coachStyle
// }
// -----------------
function normalizeWeakSkill(s) {
  const x = String(s || "").trim();
  if (!x) return "";
  if (x === "步法") return "步法训练";
  if (x === "相持稳定性") return "相持能力";
  return x;
}

function coachMatchesWeakSkills(coach, weakSkills) {
  const coachSkills = Array.isArray(coach?.skills) ? coach.skills : [];
  if (!coachSkills.length) return false;

  const normalized = (Array.isArray(weakSkills) ? weakSkills : [])
    .map(normalizeWeakSkill)
    .filter(Boolean);
  if (!normalized.length) return false;

  return normalized.some((w) =>
    coachSkills.some((cs) => {
      const c = String(cs || "").trim();
      if (!c) return false;
      return c === w || c.includes(w) || w.includes(c);
    })
  );
}

function coachTypeLabel(t) {
  if (t === "professional") return "专业教练";
  if (t === "amateur") return "业余教练";
  if (t === "peer") return "校园陪练";
  return "";
}

function calculateCoachMatch(user, coach) {
  let score = 0;

  const improveSkill = String(user?.improveSkill || "").trim();
  const location = String(user?.location || "").trim();
  const coachGender = String(user?.coachGender || "不限").trim() || "不限";
  const coachType = String(user?.coachType || "不限").trim() || "不限";
  const coachStyle = String(user?.coachStyle || "").trim();
  const budget = Number(user?.budget);

  const coachSkills = Array.isArray(coach?.skills) ? coach.skills : [];

  // 技术匹配
  if (improveSkill) {
    const normalized = normalizeWeakSkill(improveSkill);
    const hit = coachSkills.some((s) => {
      const c = String(s || "").trim();
      if (!c) return false;
      return c === normalized || c.includes(normalized) || normalized.includes(c);
    });
    if (hit) score += 40;
  }

  // 城市匹配
  if (location && String(coach?.city || "").trim() === location) score += 20;

  // 价格匹配
  if (Number.isFinite(budget) && budget > 0 && Number(coach?.price) <= budget) {
    score += 15;
  }

  // 性别匹配
  const coachGenderValue = String(coach?.gender || "").trim();
  if (coachGender === "不限" || !coachGenderValue || coachGenderValue === "不限" || coachGenderValue === coachGender) {
    score += 10;
  }

  // 教练类型匹配
  const coachTypeValue = String(coach?.coachType || "").trim();
  if (coachType === "不限" || !coachTypeValue || coachTypeValue === coachType) {
    score += 10;
  }

  // 教学风格匹配（沿用 personality 字段）
  const personality = String(coach?.personality || "").trim();
  if (coachStyle && personality && personality === coachStyle) score += 5;

  return Math.min(score, 100);
}

function buildRecommendReason(user, coach, matchScore) {
  const parts = [];
  const improveSkill = String(user?.improveSkill || "").trim();
  const location = String(user?.location || "").trim();
  const budget = Number(user?.budget);
  const coachSkills = Array.isArray(coach?.skills) ? coach.skills : [];

  if (improveSkill) {
    const normalized = normalizeWeakSkill(improveSkill);
    const hit = coachSkills.some((s) => String(s || "").includes(normalized) || normalized.includes(String(s || "").trim()));
    if (hit) parts.push(`擅长${improveSkill}`);
  }
  if (location && String(coach?.city || "").trim() === location) parts.push("同城");
  if (Number.isFinite(budget) && budget > 0 && Number(coach?.price) <= budget) parts.push("符合预算");

  const goal = String(user?.trainingGoal || "").trim();
  if (goal) {
    const focus = Array.isArray(coach?.focus) ? coach.focus : [];
    if (focus.some((f) => String(f || "").includes(goal) || goal.includes(String(f || "").trim()))) {
      parts.push(`适配目标：${goal}`);
    }
  }

  const typeLabel = coachTypeLabel(String(coach?.coachType || "").trim());
  if (typeLabel) parts.push(typeLabel);

  const text = parts.filter(Boolean).slice(0, 3).join("，");
  return text || `综合匹配度 ${matchScore}%`;
}

app.post("/api/recommend-coaches", (req, res) => {
  try {
    const coaches = readCoaches();

    // Backward compatibility: if weakSkills provided, keep simple behavior.
    const weakSkills = toStringArray(req.body?.weakSkills);
    if (weakSkills.length) {
      const top = (coaches || [])
        .filter((c) => coachMatchesWeakSkills(c, weakSkills))
        .slice(0, 3);
      return res.json({ ok: true, recommended: top });
    }

    const user = {
      location: String(req.body?.location || "").trim(),
      budget: Number(req.body?.budget),
      coachGender: String(req.body?.coachGender || "不限").trim() || "不限",
      coachType: String(req.body?.coachType || "不限").trim() || "不限",
      trainingGoal: String(req.body?.trainingGoal || "").trim(),
      improveSkill: String(req.body?.improveSkill || "").trim(),
      coachStyle: String(req.body?.coachStyle || "").trim(),
    };

    const ranked = (coaches || [])
      .map((coach) => {
        const match = calculateCoachMatch(user, coach);
        return {
          ...coach,
          match,
          reason: buildRecommendReason(user, coach, match),
        };
      })
      .sort((a, b) => Number(b.match || 0) - Number(a.match || 0));

    res.json({ ok: true, recommended: ranked.slice(0, 6) });
  } catch (e) {
    console.error("POST /api/recommend-coaches failed:", e);
    res.status(500).json({ error: "recommend_failed" });
  }
});

// -----------------
// Head-to-head stats from player_matches_local.json
// GET /api/head-to-head?playerA=...&playerB=...
// -----------------
function normSimple(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keyifyName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findLocalDbRecord(localDb, name) {
  if (!localDb || !name) return null;
  const key = keyifyName(name);
  if (key && localDb[key]) return localDb[key];
  const nk = normNameKey(name);
  for (const rec of Object.values(localDb)) {
    if (!rec) continue;
    if (normNameKey(rec.name) === nk) return rec;
  }
  return null;
}

app.get("/api/head-to-head", (req, res) => {
  try {
    const playerA = String(req.query?.playerA || "").trim();
    const playerB = String(req.query?.playerB || "").trim();
    if (!playerA || !playerB) {
      return res.status(400).json({ error: "playerA and playerB are required" });
    }

    const localDb = readLocalDb();
    const rec = findLocalDbRecord(localDb, playerA);
    const matches = Array.isArray(rec?.matches) ? rec.matches : [];

    const bKeys = new Set([
      normSimple(playerB),
      normSimple(playerB).split(" ").slice(0, 2).join(" "),
    ].filter(Boolean));

    let aWins = 0;
    let bWins = 0;
    let total = 0;

    for (const m of matches) {
      const opp = normSimple(m?.opponent);
      const oppId = normSimple(m?.opponentId);
      const hit =
        (opp && Array.from(bKeys).some((k) => opp === k || opp.includes(k) || k.includes(opp))) ||
        (oppId && Array.from(bKeys).some((k) => oppId === k || oppId.includes(k) || k.includes(oppId)));
      if (!hit) continue;

      total += 1;
      const r = String(m?.result || "").toUpperCase();
      if (r === "W") aWins += 1;
      else if (r === "L") bWins += 1;
    }

    return res.json({ ok: true, playerA, playerB, aWins, bWins, total });
  } catch (e) {
    console.error("GET /api/head-to-head failed:", e);
    return res.status(500).json({ error: "head_to_head_failed" });
  }
});

function readThreatMetrics() {
  const file = path.join(DATA_DIR, "player_threat_metrics.json");
  return parseJsonSafe(fs.readFileSync(file, "utf-8"));
}

function readDominanceMetrics() {
  const file = path.join(DATA_DIR, "player_dominance_metrics.json");
  return parseJsonSafe(fs.readFileSync(file, "utf-8"));
}

function findMetricByName(map, name) {
  if (!map || !name) return null;
  if (map[name]) return map[name];
  const nk = normNameKey(name);
  const hit = Object.entries(map).find(([k]) => normNameKey(k) === nk);
  return hit?.[1] || null;
}

app.post("/api/matchup-predict", (req, res) => {
  try {
    const { foreignName, chinaName, eventKey } = req.body || {};
    const foreignUseDominance = Boolean(req.body?.foreignUseDominance);
    if (!foreignName || !chinaName) {
      return res.status(400).json({ error: "foreignName and chinaName are required" });
    }

    const threatMetrics = readThreatMetrics();
    const dominanceMetrics = readDominanceMetrics();
    const foreignRaw = foreignUseDominance
      ? findMetricByName(dominanceMetrics, foreignName)
      : findMetricByName(threatMetrics, foreignName);
    const chinaRaw = findMetricByName(dominanceMetrics, chinaName);

    if (!foreignRaw) {
      return res.status(404).json({
        error: `foreign player not found in ${foreignUseDominance ? "dominance" : "threat"} metrics: ${foreignName}`,
      });
    }
    if (!chinaRaw) {
      return res.status(404).json({ error: `china player not found in dominance metrics: ${chinaName}` });
    }

    const result = simulateMatchup({ foreignRaw, chinaRaw, eventKey });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "matchup prediction failed", message: err?.message || "" });
  }
});

app.post("/api/lineup-recommend", (req, res) => {
  try {
    const { foreignName, eventKey, chinaPoolNames, topN } = req.body || {};
    const foreignUseDominance = Boolean(req.body?.foreignUseDominance);
    if (!foreignName) {
      return res.status(400).json({ error: "foreignName is required" });
    }

    const threatMetrics = readThreatMetrics();
    const dominanceMetrics = readDominanceMetrics();
    const foreignRaw = foreignUseDominance
      ? findMetricByName(dominanceMetrics, foreignName)
      : findMetricByName(threatMetrics, foreignName);
    if (!foreignRaw) {
      return res.status(404).json({
        error: `foreign player not found in ${foreignUseDominance ? "dominance" : "threat"} metrics: ${foreignName}`,
      });
    }

    const sourceNames = Array.isArray(chinaPoolNames) && chinaPoolNames.length > 0
      ? chinaPoolNames
      : Object.keys(dominanceMetrics || {});

    const chinaPool = sourceNames
      .map((name) => ({ name, raw: findMetricByName(dominanceMetrics, name) }))
      .filter((x) => x.raw);

    const advancedRankings = recommendLineupAdvanced({
      foreignRaw,
      chinaPool,
      eventKey,
    });
    const limit = Math.max(1, Number(topN) || 10);

    // Keep legacy output for easy comparison/debug.
    const legacy = recommendLineup({
      foreignRaw,
      chinaPool,
      eventKey,
      topN: limit,
    });

    const rec = {
      total: advancedRankings.length,
      rankings: advancedRankings.slice(0, limit),
      legacyRankings: legacy.rankings || [],
    };
    return res.json(rec);
  } catch (err) {
    return res.status(500).json({ error: "lineup recommendation failed", message: err?.message || "" });
  }
});
// LLM connectivity test
app.get("/api/llm-test", async (req, res) => {
  try {
    const r = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "ping" }],
      temperature: 0,
    });
    res.json({ ok: true, reply: r.choices?.[0]?.message?.content ?? "" });
  } catch (e) {
    res.status(500).json({
      ok: false,
      name: e?.name || "Error",
      status: e?.status,
      message: e?.message || "unknown error",
   });
  }
});

app.post("/api/tt-assistant", async (req, res) => {
  try {
    const { question, player } = req.body;

    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const system = `
你是乒乓球战术参谋（中国队备战视角）。
请严格遵守：
1) 只基于用户提供的数据回答；如果缺数据，明确指出缺口。
2) 必须输出 Markdown。
3) 按以下结构输出：

## 对手概览
- 姓名
- 国家 / 排名 / 分层
- 打法标签
- 近期状态

## 核心威胁点（3-5条）
- 威胁点
- 证据
- 我方风险

## 对战策略
### 接发球
### 前三板
### 相持
### 关键分

## 训练建议（可执行）
- [ ] 训练项（频次 + 指标）
- [ ] 训练项（频次 + 指标）

## 需要补充的数据
- 缺口1
- 缺口2
`.trim();

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ question, player }, null, 2) },
      ],
      temperature: 0.3,
    });

    res.json({
      answer: completion.choices?.[0]?.message?.content ?? "",
    });
  } catch (e) {
    console.error("LLM error:", e);
    res.status(500).json({
      error: "llm_failed",
      name: e?.name || "Error",
      status: e?.status,
      message: e?.message || "unknown error",
    });
  }
});

app.post("/api/match-ai-analysis", async (req, res) => {
  try {
    const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(501).json({
        error: "llm_not_configured",
        message: "Missing OPENAI_API_KEY (DeepSeek).",
      });
    }

    const {
      question,
      chinaName,
      foreignName,
      gender,
      eventKey,
      eventLabel,
      sim,
      h2h,
      chinaPlayer,
      foreignPlayer,
      chinaDominance,
      foreignDominance,
      foreignThreat,
    } = req.body || {};

    if (!chinaName || !foreignName) {
      return res.status(400).json({ error: "chinaName and foreignName are required" });
    }

    const system = `
你是乒乓球比赛“AI分析助手”（中国队备战视角）。你将基于用户提供的页面数据，对“${String(chinaName || "").trim()} vs ${String(foreignName || "").trim()}”进行赛前分析与训练建议。
当前项目/赛事：${String(gender || "").trim()} / ${String(eventLabel || eventKey || "").trim()}

严格要求：
1) 只能基于用户提供的数据，不要编造不存在的事实；缺什么数据就明确写“缺口”。
2) 不要输出任何代码块（不要 \`\`\`），不要直接粘贴原始 JSON 数据；需要引用数字时用简短的“字段=数值”的方式。
3) 内容要可执行、具体到训练方法与指标，不要空话。
4) 必须覆盖：双方特征（技术/心理/风格）、胜率预测解读、关键风险点、针对性训练计划（至少 6 条训练项）。

输出格式（非常重要）：
你必须只输出 **一个可被 JSON.parse 解析的 JSON 对象**，不要包含任何额外文本/前后缀。
JSON schema（字段都必须存在，内容用 Markdown 字符串承载）：
{
  "title": "string",
  "summary": {
    "match": "string",
    "prediction": "string",
    "keyConclusions": ["string", "string", "string"]
  },
  "sections": {
    "comparison": "markdown string",
    "keyFactors": "markdown string",
    "risks": "markdown string",
    "trainingPlan": "markdown string",
    "tactics": "markdown string",
    "missingData": "markdown string"
  }
}
`.trim();

    const payload = {
      question: String(question || "").trim(),
      match: {
        chinaName: String(chinaName || "").trim(),
        foreignName: String(foreignName || "").trim(),
        gender: String(gender || "").trim(),
        eventKey: String(eventKey || "").trim(),
        eventLabel: String(eventLabel || "").trim(),
      },
      sim: sim ?? null,
      h2h: h2h ?? null,
      chinaPlayer: chinaPlayer ?? null,
      foreignPlayer: foreignPlayer ?? null,
      chinaDominance: chinaDominance ?? null,
      foreignDominance: foreignDominance ?? null,
      foreignThreat: foreignThreat ?? null,
    };

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload, null, 2) },
      ],
      temperature: 0.35,
    });

    return res.json({
      answer: completion.choices?.[0]?.message?.content ?? "",
    });
  } catch (e) {
    console.error("POST /api/match-ai-analysis failed:", e);
    return res.status(500).json({
      error: "llm_failed",
      name: e?.name || "Error",
      status: e?.status,
      message: e?.message || "unknown error",
    });
  }
});

/** =========================
 *  ?/data/player_matches_cache.json
 *  GET /api/player-matches?name=Hugo%20CALDERANO&country=BRA&debug=1&force=1
 *  ========================= */

// -----------------  -----------------
const CACHE_DIR = DATA_DIR;
const CACHE_FILE = path.join(CACHE_DIR, "player_matches_cache.json");

function ensureCacheFile() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, JSON.stringify({}), "utf-8");
}
function readCache() {
  ensureCacheFile();
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return parseJsonSafe(raw);
  } catch {
    return {};
  }
}
function writeCache(obj) {
  ensureCacheFile();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), "utf-8");
}
function isExpired(isoTime, maxAgeMs = 6 * 60 * 60 * 1000) {
  if (!isoTime) return true;
  const t = new Date(isoTime).getTime();
  return !Number.isFinite(t) || (Date.now() - t > maxAgeMs);
}
// ----------------- ?-----------------
const LOCAL_DB_FILE = path.join(DATA_DIR, "player_matches_local.json");

function readLocalDb() {
  try {
    if (!fs.existsSync(LOCAL_DB_FILE)) return {};
    const raw = fs.readFileSync(LOCAL_DB_FILE, "utf-8");
    return parseJsonSafe(raw);
  } catch (e) {
    console.error("?readLocalDb failed:", e);
    return {};
  }
}
// ----------------- ?-----------------
function inferGenderFromMatches(matches = []) {
  if (!Array.isArray(matches)) return "Male";
  const hasFemaleEvent = matches.some((m) =>
    String(m?.subEvent || "").toUpperCase().includes("WS")
  );
  return hasFemaleEvent ? "Female" : "Male";
}

function mergeChinaPlayers(basePlayers = [], localDb = {}) {
  const merged = [...basePlayers];
  const existingByName = new Set(
    merged.map((p) => String(p?.name || "").trim().toUpperCase()).filter(Boolean)
  );
  let maxId = merged.length > 0
    ? Math.max(...merged.map((p) => Number(p.id) || 0))
    : 0;

  for (const p of Object.values(localDb || {})) {
    if (String(p?.country || "").toUpperCase() !== "CHN") continue;
    const name = String(p?.name || "").trim().toUpperCase();
    if (!name || existingByName.has(name)) continue;

    maxId += 1;
    merged.push({
      id: maxId,
      name,
      country: "CHN",
      gender: inferGenderFromMatches(p.matches),
      shortName: p.shortName || "",
      ranking: Number(p.ranking) || 999,
    });
    existingByName.add(name);
  }

  return merged;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(arr, idx) {
  if (!Array.isArray(arr)) return "";
  if (idx < 0) return "";
  return String(arr[idx] ?? "").replace(/\s+/g, " ").trim();
}

const RESULTS_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

// ?-1?
function headerIndexes(headers) {
  const idxOf = (keys) => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i] || "";
      if (keys.some((k) => h.includes(k))) return i;
    }
    return -1;
  };

  return {
    year: idxOf(["year"]),
    event: idxOf(["event"]),
    playerA: idxOf(["player a"]),
    playerB: idxOf(["player b"]),
    playerX: idxOf(["player x"]),
    playerY: idxOf(["player y"]),
    subEvent: idxOf(["sub-event", "sub event", "subevent"]),
    stage: idxOf(["stage"]),
    round: idxOf(["round"]),
    result: idxOf(["result"]),
    games: idxOf(["games"]),
    winner: idxOf(["winner"]),
  };
}

// W/L?
function deriveOpponentAndResult(row, nameNorm) {
  const players = [
    row.playerA,
    row.playerB,
    row.playerX,
    row.playerY,
  ].filter(Boolean);

  const playersNorm = players.map((p) => norm(p));

  // ? includes ?
  const meIndex = playersNorm.findIndex((p) => p.includes(nameNorm) || nameNorm.includes(p));
  const me = meIndex >= 0 ? players[meIndex] : "";

  // ?
  // ?
  let opponent = "";
  if (meIndex >= 0) {
    //  vs X?A vs B
    const oppIndex = playersNorm.findIndex((p, i) => i !== meIndex);
    opponent = oppIndex >= 0 ? players[oppIndex] : "";
  } else {
    opponent = players[0] || "";
  }

  //  winner 
  // winner ?norm+includes
  const winnerNorm = norm(row.winner);
  let result = "";
  if (winnerNorm) {
    const meHit = winnerNorm.includes(nameNorm) || nameNorm.includes(winnerNorm);
    result = meHit ? "W" : "L";
  }

  return { me, opponent, result };
}

// 1) ?results.ittf.link  playerId (abc)
async function resolvePlayerIdFromResultsSite(name, country) {
  const nameRaw = String(name || "").trim();
  const countryRaw = String(country || "").trim().toUpperCase();

  // ugo CALDERANO / CALDERANO Hugo
  const parts = nameRaw.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ") || "";
  const nameVariant1 = nameRaw;
  const nameVariant2 = (last ? `${last} ${first}` : nameRaw).trim();
  const tryQueries = [nameVariant2, nameVariant1];

  // ?
  for (const strictCountry of [true, false]) {
    for (const qName of tryQueries) {
      const listUrl =
        "https://results.ittf.link/index.php/player-profile/list/60" +
        `?resetfilters=1&vw_profiles___Name_raw=${encodeURIComponent(qName)}`;

      const html = (await axios.get(listUrl, { timeout: 20000, headers: RESULTS_HEADERS })).data;
      const $ = cheerio.load(html);

      // ??abc?
      const candidates = [];

      $("table tbody tr").each((_, tr) => {
        const rowText = String($(tr).text() || "").replace(/\s+/g, " ").trim();
        const rowUpper = rowText.toUpperCase();
        const rowNorm = norm(rowText);

        //  abc=xxxx
        const href = $(tr).find("a").attr("href") || "";
        const m = href.match(/abc=(\d+)/);
        const abc = m?.[1];
        if (!abc) return;

        // ?
        const okName =
          rowNorm.includes(norm(nameVariant1)) ||
          rowNorm.includes(norm(nameVariant2));

        if (!okName) return;

        if (strictCountry && countryRaw) {
          if (!rowUpper.includes(countryRaw)) return;
        }

        candidates.push({ abc, rowText });
      });

      if (candidates.length > 0) {
        return candidates[0].abc; // ?
      }
    }
  }

  return null;
}

// 2) results.ittf.link?
async function fetchMatchesOnline(name, country) {
  const nameNorm = norm(name);
  const playerId = await resolvePlayerIdFromResultsSite(name, country);

  if (!playerId) {
    return {
      name,
      updatedAt: new Date().toISOString(),
      matches: [],
      source: "results.ittf.link",
      error: "playerId not found",
      meta: {
        countryUsed: String(country || "").toUpperCase(),
        note: "resolvePlayerId returned null",
      },
    };
  }

  const matchesUrl =
    "https://results.ittf.link/index.php/player-matches/list/31" +
    `?abc=${playerId}` +
    `&resetfilters=1` +
    `&vw_matches___wo[value][]=0`;

  const html = (await axios.get(matchesUrl, { timeout: 20000, headers: RESULTS_HEADERS })).data;
  const $ = cheerio.load(html);

  const table = $("table").first();
  if (!table.length) {
    return {
      name,
      updatedAt: new Date().toISOString(),
      matches: [],
      source: "results.ittf.link",
      playerId,
      error: "matches table not found",
      meta: { matchesUrl },
    };
  }

  const headers = [];
  table.find("thead th").each((_, th) => headers.push(norm($(th).text())));
  const idx = headerIndexes(headers);

  const rows = [];
  table.find("tbody tr").each((_, tr) => {
    const tds = [];
    $(tr).find("td").each((__, td) => tds.push($(td).text()));

    const year = safeText(tds, idx.year);
    const event = safeText(tds, idx.event);
    const stage = safeText(tds, idx.stage);
    const round = safeText(tds, idx.round);
    const games = safeText(tds, idx.games);
    const winner = safeText(tds, idx.winner);

    const playerA = safeText(tds, idx.playerA);
    const playerB = safeText(tds, idx.playerB);
    const playerX = safeText(tds, idx.playerX);
    const playerY = safeText(tds, idx.playerY);
    const subEvent = safeText(tds, idx.subEvent);

    if (!event || !year) return;

    const row = {
      year,
      event,
      stage,
      round,
      games,
      winner,
      playerA,
      playerB,
      playerX,
      playerY,
      subEvent,
    };

    const { opponent, result } = deriveOpponentAndResult(row, nameNorm);

    rows.push({
      date: year, // results  year
      event,
      round: stage && round ? `${stage} / ${round}` : (round || stage || ""),
      opponent: opponent || "",
      score: games || "",
      result: result || "",
      subEvent: subEvent || "",
    });
  });

  const matches = rows.slice(0, 10);

  return {
    name,
    updatedAt: new Date().toISOString(),
    matches,
    source: "results.ittf.link",
    playerId,
    meta: {
      headers,
      matchesUrl,
      countryUsed: String(country || "").toUpperCase(),
    },
  };
}

// /api/player-matches (local db only)
app.get("/api/player-matches", (req, res) => {
  const name = String(req.query.name || "").trim();

  if (!name) {
    return res.status(400).json({ error: "missing name" });
  }

  const localDb = readLocalDb();

  // Match by value.name, not key
  const matchedEntry = Object.values(localDb).find(
    player =>
      player.name &&
      player.name.toLowerCase().trim() === name.toLowerCase().trim()
  );

  if (!matchedEntry) {
    return res.json({
      ok: true,
      name,
      matches: [],
      source: "local",
      message: "Player not found in player_matches_local.json",
    });
  }

  return res.json({
    ok: true,
    name,
    updatedAt: new Date().toISOString(),
    matches: matchedEntry.matches || [],
    source: "local",
  });
});

// DEBUG: inspect results list page and candidate abc ids
app.get("/api/debug-results-list", async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();
    const country = String(req.query.country || "").trim().toUpperCase();

    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0] || "";
    const last = parts.slice(1).join(" ") || "";
    const nameVariant1 = name;
    const nameVariant2 = (last ? `${last} ${first}` : name).trim();
    const tryQueries = [nameVariant2, nameVariant1];

    const out = [];

    for (const qName of tryQueries) {
      const listUrl =
        "https://results.ittf.link/index.php/player-profile/list/60" +
        `?resetfilters=1&vw_profiles___Name_raw=${encodeURIComponent(qName)}`;

      const html = (await axios.get(listUrl, { timeout: 20000, headers: RESULTS_HEADERS })).data;

      const abcs = Array.from(html.matchAll(/abc=(\d+)/g))
        .map((m) => m[1])
        .slice(0, 30);

      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : "";

      const textSample = String(
        html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      ).slice(0, 300);

      out.push({
        qName,
        listUrl,
        title,
        abcCount: abcs.length,
        abcs,
        country,
        textSample,
      });
    }

    res.json({ ok: true, out });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
//  /api/players 
app.get("/api/players", (req, res) => {
  if (players.length === 0) {
    return res.status(404).json({ error: "Players data not found" });
  }
  const localDb = readLocalDb();
  const mergedPlayers = mergeChinaPlayers(players, localDb);
  res.json(mergedPlayers);
});
app.get("/api/china-players", (req, res) => {
  const localDb = readLocalDb();

  const chinaPlayers = Object.values(localDb)
    .filter(p => p.country === "CHN")
    .map((p, index) => ({
      id: index + 1,
      name: p.name,
      country: "CHN",
      matchCount: p.matches ? p.matches.length : 0
    }));

  res.json(chinaPlayers);
});

// -----------------
// Serve built frontend (optional)
// Use http://localhost:3001/ so /api/* is same-origin (avoids Vite preview 404).
// -----------------
const WEB_ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(WEB_ROOT, "public");
const DIST_DIR = path.join(WEB_ROOT, "dist");

// Serve coach avatars directly from /public so adding images doesn't require rebuild.
const COACHES_PUBLIC_DIR = path.join(PUBLIC_DIR, "coaches");
if (fs.existsSync(COACHES_PUBLIC_DIR)) {
  app.use("/coaches", express.static(COACHES_PUBLIC_DIR));
}

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`✅️API running: http://localhost:${port}`);
});




