// buildThreatMetrics.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pickDataDir() {
  const candidates = [
    path.join(__dirname, "..", "data"), // server/data (preferred)
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
const OUT_FILE = path.join(DATA_DIR, "player_threat_metrics.json");

function parseJsonSafe(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  return JSON.parse(text || "{}");
}

// =======================
// 1) 鏉冮噸涓庡伐鍏峰嚱鏁?
// =======================

// 璧涗簨鏉冮噸锛氭洿璐磋繎浣犳渶鍒濈殑鍒嗗眰锛屽悓鏃剁暀鍑哄脊鎬?
function getEventWeight(event) {
  const e = String(event || "");

  // 浣犲彲浠ユ寜浣犱滑搴撻噷鐨勮禌浜嬪懡鍚嶇户缁ˉ鍏呭叧閿瓧
  if (e.includes("Olympic")) return 1.6;
  if (e.includes("World Championships")) return 1.5;

  if (e.includes("WTT Champions")) return 1.30;
  if (e.includes("WTT Star Contender")) return 1.15;
  if (e.includes("WTT Contender")) return 1.00;

  // 鍏朵粬鍏紑璧?鍦板尯璧?
  return 0.90;
}

// 鏄惁楂樼瓑绾ц禌浜嬶紙鐢ㄤ簬 speed / experience锛?
function isHighLevelEvent(event) {
  const e = String(event || "");
  return (
    e.includes("Olympic") ||
    e.includes("World Championships") ||
    e.includes("WTT Champions") ||
    e.includes("WTT Star Contender")
  );
}

// 瀵规墜寮哄害锛氭敹鏁涘埌 <= 1.30锛岄伩鍏嶇垎鐐稿姞鏉?
function getOpponentWeight(opponentName, playersRanking) {
  const ranking = playersRanking[opponentName];
  if (!ranking || typeof ranking !== "number") return 1.0;

  if (ranking <= 5) return 1.30;
  if (ranking <= 10) return 1.20;
  if (ranking <= 20) return 1.10;
  if (ranking <= 50) return 1.05;
  return 1.00;
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getChinaWinRankBoost(ranking) {
  if (!ranking || typeof ranking !== "number") return 1.10;
  if (ranking <= 5) return 1.60;
  if (ranking <= 10) return 1.45;
  if (ranking <= 20) return 1.30;
  if (ranking <= 50) return 1.15;
  return 1.05;
}

function getOlympicPlacementFactor(placement) {
  const p = Number(placement);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (p === 1) return 1.00;
  if (p === 2) return 0.90;
  if (p === 3) return 0.82;
  if (p === 4) return 0.74;
  if (p <= 8) return 0.55;
  if (p <= 16) return 0.35;
  return 0.20;
}

function getOlympicYearDecay(year, lambda = 0.22) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900) return 0.65;
  const nowYear = new Date().getFullYear();
  const diff = Math.max(0, nowYear - y);
  return Math.exp(-lambda * diff);
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

// 瑙ｆ瀽褰㈠ "3:2" 鐨勫眬鍒?
function parseScore(score) {
  const s = String(score || "").trim();
  const m = s.match(/^(\d+):(\d+)$/);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]) };
}

// 鏃堕棿琛板噺锛歞ateStr 蹇呴』鑳借 Date() 姝ｅ父瑙ｆ瀽
// 位 寤鸿 0.03~0.06锛涗綘鍙湪鍓嶇鍋氬彲璋冨弬鏁?
function getTimeWeight(dateStr, lambda = 0.04) {
  if (!dateStr) return 1.0;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 1.0; // 瑙ｆ瀽澶辫触灏变笉琛板噺锛堥伩鍏嶅叏鍙?0锛?

  const now = new Date();
  const diffMonths =
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());

  // 鏈潵鏃ユ湡淇濇姢
  const m = Math.max(0, diffMonths);

  return Math.exp(-lambda * m);
}
// 瀵瑰崕鎺掑悕鏄犲皠锛堜笓鍒╃増锛氬嚱鏁版棌锛?
// f(r) = k / (ln(r + a))^b
function chinaRankMap(ranking, k = 12, a = 1, b = 1, r0 = 50) {
  const r = Number(ranking);
  const rr = (Number.isFinite(r) && r > 0) ? r : r0;
  return k / Math.pow(Math.log(rr + a), b);
}

// 鏍锋湰绋冲畾鍥犲瓙锛堜笓鍒╃増锛?
// S = 1 - exp(-n/tau)
function sampleStability(n, tau = 6) {
  const nn = Math.max(0, Number(n) || 0);
  return 1 - Math.exp(-nn / tau);
}
function getLossCompetitiveness(score) {
  const sc = parseScore(score);
  if (!sc) return 0.6;
  const totalGames = sc.a + sc.b;
  const diff = Math.abs(sc.a - sc.b);
  if ((totalGames === 5 || totalGames === 7) && diff === 1) return 1.0;
  if (diff === 2) return 0.85;
  if (diff === 3) return 0.7;
  return 0.6;
}
// 瀹夊叏闄ゆ硶
function safeDiv(a, b, fallback = 0) {
  return b > 0 ? a / b : fallback;
}

// min-max 褰掍竴鍖栧埌 0~100
function minMax100(value, min, max) {
  if (max <= min) return 50; // 鍏ㄤ竴鏍峰氨缁欎腑闂村€?
  return 100 * ((value - min) / (max - min));
}

// =======================
// 2) 涓绘祦绋?
// =======================
function main() {
  if (!fs.existsSync(MATCH_FILE)) {
    console.error("鉂?鎵句笉鍒版瘮璧涙枃浠?", MATCH_FILE);
    process.exit(1);
  }
  if (!fs.existsSync(PLAYER_FILE)) {
    console.error("鉂?鎵句笉鍒伴€夋墜鏂囦欢:", PLAYER_FILE);
    process.exit(1);
  }

  const matchesDb = parseJsonSafe(fs.readFileSync(MATCH_FILE, "utf-8"));
  const players = parseJsonSafe(fs.readFileSync(PLAYER_FILE, "utf-8"));

  // 鏋勫缓锛氶€夋墜鍚?-> ranking
  const playersRanking = {};
  const playersByNormName = {};
  const playersByNormShortName = {};
  for (const p of players) {
    if (p?.name) playersRanking[p.name] = p.ranking;
    const nameNorm = normName(p?.name);
    const shortNorm = normName(p?.shortName);
    if (nameNorm) playersByNormName[nameNorm] = p;
    if (shortNorm) playersByNormShortName[shortNorm] = p;
  }

  // 鍏煎涓ょ缁撴瀯锛?
  // A) { "Player Name": [matches...] }
  // B) { "player_id": { name, matches: [...] } }
  const matchesByPlayerName = {};
  for (const [k, v] of Object.entries(matchesDb || {})) {
    if (Array.isArray(v)) {
      matchesByPlayerName[k] = v;
      continue;
    }
    const name = String(v?.name || "").trim();
    const arr = Array.isArray(v?.matches) ? v.matches : [];
    if (name) {
      matchesByPlayerName[name] = arr;
    } else {
      matchesByPlayerName[k] = arr;
    }
  }

  // 鍏堟妸姣忎釜浜虹殑 raw 缁熻绠楀嚭鏉ワ紝experience 鍏堝瓨 raw锛屽悗闈㈠啀褰掍竴鍖?
  const result = {};

  for (const p of players) {
    const name = p.name;
    const matches = matchesByPlayerName[name] || [];

    // 鍔犳潈鎬婚噺 & 鑳滃満
    let weightedWin = 0;
    let weightedTotal = 0;

    // 缁撴瀯鍨嬬粺璁★紙鍔犳潈锛?
    let dominantWinW = 0;     // 3:0 / 3:1 鑳?
    let closeTotalW = 0;      // 3:2 or 2:3锛堣兌鐫€灞€锛夋€婚噺
    let closeWinW = 0;        // 鑳剁潃灞€鑳?

    // 鍐宠儨灞€锛堢敤浜?mental 骞虫粦锛?
    let deciderTotalW = 0;    // 3:2 or 2:3
    let deciderWinW = 0;

    // 楂樼瓑绾ц禌浜嬪崰姣旓紙鍔犳潈锛?
    let highLevelTotalW = 0;
    let chinaImpactRaw = 0;
    let chinaLossImpactRaw = 0;
    let olympicImpactRaw = 0;
    let chinaMatchCount = 0;
    let chinaWinCount = 0;
    let chinaLossCount = 0;

    const olympic = p?.olympicHonors || {};
    const olympicResults = Array.isArray(olympic.results) ? olympic.results : [];
    if (olympicResults.length > 0) {
      for (const r of olympicResults) {
        const placementFactor = getOlympicPlacementFactor(r?.placement);
        if (placementFactor <= 0) continue;
        const yearDecay = getOlympicYearDecay(r?.year, 0.22);
        olympicImpactRaw += placementFactor * yearDecay;
      }
    } else {
      const placementFactor = getOlympicPlacementFactor(olympic.bestPlacement);
      if (placementFactor > 0) {
        olympicImpactRaw += placementFactor * 0.65;
      }
    }

    // 涓轰簡 debug/瑙ｉ噴
    let parsedCount = 0;

    for (const m of matches) {
      const eventW = getEventWeight(m.event);
      const oppW = getOpponentWeight(m.opponent, playersRanking);
      const timeW = getTimeWeight(m.date, 0.04);

      const matchW = eventW * oppW * timeW;

      weightedTotal += matchW;
      if (m.result === "W") weightedWin += matchW;

      if (isHighLevelEvent(m.event)) {
        highLevelTotalW += matchW;
      }

      // 瀵瑰崕濞佽儊澧炲己锛氭垬鑳滀腑鍥介€夋墜涓斿鎵嬫帓鍚嶈秺楂橈紝璐＄尞瓒婂ぇ
      // 鉁?鏂扮増 ChinaImpact锛堝鏁板闀?+ 鍔犲垎鍒讹級
      // 鉁?涓撳埄鐗?ChinaImpact锛氬畾鍚戠洰鏍囩瓫閫?+ 鎺掑悕鏄犲皠鍑芥暟鏃?+ 鏃堕棿琛板噺 + 璧涗簨澧炲己
      const oppNorm = normName(m.opponent);
      const oppPlayer =
        playersByNormName[oppNorm] ||
        playersByNormShortName[oppNorm] ||
        null;

      if (oppPlayer?.country === "CHN") {
        chinaMatchCount += 1;
        if (m.result === "W") chinaWinCount += 1;
        if (m.result === "L") chinaLossCount += 1;

        if (m.result === "W") {
          const ranking = Number(oppPlayer.ranking) || 50;
          const eW = getEventWeight(m.event);
          const highBoost = isHighLevelEvent(m.event) ? 1.15 : 1.0;
          const rankFactor = chinaRankMap(ranking, 12, 1, 1);
          chinaImpactRaw += rankFactor * eW * highBoost * timeW;
        }

        if (m.result === "L") {
          const ranking = Number(oppPlayer.ranking) || 50;
          const eW = getEventWeight(m.event);
          const highBoost = isHighLevelEvent(m.event) ? 1.1 : 1.0;
          const rankFactor = chinaRankMap(ranking, 12, 1, 1);
          const competitiveness = getLossCompetitiveness(m.score);
          const eliteBoost = ranking <= 8 ? 1.15 : ranking <= 16 ? 1.05 : 1.0;
          const lossCoef = 0.22;
          const lossImpact =
            rankFactor * eW * highBoost * timeW * competitiveness * eliteBoost * lossCoef;
          chinaLossImpactRaw += lossImpact;
          chinaImpactRaw += lossImpact;
        }
      }
      const sc = parseScore(m.score);
      if (!sc) continue;
      parsedCount += 1;

      // dominant win: 3:0 / 4:0 绾í鎵?
      if (
        m.result === "W" &&
        (
          (sc.a === 3 && sc.b === 0) ||
          (sc.a === 4 && sc.b === 0)
        )
      ) {
        dominantWinW += matchW;
      }
      // close match锛氫换鎰忓眬鍒讹紝鍙樊1灞€
      // close match锛氬繀椤绘墦鍒版渶鍚庝竴灞€锛圔O5=5灞€锛孊O7=7灞€锛?
      const totalGames = sc.a + sc.b;
      const isClose = (totalGames === 5) || (totalGames === 7); // 3:2/2:3/4:3/3:4

      if (isClose) {
        closeTotalW += matchW;
        deciderTotalW += matchW;

        if (m.result === "W") {
          closeWinW += matchW;
          deciderWinW += matchW;
        }
      }
    }

    // 鍩虹鐜?
    const winRate = safeDiv(weightedWin, weightedTotal, 0);

    const dominantWinRate = safeDiv(dominantWinW, weightedWin, 0);
    const closeRatio = safeDiv(closeTotalW, weightedTotal, 0);
    const closeWinRate = safeDiv(closeWinW, closeTotalW, 0);

    const intensityRatio = safeDiv(highLevelTotalW, weightedTotal, 0);

    // ================
    // 浜旂淮璁＄畻锛圴4锛?
    // ================

    // technique锛氳儨鐜囦负涓伙紙鍙В閲婏級
    const technique = clamp(winRate * 100);

    // mental锛氬喅鑳滃眬鑳滅巼 + 璐濆彾鏂钩婊戯紙闃叉灏忔牱鏈瀬绔級
    // 杩欓噷鐢ㄢ€滅瓑浠峰姞2鑳?鍔?鍦衡€濈殑鍏堥獙锛屽垵濮?50%
    const olympicImpact = clamp(
      100 * (1 - Math.exp(-1.15 * olympicImpactRaw))
    );
    const mentalRate =
      deciderTotalW > 0 ? (deciderWinW + 2) / (deciderTotalW + 4) : 0.5;

    // 濂ヨ繍浣滀负蹇冪悊鍏戠幇鑳藉姏澧炲己椤癸紙鏈€澶ф彁鍗囩害 6%锛?
    const mentalBoost = 1 + olympicImpact * 0.0006;

    const mental = clamp(mentalRate * 100 * mentalBoost);

    // tactics锛歞ominant + closeWin 鐨勭粨鏋勭粍鍚堬紙涓嶅啀璺?mental 閲嶅锛?
    // dominant 浣撶幇鎵ц鍘嬪埗锛沜loseWin 浣撶幇鍗氬紙鍏戠幇
    const tacticsRate =
      0.45 * dominantWinRate +
      0.35 * closeWinRate +
      0.20 * winRate;
    const tactics = clamp(tacticsRate * 100);

    // speed锛氳妭濂忓己搴?= 楂樼瓑绾ц禌浜嬪崰姣?+ 鑳剁潃灞€鍗犳瘮
    const speedRate = 0.5 * intensityRatio + 0.5 * closeRatio;
    const speed = clamp(speedRate * 140);

    // chinaImpact锛氬鍗庡▉鑳佷笓椤癸紙鎴樿儨涓浗 + 涓浗鎺掑悕绯绘暟)
    // 鉁?涓撳埄鐗堬細鎸囨暟楗卞拰 + 鍘嬬缉鎸囨暟纬 + 鏍锋湰绋冲畾鍥犲瓙S
    const M = 100;        // 涓婇檺
    const alpha = 0.35;   // 楗卞拰閫熷害锛堝彲璋冿級
    const gamma = 1.15;   // 鍘嬬缉鎸囨暟锛堝彲璋冿級
    const S = sampleStability(chinaMatchCount, 6); // tau=6 鍙皟

    const chinaImpactBase = M * Math.pow((1 - Math.exp(-alpha * chinaImpactRaw)), gamma);
    const chinaImpact = clamp(chinaImpactBase * S);

    // experience锛氬厛鐢?raw锛堝姞鏉冩€婚噺锛夊崰浣嶏紝鍚庨潰缁熶竴 min-max
    const experienceRaw = weightedTotal; // raw

    // 鍏堝啓鍏ワ紝experience 鍚庨潰浜屾澶勭悊
    result[name] = {
      totalMatches: matches.length,
      parsedMatches: parsedCount,
      weightedMatches: Number(weightedTotal.toFixed(4)),
      weightedWins: Number(weightedWin.toFixed(4)),
      winRate: Number(winRate.toFixed(4)),

      // debug锛氫腑闂寸巼
      dominantWinRate: Number(dominantWinRate.toFixed(4)),
      closeRatio: Number(closeRatio.toFixed(4)),
      closeWinRate: Number(closeWinRate.toFixed(4)),
      intensityRatio: Number(intensityRatio.toFixed(4)),

      china: {
        chinaMatchCount,
        chinaWinCount,
        chinaLossCount,
        chinaImpactRaw: Number(chinaImpactRaw.toFixed(6)),
        chinaLossImpactRaw: Number(chinaLossImpactRaw.toFixed(6)),
      },
      metrics: {
        speed,
        technique,
        tactics,
        mental,
        chinaImpact,
        experience: 0, // 鍏堝崰浣?
      },

      _raw: {
        experienceRaw: Number(experienceRaw.toFixed(6)),
      },
    };
  }

  // =======================
  // 3) experience min-max 褰掍竴鍖?
  // =======================
  const expList = Object.values(result).map((r) => r._raw.experienceRaw);
  const minExp = Math.min(...expList);
  const maxExp = Math.max(...expList);

  for (const name of Object.keys(result)) {
    const raw = result[name]._raw.experienceRaw;
    const expNorm = clamp(minMax100(raw, minExp, maxExp));
    result[name].metrics.experience = Number(expNorm.toFixed(2));
  }

  // =======================
  // 4) threatScore锛圴4 鏉冮噸锛?
  // =======================
// 4) threatScore锛圴4 鏉冮噸 + 鎸囨暟鎷変几锛?
// =======================
for (const name of Object.keys(result)) {
  const m = result[name].metrics;

  const rawScore =
    m.technique * 0.22 +
    m.mental * 0.18 +
    m.tactics * 0.16 +
    m.experience * 0.15 +
    m.speed * 0.09 +
    m.chinaImpact * 0.12;

  // 馃敟 鎸囨暟鎷変几锛堣瑙変紭鍖栵紝涓嶅奖鍝嶆帓搴忥級
  const threatScore =
    100 * (1 - Math.exp(-0.025 * rawScore));

  result[name].threatScore = Number(threatScore.toFixed(2));

  delete result[name]._raw;
}

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), "utf-8");
  console.log("鉁?V4 濞佽儊妯″瀷鏋勫缓瀹屾垚 ->", OUT_FILE);
}

main();

