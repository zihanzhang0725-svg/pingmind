import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pickDataDir() {
  const candidates = [
    path.join(__dirname, "..", "data"),
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "server", "data"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(__dirname, "..", "data");
}

const DATA_DIR = pickDataDir();
const MATCH_FILE = path.join(DATA_DIR, "player_matches_local.json");
const PLAYER_FILE = path.join(DATA_DIR, "players.json");
const OUT_FILE = path.join(DATA_DIR, "player_dominance_metrics.json");

function parseJsonSafe(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  return JSON.parse(text || "{}");
}

function safeDiv(a, b, fallback = 0) {
  return b > 0 ? a / b : fallback;
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function round2(v) {
  return Number(v.toFixed(2));
}

function bayesRate(winW, totalW, priorRate = 0.6, priorStrength = 10) {
  const w = Number(winW);
  const t = Number(totalW);
  const p = Number(priorRate);
  const s = Number(priorStrength);
  const win = Number.isFinite(w) && w >= 0 ? w : 0;
  const tot = Number.isFinite(t) && t >= 0 ? t : 0;
  const pr = Number.isFinite(p) ? clamp(p, 0, 1) : 0.6;
  const st = Number.isFinite(s) && s >= 0 ? s : 10;
  return safeDiv(win + pr * st, tot + st, pr);
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseScore(score) {
  const s = String(score || "").trim();
  const m = s.match(/^(\d+):(\d+)$/);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]) };
}

function isDeciderScore(sc) {
  if (!sc) return false;
  const total = sc.a + sc.b;
  return (total === 5 || total === 7) && Math.abs(sc.a - sc.b) === 1;
}

function isDominantWin(result, sc) {
  if (result !== "W" || !sc) return false;
  return (sc.a === 3 || sc.a === 4) && sc.b <= 1;
}

function isFinalRound(round) {
  const r = String(round || "").trim().toLowerCase();
  if (!r) return false;
  if (r.includes("semi")) return false;
  if (r.includes("final")) return true;

  // Chinese labels
  if (r.includes("半决赛")) return false;
  if (r.includes("决赛")) return true;

  return false;
}

function getTechPressure(weightedWin, weightedTotal, dominantWinW) {
  const winRate = bayesRate(weightedWin, weightedTotal, 0.65, 10);
  const dominantWinRate = bayesRate(dominantWinW, weightedTotal, 0.22, 12);
  return clamp((0.7 * winRate + 0.3 * dominantWinRate) * 100);
}

function getStability(deciderWinW, deciderTotalW) {
  const mentalRate = bayesRate(deciderWinW, deciderTotalW, 0.55, 8);
  return clamp(mentalRate * 100);
}

function getForeignControl(foreignWin, foreignTotal, overallWinRate01, isChina) {
  // For CHN players: "外战" = vs non-CHN, prior uses their overall win rate.
  // For non-CHN players: "外战" = vs CHN, use a tougher prior so small samples don't inflate.
  const prior = isChina ? overallWinRate01 : 0.45;
  const wr = bayesRate(foreignWin, foreignTotal, prior, 12);
  return clamp(wr * 100);
}

function getEventPerformanceScore(highLevelWin, highLevelTotal, finalWinCount, finalTotalCount) {
  // Use conservative priors here: missing big-event samples should not inflate the score.
  const highLevelWinRate = clamp(bayesRate(highLevelWin, highLevelTotal, 0.6, 12) * 100);
  const finalStagePerformance = clamp(bayesRate(finalWinCount, finalTotalCount, 0.55, 8) * 100);
  return clamp(highLevelWinRate * 0.7 + finalStagePerformance * 0.3);
}

function amplifyDominanceScore(rawScore, gamma = 0.9) {
  const x = clamp(rawScore, 0, 100) / 100;
  return clamp(Math.pow(x, gamma) * 100);
}
function getEventWeight(event) {
    const e = String(event || "");
    if (e.includes("Olympic")) return 1.6;
    if (e.includes("World Championships")) return 1.5;
    if (e.includes("World Cup")) return 1.45;
    if (e.includes("WTT Finals")) return 1.35;
    if (e.includes("WTT Champions")) return 1.3;
    if (e.includes("WTT Star Contender")) return 1.15;
    return 1.0;
}
function getTimeWeight(dateStr, lambda = 0.04) {
    if (!dateStr) return 1.0;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 1.0;
    const now = new Date();
    const diffMonths =(now.getFullYear() - d.getFullYear()) * 12 +(now.getMonth() - d.getMonth());
    return Math.exp(-lambda * Math.max(0, diffMonths));
}
function getRankingStrength(ranking) {
    if (!ranking || ranking <= 0) return 55;

    if (ranking <= 3) return 100;
    if (ranking <= 5) return 95;
    if (ranking <= 10) return 90;
    if (ranking <= 20) return 82;
    if (ranking <= 50) return 70;
    return 60;
}
function getOpponentWeight(oppRanking) {
    if (!oppRanking || oppRanking <= 0) return 1.0;

    if (oppRanking <= 3) return 1.5;
    if (oppRanking <= 10) return 1.35;
    if (oppRanking <= 20) return 1.25;
    if (oppRanking <= 50) return 1.15;
    return 1.0;
}
function isHighLevelEvent(event) {
  const e = String(event || "");
  return (
    e.includes("Olympic") ||
    e.includes("World Championships") ||
    e.includes("World Cup") ||
    e.includes("WTT Finals") ||
    e.includes("WTT Champions") ||
    e.includes("WTT Star Contender") ||
    e.includes("China Smash")
  );
}

function getOlympicPlacementFactor(placement) {
  const p = Number(placement);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (p === 1) return 1.0;
  if (p === 2) return 0.85;
  if (p === 3) return 0.72;
  if (p === 4) return 0.62;
  if (p <= 8) return 0.42;
  if (p <= 16) return 0.22;
  return 0.1;
}

function buildOlympicImpactRaw(olympicHonors) {
  const oh = olympicHonors || {};
  let raw = 0;

  const gold = Number(oh.gold) || 0;
  const silver = Number(oh.silver) || 0;
  const bronze = Number(oh.bronze) || 0;

  raw += gold * 1.0 + silver * 0.75 + bronze * 0.6;

  const results = Array.isArray(oh.results) ? oh.results : [];
  for (const r of results) {
    raw += getOlympicPlacementFactor(r?.placement);
  }

  if (results.length === 0) {
    raw += getOlympicPlacementFactor(oh.bestPlacement);
  }

  return raw;
}

function normalizeMatchesDb(matchesDb) {
  const byName = {};
  for (const [k, v] of Object.entries(matchesDb || {})) {
    if (Array.isArray(v)) {
      byName[k] = v;
      continue;
    }
    const name = String(v?.name || "").trim();
    const arr = Array.isArray(v?.matches) ? v.matches : [];
    if (name) byName[name] = arr;
    else byName[k] = arr;
  }
  return byName;
}

function main() {
  if (!fs.existsSync(MATCH_FILE)) {
    console.error("Missing match file:", MATCH_FILE);
    process.exit(1);
  }
  if (!fs.existsSync(PLAYER_FILE)) {
    console.error("Missing players file:", PLAYER_FILE);
    process.exit(1);
  }

  const matchesDb = parseJsonSafe(fs.readFileSync(MATCH_FILE, "utf-8"));
  const players = parseJsonSafe(fs.readFileSync(PLAYER_FILE, "utf-8"));
  const matchesByPlayerName = normalizeMatchesDb(matchesDb);
  const matchesByNormPlayerName = {};
  for (const [playerName, arr] of Object.entries(matchesByPlayerName)) {
    const key = normName(playerName);
    if (!key) continue;
    if (!matchesByNormPlayerName[key]) {
      matchesByNormPlayerName[key] = arr;
    }
  }

  const playersByNormName = {};
  const playersByNormShortName = {};

  for (const p of players) {
    const nn = normName(p?.name);
    const sn = normName(p?.shortName);
    if (nn) playersByNormName[nn] = p;
    if (sn) playersByNormShortName[sn] = p;
  }

  const output = {};

  for (const p of players) {
    const name = p?.name;
    const matches =
      matchesByNormPlayerName[normName(name)] ||
      matchesByNormPlayerName[normName(p?.shortName)] ||
      [];

    let weightedWin = 0;
    let weightedTotal = 0;
    let dominantWinW = 0;

    let deciderTotalW = 0;
    let deciderWinW = 0;

    let foreignTotal = 0;
    let foreignWin = 0;

    let highLevelTotal = 0;
    let highLevelWin = 0;

    let finalWinWeight = 0;
    let finalTotalWeight = 0;
    // 🔥 新增：强敌胜场统计
    let strongOppTotal = 0;
    let strongOppWin = 0;
    for (const m of matches) {
      const eventW = getEventWeight(m.event);
      const timeW = getTimeWeight(m.date, 0.04);

      const oppNorm = normName(m?.opponent);
      const oppPlayer =playersByNormName[oppNorm] || playersByNormShortName[oppNorm] || null;
      let oppWeight = getOpponentWeight(oppPlayer?.ranking);
      // 中国内战降低权重
      if (p.country === "CHN" && oppPlayer?.country === "CHN") {
          oppWeight *= 0.8;
      }
      // 🔥 统计强敌比赛（TOP20）
      const matchW = eventW * timeW * oppWeight;
      if (oppPlayer && oppPlayer.ranking && oppPlayer.ranking <= 20) {
          strongOppTotal += matchW;
          if (m?.result === "W") strongOppWin += matchW;
      }
      weightedTotal += matchW;
      if (m?.result === "W") weightedWin += matchW;

      const sc = parseScore(m?.score);
      if (isDominantWin(m?.result, sc)) dominantWinW += matchW;

      if (isDeciderScore(sc)) {
        deciderTotalW += matchW;
        if (m?.result === "W") deciderWinW += matchW;
      }

      // 外战：对中国选手 = 对外协会；对外国选手 = 对中国（更贴近“外协威胁/对中能力”）
      if (oppPlayer && String(oppPlayer.country || "")) {
        const selfCountry = String(p?.country || "");
        const oppCountry = String(oppPlayer.country || "");
        const isChina = selfCountry === "CHN";
        const isForeignMatch = isChina ? oppCountry !== "CHN" : oppCountry === "CHN";
        if (isForeignMatch) {
          foreignTotal += matchW;
          if (m?.result === "W") foreignWin += matchW;
        }
      }

      if (isHighLevelEvent(m?.event)) {
        highLevelTotal += matchW;
        if (m?.result === "W") highLevelWin += matchW;
      }
      if (isFinalRound(m?.round)) {
        finalTotalWeight += matchW;
        if (m?.result === "W") finalWinWeight += matchW;
      }
    }

    const overallWinRate01 = bayesRate(weightedWin, weightedTotal, 0.6, 12);
    const isChina = String(p?.country || "") === "CHN";
    const techPressure = getTechPressure(weightedWin, weightedTotal, dominantWinW);
    const stability = getStability(deciderWinW, deciderTotalW);
    const foreignControl = getForeignControl(foreignWin, foreignTotal, overallWinRate01, isChina);
    const eventPerformanceScore = getEventPerformanceScore(
      highLevelWin,
      highLevelTotal,
      finalWinWeight,
      finalTotalWeight
    );
    const rankingStrength = getRankingStrength(p?.ranking);
    // 🔥 强敌胜率（击败TOP20能力）
    const strongOppRate = clamp(
      bayesRate(strongOppWin, strongOppTotal, 0.45, 8) * 100
    );
    const rawScore =
      techPressure * 0.18 +
      stability * 0.15 +
      foreignControl * 0.17 +
      eventPerformanceScore * 0.20 +
      rankingStrength * 0.20 +
      strongOppRate * 0.10;
    let chinaBoost = 0;

    if (p.country === "CHN") {
        chinaBoost = 4.5;
    }
    const dominanceScore = amplifyDominanceScore(rawScore + chinaBoost);
    output[name] = {
      metrics: {
        techPressure: round2(techPressure),
        stability: round2(stability),
        foreignControl: round2(foreignControl),
        eventPerformanceScore: round2(eventPerformanceScore),
        rankingStrength: round2(rankingStrength),
        strongOppRate: round2(strongOppRate),
      },
      dominanceScore: round2(dominanceScore),
    };
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log("Dominance model built:", OUT_FILE);
}

main();
