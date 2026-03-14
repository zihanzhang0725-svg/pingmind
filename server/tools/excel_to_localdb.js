import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

// 读取本地json文件路径
const LOCAL_DB_FILE = path.join(process.cwd(), "data", "player_matches_local.json");

const ROOT = process.cwd();
const EXCEL_MEN = path.join(ROOT, "data", "男单所有选手赛果汇总.xlsx");
const EXCEL_WOMEN = path.join(ROOT, "data", "女单所有选手赛果汇总.xlsx");
const EXCEL_CHINA_MEN = path.join(ROOT, "data", "中国男单选手赛果汇总.xlsx");
function normalizeResult(winlose) {
  const s = String(winlose || "").trim();
  if (s === "胜") return "W";
  if (s === "负") return "L";
  return "";
}

function normalizeScore(score) {
  return String(score || "").replace(/\s+/g, "").replace(":", ":").replace("：", ":");
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

// 生成唯一的选手ID
function generatePlayerId(name) {
  return name.toLowerCase().replace(/\s+/g, '_');
}

function loadExistingDb() {
  if (!fs.existsSync(LOCAL_DB_FILE)) return {};
  const raw = fs.readFileSync(LOCAL_DB_FILE, "utf-8");
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    console.error("Failed to parse existing JSON:", error);
    return {};
  }
}

function saveToLocalDb(db) {
  fs.mkdirSync(path.dirname(LOCAL_DB_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  console.log("✅ Updated local player matches data.");
}

function processExcelData(excelPath) {
  const wb = xlsx.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });

  const db = loadExistingDb();

  for (const r of rows) {
    const name = String(r["人名"] || "").trim();
    if (!name) continue;

    const playerId = generatePlayerId(name); // 生成ID

    if (!db[playerId]) db[playerId] = {
      name: name,
      country: r["国家"] === "中国" ? "CHN" : r["国家"],
      ranking: r["世界排名"],
      style: r["打法"],
      points: r["积分"],
      matches: [] // 新增matches数组
    };

    const opponentName = String(r["对手名"] || "").trim();
    const opponentId = generatePlayerId(opponentName); // 生成对手ID

    const item = {
      date: normalizeDate(r["日期"]),
      event: String(r["赛事名"] || "").trim(),
      round: "", // Excel does not have round info
      opponent: opponentName,
      opponentId: opponentId, // 保存对手ID
      score: normalizeScore(r["比赛结果"]),
      result: normalizeResult(r["胜负"]),
      subEvent: "MS", // Assume Men's Singles unless updated
    };

    db[playerId].matches.push(item);
  }

  saveToLocalDb(db);
}

function main() {
  if (fs.existsSync(EXCEL_MEN)) {
    console.log("✅ Processing men's data...");
    processExcelData(EXCEL_MEN);
  } else {
    console.log("❌ Men's Excel file not found.");
  }
  if (fs.existsSync(EXCEL_CHINA_MEN)) {
    console.log("🇨🇳 Processing China men's data...");
    processExcelData(EXCEL_CHINA_MEN);
  } else {
    console.log("❌ China men's Excel file not found.");
  }
  if (fs.existsSync(EXCEL_WOMEN)) {
    console.log("✅ Processing women's data...");
    processExcelData(EXCEL_WOMEN);
  } else {
    console.log("❌ Women's Excel file not found.");
  }
}

main();