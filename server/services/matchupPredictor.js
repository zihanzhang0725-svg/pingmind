function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function toPercent(v) {
  const num = Number(v);
  if (!Number.isFinite(num)) return 0;
  if (num <= 1) return clamp(num * 100, 0, 100);
  return clamp(num, 0, 100);
}

export const SIM_EVENT_WEIGHTS = {
  olympics: { label: "奥运会", mentalFactor: 1.25, expFactor: 1.25 },
  worlds: { label: "世锦赛", mentalFactor: 1.25, expFactor: 1.25 },
  worldCup: { label: "世界杯/总决赛", mentalFactor: 1.1, expFactor: 1.15 },
  wtt: { label: "WTT常规赛", mentalFactor: 1, expFactor: 1 },
  feeder: { label: "支线赛", mentalFactor: 0.9, expFactor: 0.85 },
};
// 🔥风格克制矩阵
const STYLE_MATRIX = {
  "Shake attack": {
    "Penhold attack": 2,
    "Chopper": -3,
    "Blocker": 1,
    "Shake attack": 0,
    "neutral": 0,
  },
  "Penhold attack": {
    "Shake attack": -1,
    "Chopper": 2,
    "Blocker": 1,
    "neutral": 0,
  },
  "Chopper": {
    "Shake attack": 3,
    "Penhold attack": -2,
    "neutral": 0,
  },
  "Blocker": {
    "Shake attack": -1,
    "neutral": 0,
  },
  "neutral": {}
};

// ✅ 升级1：非线性放大（差距越大越放大，小差距基本不变）
function amplify(x, power = 1.05) {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  return sign * Math.pow(ax, power);
}

// ✅ 用于BO5分局概率
function bo5ScorelineProbs(pGame) {
  const p = clamp(pGame, 0.01, 0.99);
  const q = 1 - p;

  // 中国赢的比分分布
  const w30 = Math.pow(p, 3);
  const w31 = 3 * Math.pow(p, 3) * q;
  const w32 = 6 * Math.pow(p, 3) * Math.pow(q, 2);

  // 中国输的比分分布
  const l03 = Math.pow(q, 3);
  const l13 = 3 * Math.pow(q, 3) * p;
  const l23 = 6 * Math.pow(q, 3) * Math.pow(p, 2);

  return {
    china: { "3-0": w30, "3-1": w31, "3-2": w32 },
    foreign: { "0-3": l03, "1-3": l13, "2-3": l23 },
  };
}

function normalizeForeignProfile(raw = {}) {
  // If foreign side uses dominance metrics (ability model), convert to the same normalized shape.
  // This keeps the simulator comparing "ability vs ability" (foreign vs CHN).
  if (!("threatScore" in raw) && ("dominanceScore" in raw || raw?.metrics?.techPressure !== undefined)) {
    const m = raw.metrics || {};
    const stability = toPercent(m.stability || 0) / 100;
    const foreignControl = toPercent(m.foreignControl || 0) / 100;
    const eventPerformanceScore = toPercent(m.eventPerformanceScore || m.highLevelPerformance || 0) / 100;

    return {
      strength: toPercent(raw.dominanceScore || 0), // 0~100
      winRate: stability,
      weightedWinRate: clamp(stability * 0.6 + foreignControl * 0.4, 0, 1),
      closeWinRate: clamp(m.closeWinRate ?? stability * 0.85, 0, 1),
      mental: clamp(toPercent(m.mental || stability*0.7) / 100, 0, 1),
      experience: eventPerformanceScore,
      chinaImpact: foreignControl,
      style: raw.styleTag || raw.playstyleCN || "neutral",
    };
  }

  const weightedMatches = Number(raw.weightedMatches || 0);
  const weightedWins = Number(raw.weightedWins || 0);
  const weightedWinRate =
    weightedMatches > 0 ? weightedWins / weightedMatches : Number(raw.winRate || 0);

  return {
    strength: toPercent(raw.threatScore || 0), // 0~100
    winRate: clamp(Number(raw.winRate || 0), 0, 1), // 0~1
    weightedWinRate: clamp(weightedWinRate, 0, 1),
    closeWinRate: clamp(raw.closeWinRate ?? raw.winRate ?? 0.5, 0, 1),
    mental: clamp(toPercent(raw.metrics?.mental || 0) / 100, 0, 1),
    experience: clamp(toPercent(raw.metrics?.experience || 0) / 100, 0, 1),
    chinaImpact: clamp(toPercent(raw.metrics?.chinaImpact || 0) / 100, 0, 1),
    style: raw.styleTag || raw.playstyleCN || "neutral",
  };
}

function normalizeChinaProfile(raw = {}) {
  const m = raw.metrics || {};
  const stability = toPercent(m.stability || 0) / 100;
  const foreignControl = toPercent(m.foreignControl || 0) / 100;
  const eventPerformanceScore = toPercent(m.eventPerformanceScore || 0) / 100;

  return {
    strength: toPercent(raw.dominanceScore || 0), // 0~100
    winRate: stability,
    weightedWinRate: clamp(stability * 0.6 + foreignControl * 0.4, 0, 1),
    closeWinRate: clamp(m.closeWinRate ?? stability * 0.85, 0, 1),
    mental: clamp(toPercent(m.mental || stability*0.7) / 100, 0, 1),
    experience: eventPerformanceScore,
    chinaImpact: foreignControl,
    style: raw.styleTag || raw.playstyleCN || "neutral",
  };
}

// ✅ 升级版：非线性 + 阈值触发 + BO5分局预测
export function simulateMatchup({ foreignRaw, chinaRaw, eventKey }) {
  const opp = normalizeForeignProfile(foreignRaw);
  const us = normalizeChinaProfile(chinaRaw);

  const event = SIM_EVENT_WEIGHTS[eventKey] || SIM_EVENT_WEIGHTS.wtt;

  // =========================
  // 🎯 动态权重结构（核心升级）
  // =========================

  let strengthWeight = 0.35;
  let winRateWeight = 0.20;
  let closeWeight = 0.15;
  let mentalWeight = 0.10;
  let expWeight = 0.10;
  let chinaWeight = 0.10;

  if (eventKey === "olympics") {
    strengthWeight = 0.12;
    mentalWeight = 0.30;
    expWeight = 0.22;
  }

  if (eventKey === "worlds") {
    strengthWeight = 0.20;
    mentalWeight = 0.22;
    expWeight = 0.15;
  }

  if (eventKey === "wtt") {
    strengthWeight = 0.28;
    mentalWeight = 0.10;
    expWeight = 0.05;
  }

  if (eventKey === "feeder") {
    strengthWeight = 0.30;
    mentalWeight = 0.08;
    expWeight = 0.05;
  }
  const totalWeight =
    strengthWeight +
    winRateWeight +
    closeWeight +
    mentalWeight +
    expWeight +
    chinaWeight;
  strengthWeight /= totalWeight;
  winRateWeight /= totalWeight;
  closeWeight /= totalWeight;
  mentalWeight /= totalWeight;
  expWeight /= totalWeight;
  chinaWeight /= totalWeight;
  // =========================
  // 原始差值
  // =========================

  const threatDiffRaw =Math.tanh((us.strength - opp.strength) / 20) * 12;
  const winRateDiffRaw = (us.winRate - opp.winRate) * 100;
  const closeWinDiffRaw = (us.closeWinRate - opp.closeWinRate) * 100;
  const mentalDiffRaw = (us.mental - opp.mental) * 100;
  const experienceDiffRaw = (us.experience - opp.experience) * 100;
  const chinaDiffRaw = (us.chinaImpact - opp.chinaImpact) * 100;

  // =========================
  // 非线性放大
  // =========================

  const threatDiff = threatDiffRaw;
  const winRateDiff = amplify(winRateDiffRaw, 1.05);
  const closeWinDiff = amplify(closeWinDiffRaw, 1.08);
  const mentalDiff = amplify(mentalDiffRaw, 1.08);
  const experienceDiff = amplify(experienceDiffRaw, 1.05);
  const chinaDiff = amplify(chinaDiffRaw, 1.06);

  // =========================
  // 动态贡献计算
  // =========================

  const contributions = [
    { key: "strength", label: "基础强度", value: strengthWeight * threatDiff, raw: threatDiffRaw },
    { key: "winRate", label: "胜率稳定性", value: winRateWeight * winRateDiff, raw: winRateDiffRaw },
    { key: "closeWin", label: "关键局能力", value: closeWeight * closeWinDiff, raw: closeWinDiffRaw },
    { key: "mental", label: "心理抗压", value: mentalWeight * mentalDiff, raw: mentalDiffRaw },
    { key: "experience", label: "大赛经验", value: expWeight * experienceDiff, raw: experienceDiffRaw },
    { key: "chinaImpact", label: "对华克制/外战控制", value: chinaWeight * chinaDiff, raw: chinaDiffRaw },
  ];

  // =========================
  // 连续型阈值规则
  // =========================

  const adjustments = [];

  const closeGap = opp.closeWinRate - us.closeWinRate;
  if (closeGap > 0.08) {
    adjustments.push({
      key: "closeRisk",
      label: "关键局能力差距惩罚",
      value: -closeGap * 6,
      reason: "关键局能力差距较大。"
    });
  }

  if (opp.chinaImpact >= 0.75 && us.chinaImpact <= 0.7) {
    adjustments.push({
      key: "chinaImpactRisk",
      label: "对华克制惩罚",
      value: -3,
      reason: "对手外战克制能力较强。"
    });
  }

  if (us.strength > opp.strength) {
    const gap = us.strength - opp.strength;
    const bonus = Math.min(gap / 6, 3); // 最大不超过3分
    adjustments.push({
      key: "dominanceBonus",
      label: "优势强度加成",
      value: bonus,
      reason: "基础强度优势连续型加成。"
    });
  }

  const baseScore = contributions.reduce((sum, it) => sum + it.value, 0);
  const adjScore = adjustments.reduce((sum, it) => sum + it.value, 0);

 
 // =========================
// 🔥 博弈相性层（Game Theory Layer）
// =========================

// 关键局博弈偏置
  const clutchBias =
    (us.closeWinRate - opp.closeWinRate) *
    (1 - Math.abs(us.closeWinRate - 0.5)) *
    12;

  // 外战克制博弈
  const styleClash =
    (us.chinaImpact - opp.chinaImpact) *
    (1 - opp.chinaImpact) *
    10;

  // 心理对抗博弈
  const mentalBattle =
    (us.mental - opp.mental) *
    (0.5 + us.experience) *
    8;

  // 🔥 风格克制博弈（必须先算）
  let styleScore = 0;
  if (us.style && opp.style) {
    styleScore =
      (STYLE_MATRIX[us.style]?.[opp.style] || 0) * 0.8;
  }

  // 综合博弈分
  const gameTheoryScore =
    (clutchBias +
    styleClash +
    mentalBattle +
    styleScore)*0.6;

  // 最终对阵分
  const matchScore =
    (baseScore +
    adjScore +
    gameTheoryScore)*0.9;
  // =========================
  // 胜率计算（更合理梯度）
  // =========================
  const balancedScore = matchScore * 0.85;
  const chinaWinProb = 1 / (1 + Math.exp(-balancedScore / 12));
  const chinaWinPct = clamp(chinaWinProb * 100, 0, 100);
  const foreignWinPct = 100 - chinaWinPct;

  // =========================
  // BO5 概率
  // =========================

  const closeDelta = us.closeWinRate - opp.closeWinRate;
  const pGame = clamp(
    0.5 + (chinaWinProb - 0.5) * 0.85 + closeDelta * 0.05,
    0.25,
    0.75
  );

  const scoreline = bo5ScorelineProbs(pGame);

  const biggestRisks = [
    ...contributions.map((x) => ({ ...x, kind: "contrib" })),
    ...adjustments.map((x) => ({ ...x, kind: "rule", raw: null })),
  ]
    .sort((a, b) => a.value - b.value)
    .slice(0, 4)
    .filter((it) => it.value < 0);

  return {
    event,
    matchScore,
    baseScore,
    adjScore,
    chinaWinPct,
    foreignWinPct,
    contributions,
    adjustments,
    biggestRisks,
    pGame,
    scoreline,
  };
}

export function recommendLineup({ foreignRaw, chinaPool = [], eventKey, topN = 10 }) {
  const results = [];
  for (const item of chinaPool) {
    const chinaRaw = item?.raw || item?.chinaRaw || {};
    const name = item?.name || "Unknown";
    const sim = simulateMatchup({ foreignRaw, chinaRaw, eventKey });
    results.push({
      name,
      chinaWinPct: Number(sim.chinaWinPct || 0),
      foreignWinPct: Number(sim.foreignWinPct || 0),
      matchScore: Number(sim.matchScore || 0),
      baseScore: Number(sim.baseScore || 0),
      adjScore: Number(sim.adjScore || 0),
      riskCount: Array.isArray(sim.biggestRisks) ? sim.biggestRisks.length : 0,
      pGame: Number(sim.pGame || 0),
    });
  }

  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return b.chinaWinPct - a.chinaWinPct;
  });

  const limit = Math.max(1, Number(topN) || 10);
  return {
    total: results.length,
    rankings: results.slice(0, limit),
  };
}
export function recommendLineupAdvanced({ foreignRaw, chinaPool = [], eventKey }) {
  const event = SIM_EVENT_WEIGHTS[eventKey] || SIM_EVENT_WEIGHTS.wtt;
  const results = [];
  const opp = normalizeForeignProfile(foreignRaw);

  for (const item of chinaPool) {
    const chinaRaw = item?.raw || item?.chinaRaw || item || {};
    const name = item?.name || chinaRaw?.name || "Unknown";

    const sim = simulateMatchup({
      foreignRaw,
      chinaRaw,
      eventKey,
    });

    const us = normalizeChinaProfile(chinaRaw);
    const riskCount = Array.isArray(sim?.biggestRisks) ? sim.biggestRisks.length : 0;

    const volatilityPenalty =
      Math.abs(us.closeWinRate - 0.5) * 6;

    const decisionIndex =
      sim.matchScore
      - riskCount * 1.2
      - volatilityPenalty
      + sim.chinaWinPct * 0.15;

    results.push({
      name,
      winPct: Number(sim?.chinaWinPct || 0),
      decisionIndex,
      riskCount,
      matchScore: Number(sim?.matchScore || 0),
    });
  }

  results.sort((a, b) => b.decisionIndex - a.decisionIndex);
  return results;
}
