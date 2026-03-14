import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "server", "data");
const LOCAL_DB_FILE = path.join(DATA_DIR, "player_matches_local.json");

function parseJsonSafe(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  return JSON.parse(text || "{}");
}

function normalizeDate(dateStr) {
  const s = String(dateStr || "").trim().replace(/\s+/g, " ");
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.\s*(\d{4})$/);
  if (!m) return s;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeResult(winlose) {
  const s = String(winlose || "").trim();
  if (s === "胜") return "W";
  if (s === "负") return "L";
  return "";
}

function normalizeScore(score) {
  return String(score || "").replace(/\s+/g, "");
}

function keyFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, "_");
}

function matchSig(m) {
  return [
    String(m.date || ""),
    String(m.event || ""),
    String(m.opponent || ""),
    String(m.score || ""),
    String(m.result || ""),
    String(m.subEvent || ""),
  ].join("|");
}

function pickChinaWomenExcel() {
  const candidates = fs
    .readdirSync(DATA_DIR)
    .filter((n) => n.toLowerCase().endsWith(".xlsx"))
    .map((name) => ({
      name,
      fullPath: path.join(DATA_DIR, name),
      mtimeMs: fs.statSync(path.join(DATA_DIR, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!candidates.length) {
    throw new Error("No xlsx file found in server/data");
  }
  // Your newly added file is currently the latest xlsx in server/data.
  return candidates[0];
}

function main() {
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    throw new Error(`Missing local db file: ${LOCAL_DB_FILE}`);
  }

  const excel = pickChinaWomenExcel();
  const wb = xlsx.readFile(excel.fullPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

  const db = parseJsonSafe(fs.readFileSync(LOCAL_DB_FILE, "utf-8"));
  let createdPlayers = 0;
  let addedMatches = 0;

  for (const r of rows) {
    const name = String(r["人名"] || "").trim();
    if (!name) continue;
    const playerId = keyFromName(name);

    if (!db[playerId]) {
      db[playerId] = {
        name,
        country: "CHN",
        ranking: 999,
        style: "",
        points: "",
        matches: [],
      };
      createdPlayers += 1;
    }

    if (!Array.isArray(db[playerId].matches)) {
      db[playerId].matches = [];
    }

    const item = {
      date: normalizeDate(r["日期"]),
      event: String(r["赛事名"] || "").trim(),
      round: "",
      opponent: String(r["对手名"] || "").trim(),
      opponentId: keyFromName(r["对手名"]),
      score: normalizeScore(r["比赛结果"]),
      result: normalizeResult(r["胜负"]),
      subEvent: "WS",
    };

    const existing = new Set(db[playerId].matches.map(matchSig));
    const sig = matchSig(item);
    if (!existing.has(sig)) {
      db[playerId].matches.push(item);
      addedMatches += 1;
    }
  }

  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  console.log(
    JSON.stringify(
      {
        excelFile: excel.name,
        rows: rows.length,
        createdPlayers,
        addedMatches,
      },
      null,
      2
    )
  );
}

main();
