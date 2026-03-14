import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Crosshair,
  Loader2,
  Swords,
  Trophy,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import MarkdownMessage from "../components/MarkdownMessage.jsx";

const ASSIST_SUGGESTIONS = [
  {
    label: "训练计划",
    text: "请输出【针对性训练计划】（至少6条），每条包含：频次/时长｜方法｜量化指标｜对应风险点。重点放在接发球、前三板与关键分。",
  },
  {
    label: "打法克制",
    text: "请分析双方【风格/能力维度】的克制关系，指出3-5个胜负关键点，并给出对应对策。",
  },
  {
    label: "关键分",
    text: "请给出【关键分策略】（落点/节奏/发抢/接发球选择），并列出触发信号与应对动作。",
  },
  {
    label: "风险清单",
    text: "请输出【风险清单】按优先级排序：风险→触发条件→出现信号→应对动作。",
  },
  {
    label: "一页总结",
    text: "请用一页内容总结：对阵结论(3条)+风险(3条)+训练(6条)+临场策略(接发/前三板/相持/关键分)。",
  },
];

function stripCodeFences(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? String(m[1] || "").trim() : s;
}

function safeParseJson(text) {
  const s = stripCodeFences(text);
  if (!s) return null;
  try {
    const obj = JSON.parse(s);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function buildMainAssistantMarkdown(doc) {
  if (!doc || typeof doc !== "object") return "";
  const parts = [];
  const summary = doc?.summary || {};
  const sections = doc?.sections || {};

  parts.push("## 赛前分析");
  if (summary?.match) parts.push(`- ${String(summary.match).trim()}`);
  if (summary?.prediction) parts.push(`- ${String(summary.prediction).trim()}`);
  if (Array.isArray(summary?.keyConclusions) && summary.keyConclusions.length) {
    parts.push("");
    parts.push("### 最关键结论");
    summary.keyConclusions.slice(0, 5).forEach((t) => {
      const line = String(t || "").trim();
      if (line) parts.push(`- ${line}`);
    });
  }

  parts.push("");
  parts.push("## 针对性训练建议");
  parts.push(String(sections?.trainingPlan || "").trim() || "暂无训练计划内容。");

  return parts.filter(Boolean).join("\n");
}

function normNameKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function buildThreatIndex(threatMetrics) {
  const byNorm = {};
  if (!threatMetrics || typeof threatMetrics !== "object") return byNorm;
  for (const [k, v] of Object.entries(threatMetrics)) {
    const nk = normNameKey(k);
    if (!nk) continue;
    byNorm[nk] = v;
  }
  return byNorm;
}

function pickThreatProfile(threatMetrics, threatIndex, name) {
  if (!name) return null;
  if (threatMetrics?.[name]) return threatMetrics[name];
  const nk = normNameKey(name);
  return threatIndex?.[nk] || null;
}

function buildDominanceIndex(dominanceMetrics) {
  const byNorm = {};
  if (!dominanceMetrics || typeof dominanceMetrics !== "object") return byNorm;
  for (const [k, v] of Object.entries(dominanceMetrics)) {
    const nk = normNameKey(k);
    if (!nk) continue;
    byNorm[nk] = v;
  }
  return byNorm;
}

function pickDominanceProfile(dominanceMetrics, dominanceIndex, name) {
  if (!name) return null;
  if (dominanceMetrics?.[name]) return dominanceMetrics[name];
  const nk = normNameKey(name);
  return dominanceIndex?.[nk] || null;
}

function radarDataFromDominance(profile) {
  const m = profile?.metrics || profile || {};
  return [
    { k: "技术压制力", v: clamp01(m.techPressure) },
    { k: "稳定性", v: clamp01(m.stability) },
    { k: "外战控制力", v: clamp01(m.foreignControl) },
    { k: "大赛表现评分", v: clamp01(m.eventPerformanceScore ?? m.highLevelPerformance) },
    { k: "排名强度", v: clamp01(m.rankingStrength) },
  ];
}

function findPlayerByName(list, name) {
  const target = String(name || "").trim();
  if (!target) return null;
  return (Array.isArray(list) ? list : []).find((p) => (p?.nameEn || p?.name) === target) || null;
}

const EVENT_OPTIONS = [
  { label: "Olympics", key: "olympics" },
  { label: "Worlds", key: "worlds" },
  { label: "WTT", key: "wtt" },
  { label: "Feeder", key: "feeder" },
];

export default function MatchViewer({ players = [], threatMetrics, dominanceMetrics }) {
  const chinaPlayersAll = useMemo(
    () => (players || []).filter((p) => p.country === "CHN"),
    [players]
  );
  const foreignPlayersAll = useMemo(
    () => (players || []).filter((p) => p.country !== "CHN"),
    [players]
  );

  const [gender, setGender] = useState("Male"); // "Male" | "Female"
  const [chinaName, setChinaName] = useState("");
  const [foreignName, setForeignName] = useState("");
  const [eventKey, setEventKey] = useState("wtt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sim, setSim] = useState(null);
  const [h2h, setH2h] = useState(null);

  const chinaPlayers = useMemo(() => {
    return (chinaPlayersAll || []).filter((p) => !gender || p.gender === gender);
  }, [chinaPlayersAll, gender]);
  const foreignPlayers = useMemo(() => {
    return (foreignPlayersAll || []).filter((p) => !gender || p.gender === gender);
  }, [foreignPlayersAll, gender]);

  // players/threatMetrics are loaded async; ensure selects get sensible defaults.
  useEffect(() => {
    if (!chinaName && chinaPlayers.length) {
      setChinaName(chinaPlayers[0]?.nameEn || chinaPlayers[0]?.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chinaPlayers.length]);

  useEffect(() => {
    if (!foreignName && foreignPlayers.length) {
      setForeignName(foreignPlayers[0]?.nameEn || foreignPlayers[0]?.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreignPlayers.length]);

  useEffect(() => {
    // Switching gender should reset selection + clear stale outputs.
    setError("");
    setSim(null);
    setH2h(null);
    if (chinaPlayers.length) {
      setChinaName(chinaPlayers[0]?.nameEn || chinaPlayers[0]?.name || "");
    } else {
      setChinaName("");
    }
    if (foreignPlayers.length) {
      setForeignName(foreignPlayers[0]?.nameEn || foreignPlayers[0]?.name || "");
    } else {
      setForeignName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender]);

  useEffect(() => {
    if (chinaName && chinaPlayers.length) {
      const ok = chinaPlayers.some((p) => (p.nameEn || p.name) === chinaName);
      if (!ok) setChinaName(chinaPlayers[0]?.nameEn || chinaPlayers[0]?.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chinaPlayers.length, chinaName]);

  useEffect(() => {
    if (foreignName && foreignPlayers.length) {
      const ok = foreignPlayers.some((p) => (p.nameEn || p.name) === foreignName);
      if (!ok) setForeignName(foreignPlayers[0]?.nameEn || foreignPlayers[0]?.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreignPlayers.length, foreignName]);

  const canAnalyze = Boolean(chinaName && foreignName) && !loading;

  const dominanceIndex = useMemo(
    () => buildDominanceIndex(dominanceMetrics),
    [dominanceMetrics]
  );
  const threatIndex = useMemo(() => buildThreatIndex(threatMetrics), [threatMetrics]);

  const chinaDominance = useMemo(() => {
    const picked = pickDominanceProfile(dominanceMetrics, dominanceIndex, chinaName);
    if (picked) return picked;
    const p = findPlayerByName(chinaPlayers, chinaName);
    return p?.dominanceDimensions || null;
  }, [dominanceMetrics, dominanceIndex, chinaName, chinaPlayers]);

  const foreignDominance = useMemo(() => {
    const picked = pickDominanceProfile(dominanceMetrics, dominanceIndex, foreignName);
    if (picked) return picked;
    const p = findPlayerByName(foreignPlayers, foreignName);
    return p?.dominanceDimensions || null;
  }, [dominanceMetrics, dominanceIndex, foreignName, foreignPlayers]);

  const foreignThreat = useMemo(() => {
    const picked = pickThreatProfile(threatMetrics, threatIndex, foreignName);
    if (picked) return picked;
    const p = findPlayerByName(foreignPlayers, foreignName);
    return p?.threatDimensions || null;
  }, [threatMetrics, threatIndex, foreignName, foreignPlayers]);

  const chinaPlayer = useMemo(() => findPlayerByName(chinaPlayers, chinaName), [chinaPlayers, chinaName]);
  const foreignPlayer = useMemo(() => findPlayerByName(foreignPlayers, foreignName), [foreignPlayers, foreignName]);

  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantDoc, setAssistantDoc] = useState(null);
  const [assistantView, setAssistantView] = useState("trainingPlan"); // summary | comparison | keyFactors | risks | trainingPlan | tactics | missingData
  const assistantInputRef = useRef(null);

  const eventLabel = useMemo(() => {
    const hit = EVENT_OPTIONS.find((e) => e.key === eventKey);
    return hit?.label || eventKey || "";
  }, [eventKey]);

  const runAssistant = async () => {
    if (assistantLoading) return;
    if (!chinaName || !foreignName) return;
    setAssistantError("");
    setAssistantAnswer("");
    setAssistantDoc(null);
    setAssistantLoading(true);
    try {
      const resp = await fetch("/api/match-ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: assistantQuestion,
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
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
      }
      const raw = String(data?.answer || "").trim();
      const doc = safeParseJson(raw);
      setAssistantDoc(doc);
      setAssistantAnswer(raw);
      if (doc) setAssistantView("summary");
    } catch (e) {
      setAssistantError(e?.message || "AI分析失败");
    } finally {
      setAssistantLoading(false);
    }
  };

  const onAnalyze = async () => {
    setError("");
    setLoading(true);
    setSim(null);
    setH2h(null);
    try {
      if (!chinaName || !foreignName) throw new Error("请选择球员A/球员B");
      const resp = await fetch("/api/matchup-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foreignName,
          chinaName,
          eventKey,
          foreignUseDominance: true,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${resp.status}`);
      }
      setSim(data);

      const h = await fetch(
        `/api/head-to-head?playerA=${encodeURIComponent(
          chinaName
        )}&playerB=${encodeURIComponent(foreignName)}`
      );
      const hData = await h.json().catch(() => ({}));
      if (h.ok && hData?.ok) setH2h(hData);
    } catch (e) {
      setError(e?.message || "分析失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fadeIn">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">赛事观赛助手</h1>
          <p className="text-slate-400 mt-2 text-sm">
            选择对阵与赛事类型，一键生成胜率预测、技术对位与历史交手
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 lg:col-span-2">
          <div className="text-white font-bold mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-slate-300" />
            比赛选择
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">项目</div>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                <option value="Male">男单</option>
                <option value="Female">女单</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">球员A（中国）</div>
              <select
                value={chinaName}
                onChange={(e) => {
                  setError("");
                  setChinaName(e.target.value);
                }}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                {!chinaName ? (
                  <option value="" disabled>
                    请选择
                  </option>
                ) : null}
                {chinaPlayers.map((p) => {
                  const value = p.nameEn || p.name;
                  const label = p.nameZh || p.nameEn || p.name;
                  return (
                    <option key={`c-${p.id}`} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">球员B（对手）</div>
              <select
                value={foreignName}
                onChange={(e) => {
                  setError("");
                  setForeignName(e.target.value);
                }}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                {!foreignName ? (
                  <option value="" disabled>
                    请选择
                  </option>
                ) : null}
                {foreignPlayers.map((p) => {
                  const value = p.nameEn || p.name;
                  const label = p.nameZh || p.nameEn || p.name;
                  return (
                    <option key={`f-${p.id}`} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">赛事类型</div>
              <select
                value={eventKey}
                onChange={(e) => setEventKey(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                {EVENT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className="mt-5 w-full px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 active:bg-red-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            开始分析
          </button>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="text-white font-bold mb-4 flex items-center gap-2">
            <Swords size={18} className="text-slate-300" />
            胜率预测
          </div>
          {sim ? (
            <div className="space-y-3">
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-400 text-xs mb-2">胜率预测</div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-white font-bold">{chinaName}</div>
                  <div className="text-white font-mono font-bold">
                    {Number(sim.chinaWinPct || 0).toFixed(0)}%
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <div className="text-slate-200 font-semibold">{foreignName}</div>
                  <div className="text-slate-200 font-mono font-semibold">
                    {Number(sim.foreignWinPct || 0).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <div className="text-slate-400 text-xs mb-2">历史交手</div>
                {h2h ? (
                  <div className="text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold">{chinaName}</span>
                      <span className="font-mono text-emerald-300">{h2h.aWins}胜</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-slate-200 font-semibold">{foreignName}</span>
                      <span className="font-mono text-red-300">{h2h.bWins}胜</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      统计样本：{h2h.total} 场（来自本地赛果库）
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">暂无本地交手数据（或匹配不到对手别名）</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm border border-slate-800/60 rounded-xl p-4 bg-slate-950/20">
              点击“开始分析”生成预测
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="text-white font-bold mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-slate-300" />
          技战术能力对位（同专业模式算法）
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-bold">{chinaName || "球员A"}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Crosshair size={14} /> tech/stability/foreign/event/rank
              </div>
            </div>
            {chinaDominance ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarDataFromDominance(chinaDominance)}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="k" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                    <RechartsTooltip />
                    <Radar dataKey="v" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-slate-500 text-sm border border-slate-800/60 rounded-xl p-4 bg-slate-950/20">
                暂无技战术能力数据
              </div>
            )}
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-bold">{foreignName || "球员B"}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Crosshair size={14} /> tech/stability/foreign/event/rank
              </div>
            </div>
            {foreignDominance ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarDataFromDominance(foreignDominance)}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="k" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                    <RechartsTooltip />
                    <Radar dataKey="v" stroke="#22c55e" fill="#22c55e" fillOpacity={0.20} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-slate-500 text-sm border border-slate-800/60 rounded-xl p-4 bg-slate-950/20">
                暂无技战术能力数据
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="text-white font-bold mb-4 flex items-center gap-2">
          <Activity size={18} className="text-slate-300" />
          AI分析助手
        </div>

        <div className="space-y-6">
          <div className="bg-slate-950/25 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs text-slate-400">
              对比两位选手的技术特点与历史表现，并分析两人的胜负关键。
            </div>

            <textarea
              ref={assistantInputRef}
              value={assistantQuestion}
              onChange={(e) => setAssistantQuestion(e.target.value)}
              placeholder="可选：你最想关注什么？例如“训练计划怎么做？”“关键分怎么处理？”"
              className="w-full min-h-[120px] bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-500/40"
            />

            <div className="flex flex-wrap gap-2">
              {ASSIST_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="px-3 py-1.5 rounded-full text-xs bg-slate-900/60 border border-slate-700 text-slate-200 hover:border-red-500/40 transition"
                  onClick={() => {
                    setAssistantQuestion(s.text);
                    setTimeout(() => assistantInputRef.current?.focus?.(), 0);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={runAssistant}
              disabled={assistantLoading || !chinaName || !foreignName}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {assistantLoading ? <Loader2 className="animate-spin" size={16} /> : <Swords size={16} />}
              生成AI分析
            </button>

            {assistantError ? (
              <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
                {assistantError}
              </div>
            ) : null}
          </div>

          <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-white font-extrabold text-lg">胜负关键分析</div>
                <div className="text-xs text-slate-400 mt-1">{assistantDoc?.summary?.match || ""}</div>
              </div>
              <div className="text-xs text-slate-500">输出内容</div>
            </div>

            {assistantDoc ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    ["summary", "总览"],
                    ["trainingPlan", "训练计划"],
                    ["tactics", "临场策略"],
                    ["risks", "风险清单"],
                    ["keyFactors", "关键点"],
                    ["comparison", "对比画像"],
                    ["missingData", "缺口数据"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAssistantView(k)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        assistantView === k
                          ? "bg-red-600 border-red-500 text-white"
                          : "bg-slate-900/60 border-slate-700 text-slate-200 hover:border-red-500/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
                  {assistantView === "summary" ? (
                    <MarkdownMessage
                      content={[
                        "## 总览",
                        assistantDoc?.summary?.match ? `- ${assistantDoc.summary.match}` : "",
                        assistantDoc?.summary?.prediction ? `- ${assistantDoc.summary.prediction}` : "",
                        "",
                        "## 最关键结论",
                        Array.isArray(assistantDoc?.summary?.keyConclusions)
                          ? assistantDoc.summary.keyConclusions.map((t) => `- ${t}`).join("\n")
                          : "暂无",
                      ]
                        .map((s) => String(s || "").trim())
                        .filter(Boolean)
                        .join("\n")}
                    />
                  ) : (
                    <MarkdownMessage
                      content={
                        String(assistantDoc?.sections?.[assistantView] || "").trim() ||
                        "暂无内容（可能是模型未按结构输出）。"
                      }
                    />
                  )}
                </div>
              </>
            ) : assistantAnswer ? (
              <div className="space-y-3">
                <div className="text-xs text-amber-300 bg-amber-950/20 border border-amber-900/40 rounded-xl px-4 py-3">
                  模型返回未按结构化JSON输出，已按原始内容展示（可点击上方建议按钮重试）。
                </div>
                <MarkdownMessage content={assistantAnswer} />
              </div>
            ) : (
              <div className="text-sm text-slate-500 bg-slate-950/20 border border-slate-800/60 rounded-xl px-4 py-3">
                生成后内容会显示在这里（在输入框下方）。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
