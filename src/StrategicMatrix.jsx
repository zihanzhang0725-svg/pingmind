import React, { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const CHN_COLOR = "#ef4444";
const FOREIGN_COLOR = "#3b82f6";

function toFixed1(v) {
  return Number(v || 0).toFixed(1);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normPercent(v) {
  if (!Number.isFinite(v)) return 0;
  if (v <= 1) return clamp(v * 100, 0, 100);
  return clamp(v, 0, 100);
}

function normNameKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableJitter(name, span = 2) {
  const s = String(name || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const unit = (h % 10001) / 10000; // [0,1]
  return (unit * 2 - 1) * span; // [-span, +span]
}

function minMaxNormalize(values) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max <= min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

function getForeignXRaw(v) {
  const weightedWinRateVsCHN = Number(v?.weightedWinRateVsCHN);
  if (Number.isFinite(weightedWinRateVsCHN)) return normPercent(weightedWinRateVsCHN);

  // Fallback: use the most CHN-oriented threat indicator from threat model.
  return normPercent(Number(v?.metrics?.chinaImpact || 0));
}

function scoreToDotSize(score) {
  // Smaller visual footprint while preserving score-based differences.
  return clamp(Number(score || 0) / 4.8, 3, 12);
}

function MatrixTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 shadow-xl">
      <div className="font-bold text-sm text-white mb-2">{d.name}</div>
      <div className="space-y-1">
        <div>类型：{d.type === "CHN" ? "中国队员" : "外国选手"}</div>
        <div>技术压制力：{toFixed1(d.techPressure)}</div>
        <div>稳定性：{toFixed1(d.stability)}</div>
        <div>外战控制：{toFixed1(d.foreignControl)}</div>
        <div>大赛表现：{toFixed1(d.eventPerformanceScore)}</div>
        <div>
          综合指数：{d.type === "CHN" ? toFixed1(d.dominanceScore) : toFixed1(d.threatScore)}
        </div>
      </div>
    </div>
  );
}

function MatrixDot(props) {
  const { cx, cy, fill, payload } = props;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={payload.dotSize || 6} fill={fill} fillOpacity={0.88} />;
}

function MatrixLabel(props) {
  const { x, y, value, payload } = props;
  if (!value) return null;

  const rank = Number(payload?.labelRank || 0);
  const type = payload?.type;
  const offsetMap =
    type === "CHN"
      ? [
          { dx: 0, dy: -14 },
          { dx: 10, dy: -4 },
          { dx: -10, dy: -4 },
        ]
      : [
          { dx: 0, dy: -14 },
          { dx: -10, dy: -4 },
          { dx: 10, dy: -4 },
        ];
  const o = offsetMap[Math.max(0, Math.min(2, rank - 1))] || { dx: 0, dy: -12 };

  // Near right edge: anchor to the left side to avoid clipping/overlap cluster at x~100+.
  const nearRightEdge = Number(payload?.xPlot || payload?.x || 0) >= 105;
  const finalX = Number(x || 0) + (nearRightEdge ? -8 : 8) + o.dx;
  const finalY = Number(y || 0) + o.dy;

  return (
    <text
      x={finalX}
      y={finalY}
      fill="#ffffff"
      fontSize={10}
      fontWeight={700}
      textAnchor={nearRightEdge ? "end" : "start"}
      pointerEvents="none"
    >
      {value}
    </text>
  );
}

export default function StrategicMatrix({
  dominanceMetrics = {},
  threatMetrics = {},
  nameZhMap = {},
  players = [],
}) {
  const [gender, setGender] = useState("Male");
  const genderMap = useMemo(() => {
    const map = new Map();
    (players || []).forEach((p) => {
      const g = p?.gender;
      if (!g) return;
      const keys = [p?.name, p?.nameEn, p?.shortName];
      keys.forEach((k) => {
        const nk = normNameKey(k);
        if (nk) map.set(nk, g);
      });
    });
    return map;
  }, [players]);

  const countryMap = useMemo(() => {
    const map = new Map();
    (players || []).forEach((p) => {
      const c = String(p?.country || "").trim();
      if (!c) return;
      const keys = [p?.name, p?.nameEn, p?.shortName];
      keys.forEach((k) => {
        const nk = normNameKey(k);
        if (nk) map.set(nk, c);
      });
    });
    return map;
  }, [players]);

  const chartData = useMemo(() => {
    const entries = Object.entries(dominanceMetrics || {});

    const chnRaw = entries
      .filter(([name]) => countryMap.get(normNameKey(name)) === "CHN")
      .map(([name, v]) => {
      const m = v?.metrics || {};
      const dominanceScore = Number(v?.dominanceScore || 0);
      const genderValue = genderMap.get(normNameKey(name)) || "Unknown";
      const eventPerformanceScore = Number(m.eventPerformanceScore ?? m.highLevelPerformance ?? 0);
      return {
        name: nameZhMap[name] || name,
        nameEn: name,
        type: "CHN",
        gender: genderValue,
        x: normPercent(Number(m.foreignControl || 0)),
        y: normPercent(eventPerformanceScore),
        techPressure: Number(m.techPressure || 0),
        stability: Number(m.stability || 0),
        foreignControl: Number(m.foreignControl || 0),
        eventPerformanceScore,
        dominanceScore,
        dotSize: scoreToDotSize(dominanceScore),
      };
    });
    const chnTop3 = [...chnRaw]
      .sort((a, b) => Number(b.dominanceScore || 0) - Number(a.dominanceScore || 0))
      .slice(0, 3)
      .map((d) => d.nameEn);
    const chnRankMap = new Map(chnTop3.map((name, i) => [name, i + 1]));
    const chn = chnRaw.map((d) => ({
      ...d,
      label: chnRankMap.has(d.nameEn) ? d.name : "",
      labelRank: chnRankMap.get(d.nameEn) || 0,
    }));

    // Foreign: use threat model only (avoid duplicates).
    const foreignCandidates = Object.entries(threatMetrics || {})
      .filter(([name, v]) => {
        if (Number(v?.threatScore || 0) <= 0) return false;
        const c = countryMap.get(normNameKey(name));
        if (c === "CHN") return false;
        const genderValue = genderMap.get(normNameKey(name)) || "Unknown";
        return genderValue === gender;
      })
      .sort((a, b) => Number(b?.[1]?.threatScore || 0) - Number(a?.[1]?.threatScore || 0))
      .slice(0, 20);

    const foreignXRaw = foreignCandidates.map(([_, v]) => getForeignXRaw(v));
    const foreignXNorm = minMaxNormalize(foreignXRaw);

    const foreignRaw = foreignCandidates.map(([name, v], idx) => {
      const m = v?.metrics || {};
      const threatScore = Number(v?.threatScore || 0);
      const eventPerformanceScore = normPercent(Number(v?.intensityRatio || 0) * 100);
      const foreignControl = normPercent(foreignXNorm[idx]);
      const genderValue = genderMap.get(normNameKey(name)) || "Unknown";

      return {
        name: nameZhMap[name] || name,
        nameEn: name,
        type: "FOREIGN",
        gender: genderValue,
        x: foreignControl,
        y: eventPerformanceScore,
        techPressure: Number(m.technique || 0),
        stability: Number(m.mental || 0),
        foreignControl,
        eventPerformanceScore,
        dominanceScore: 0,
        threatScore,
        dotSize: scoreToDotSize(threatScore),
      };
    });
    const foreignTop3 = [...foreignRaw]
      .sort((a, b) => Number(b.threatScore || 0) - Number(a.threatScore || 0))
      .slice(0, 3)
      .map((d) => d.nameEn);
    const foreignRankMap = new Map(foreignTop3.map((name, i) => [name, i + 1]));
    const foreign = foreignRaw.map((d) => ({
      ...d,
      label: foreignRankMap.has(d.nameEn) ? d.name : "",
      labelRank: foreignRankMap.get(d.nameEn) || 0,
    }));

    return [...chn, ...foreign]
      .filter((d) => d.gender === gender)
      .map((d) => {
        const xJitter = stableJitter(`${d.type}:${d.nameEn}:${d.gender}`, 2);
        return {
          ...d,
          xPlot: clamp(d.x + xJitter, 0, 110),
        };
      });
  }, [dominanceMetrics, threatMetrics, nameZhMap, genderMap, countryMap, gender]);

  const chnData = useMemo(() => chartData.filter((d) => d.type === "CHN"), [chartData]);
  const foreignData = useMemo(
    () => chartData.filter((d) => d.type === "FOREIGN"),
    [chartData]
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black text-white">
          国家队战略矩阵分析 - {gender === "Male" ? "男单" : "女单"}
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setGender("Male")}
            className={`px-4 py-2 rounded-xl text-sm transition ${
              gender === "Male"
                ? "bg-red-600 text-white"
                : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-red-500/40"
            }`}
          >
            男单
          </button>
          <button
            onClick={() => setGender("Female")}
            className={`px-4 py-2 rounded-xl text-sm transition ${
              gender === "Female"
                ? "bg-red-600 text-white"
                : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-red-500/40"
            }`}
          >
            女单
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        <div className="xl:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <div className="w-full h-[740px]">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 16, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="xPlot"
                  name="foreignControl"
                  domain={[0, 110]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  stroke="#475569"
                  label={{
                    value: "外战控制力 / 对华威胁控制 (0-100)",
                    position: "insideBottom",
                    offset: -8,
                    fill: "#cbd5e1",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="eventPerformanceScore"
                  domain={[0, 100]}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  stroke="#475569"
                  label={{
                    value: "大赛表现评分 / 高等级表现 (0-100)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#cbd5e1",
                  }}
                />
                <ReferenceLine x={60} stroke="#64748b" strokeDasharray="4 4" />
                <ReferenceLine y={60} stroke="#64748b" strokeDasharray="4 4" />
                <Tooltip content={<MatrixTooltip />} />

                <Scatter name="中国队员" data={chnData} fill={CHN_COLOR} shape={MatrixDot}>
                  <LabelList dataKey="label" content={<MatrixLabel />} />
                </Scatter>
                <Scatter
                  name="外国选手"
                  data={foreignData}
                  fill={FOREIGN_COLOR}
                  shape={MatrixDot}
                >
                  <LabelList dataKey="label" content={<MatrixLabel />} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside className="xl:col-span-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-white mb-4">象限说明</h2>
          <div className="space-y-4 text-sm text-slate-300">
            <div className="border border-slate-700 rounded-xl p-3">
              <div className="font-bold text-white">Q1 右上 (x&gt;60, y&gt;60)</div>
              <div>核心主力 / 高威胁</div>
            </div>
            <div className="border border-slate-700 rounded-xl p-3">
              <div className="font-bold text-white">Q2 左上 (x&lt;=60, y&gt;60)</div>
              <div>大赛型</div>
            </div>
            <div className="border border-slate-700 rounded-xl p-3">
              <div className="font-bold text-white">Q3 左下 (x&lt;=60, y&lt;=60)</div>
              <div>轮换型</div>
            </div>
            <div className="border border-slate-700 rounded-xl p-3">
              <div className="font-bold text-white">Q4 右下 (x&gt;60, y&lt;=60)</div>
              <div>外战型</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
