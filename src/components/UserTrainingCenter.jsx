import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Filter, LineChart, Loader2, RefreshCw, Sparkles, Target, Trash2, Users, Wand2 } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const RATING_DELTA = {
  进步: 3,
  持平: 1,
  退步: -2,
};

const TRAINING_TYPE_OPTIONS = [
  "发球",
  "接发球",
  "正手",
  "反手",
  "步法",
  "相持",
  "战术",
  "心理",
  "体能",
  "其他",
];

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function num(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function parseDurationToHours(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return Number.NaN;
  const compact = s.replace(/\s+/g, "");

  const hm = compact.match(/^(\d+(?:\.\d+)?)[:：](\d+(?:\.\d+)?)$/);
  if (hm) {
    const hours = Number(hm[1]);
    const minutes = Number(hm[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0) return Number.NaN;
    return hours + minutes / 60;
  }

  const hMatch = compact.match(/(\d+(?:\.\d+)?)小时/);
  const mMatch = compact.match(/(\d+(?:\.\d+)?)分钟/);
  if (hMatch || mMatch) {
    const hours = hMatch ? Number(hMatch[1]) : 0;
    const minutes = mMatch ? Number(mMatch[1]) : 0;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) return Number.NaN;
    return hours + minutes / 60;
  }

  const minutesOnly = compact.match(/^(\d+(?:\.\d+)?)(?:m|min|mins|minute|minutes)$/i);
  if (minutesOnly) {
    const minutes = Number(minutesOnly[1]);
    return Number.isFinite(minutes) && minutes >= 0 ? minutes / 60 : Number.NaN;
  }

  const hoursOnly = compact.match(/^(\d+(?:\.\d+)?)(?:h|hr|hrs|hour|hours|小时)?$/i);
  if (hoursOnly) {
    const hours = Number(hoursOnly[1]);
    return Number.isFinite(hours) && hours >= 0 ? hours : Number.NaN;
  }

  return Number.NaN;
}

function inferTrainingTypeFromContent(content) {
  const c = String(content || "").trim();
  if (!c) return "";
  if (c.includes("发球")) return "发球";
  if (c.includes("接发")) return "接发球";
  if (c.includes("正手")) return "正手";
  if (c.includes("反手")) return "反手";
  if (c.includes("步法")) return "步法";
  if (c.includes("相持")) return "相持";
  if (c.includes("战术")) return "战术";
  if (c.includes("心理")) return "心理";
  if (c.includes("体能")) return "体能";
  return "其他";
}

async function fetchJson(url, options) {
  const resp = await fetch(url, options);
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.error || data?.message || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-slate-900/70 border border-slate-800 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return <div className="text-slate-300 text-sm font-semibold">{children}</div>;
}

function CardValue({ children, className = "" }) {
  return <div className={`text-white text-2xl font-black mt-2 ${className}`}>{children}</div>;
}

function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${className}`}
    >
      {children}
    </span>
  );
}

function bookingStatusMeta(status) {
  const s = String(status || "pending").trim();
  if (s === "confirmed") {
    return {
      label: "已预约",
      badgeClass: "bg-emerald-950/30 border-emerald-900/40 text-emerald-300",
    };
  }
  return {
    label: "正在预约中",
    badgeClass: "bg-slate-800/60 border-slate-700 text-slate-200",
  };
}

function computeScore(records) {
  const base = 60;
  const clampScore = (v) => Math.max(0, Math.min(100, v));
  const total = asArray(records).reduce((sum, r) => {
    const quality = num(RATING_DELTA[r?.rating], 0);
    const duration = Math.max(0, num(r?.durationHours, 1));
    const difficulty = Math.max(1, Math.min(5, num(r?.difficulty, 3)));
    // Mild weighting by time & difficulty; keep stable and bounded.
    const timeBonus = Math.max(0, duration - 1) * 0.6;
    const diffBonus = (difficulty - 3) * 0.5;
    return sum + quality + timeBonus + diffBonus;
  }, 0);
  return clampScore(Math.round(base + total));
}

function computeTrend(records) {
  const last6 = asArray(records).slice(-6);
  const total = last6.reduce((sum, r) => sum + computeGrowthIndex(r), 0);
  return Math.round(total);
}

function trendClass(trend) {
  if (trend > 0) return "text-green-400";
  if (trend < 0) return "text-red-400";
  return "text-slate-300";
}

function formatTrend(trend) {
  const t = num(trend, 0);
  if (t > 0) return `+${t}`;
  return String(t);
}

function difficultyLabel(d) {
  const x = num(d, 3);
  if (x <= 1) return "简单";
  if (x === 2) return "偏低";
  if (x === 3) return "中等";
  if (x === 4) return "偏高";
  return "高强度";
}

function computeGrowthIndex(record) {
  const quality = num(RATING_DELTA[record?.rating], 0);
  const duration = Math.max(0, num(record?.durationHours, 1));
  const difficulty = Math.max(1, Math.min(5, num(record?.difficulty, 3)));
  const diffFactor = 0.8 + difficulty * 0.08; // 0.88..1.2
  return quality * duration * diffFactor;
}

function normalizeDateISO(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return raw;
  const yyyy = m[1];
  const mm = String(m[2]).padStart(2, "0");
  const dd = String(m[3]).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateShort(s) {
  const raw = normalizeDateISO(s);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw || "-";
  return `${m[2]}-${m[3]}`;
}

function inDateRange(dateISO, fromISO, toISO) {
  const d = normalizeDateISO(dateISO);
  const from = normalizeDateISO(fromISO);
  const to = normalizeDateISO(toISO);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function coachTypeLabel(t) {
  if (t === "professional") return "专业教练";
  if (t === "amateur") return "业余教练";
  if (t === "peer") return "校园陪练";
  return String(t || "");
}

function buildRecommendReason(user, coach) {
  const reasons = [];
  if (user?.improveSkill && asArray(coach?.skills).includes(user.improveSkill)) {
    reasons.push(`擅长${user.improveSkill}`);
  }
  if (user?.location && coach?.city && user.location === coach.city) reasons.push("同城");
  if (Number.isFinite(Number(user?.budget)) && Number.isFinite(Number(coach?.price))) {
    if (Number(coach.price) <= Number(user.budget)) reasons.push("符合预算");
  }
  if (user?.coachType && user.coachType !== "不限" && coach?.coachType === user.coachType) {
    reasons.push("教练类型匹配");
  }
  if (user?.coachGender && user.coachGender !== "不限" && coach?.gender === user.coachGender) {
    reasons.push("性别偏好匹配");
  }
  if (user?.coachStyle && coach?.personality === user.coachStyle) reasons.push("风格匹配");
  return reasons.length ? reasons.join("，") : "综合匹配度较高";
}

export default function UserTrainingCenter({ onGoCoachMarket, userId = 1 }) {
  const [user, setUser] = useState(null);

  const [trainingRecords, setTrainingRecords] = useState([]);
  const [trainingsLoading, setTrainingsLoading] = useState(true);
  const [trainingsError, setTrainingsError] = useState("");
  const [deletingTrainingId, setDeletingTrainingId] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [currentUserName, setCurrentUserName] = useState("当前用户");
  const [deletingBookingId, setDeletingBookingId] = useState(null);

  const [newTraining, setNewTraining] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return {
      date: `${yyyy}-${mm}-${dd}`,
      content: "",
      type: "",
      rating: "进步",
      durationHours: 1,
      difficulty: 3,
      result: "",
    };
  });
  const [savingTraining, setSavingTraining] = useState(false);

  const [recommendForm, setRecommendForm] = useState({
    location: "北京",
    budget: 300,
    coachGender: "不限",
    coachType: "不限",
    trainingGoal: "业余提升",
    improveSkill: "反手技术",
    coachStyle: "技术细节型",
  });
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState("");
  const [recommended, setRecommended] = useState([]);

  const [trainingFilterFrom, setTrainingFilterFrom] = useState("");
  const [trainingFilterTo, setTrainingFilterTo] = useState("");
  const [trainingFilterType, setTrainingFilterType] = useState("全部");

  const [planGoal, setPlanGoal] = useState("提升发球稳定性");

  const score = useMemo(() => computeScore(trainingRecords), [trainingRecords]);
  const trend = useMemo(() => computeTrend(trainingRecords), [trainingRecords]);

  const effortSeries = useMemo(() => {
    const list = asArray(trainingRecords)
      .slice()
      .sort(
        (a, b) =>
          normalizeDateISO(a?.date).localeCompare(normalizeDateISO(b?.date)) ||
          num(a?.id, 0) - num(b?.id, 0)
      );
    const last = list.slice(-10);
    let cumulative = 0;
    return last.map((r) => {
      const hours = Math.max(0, num(r?.durationHours, 1));
      const growth = computeGrowthIndex(r);
      cumulative += growth;
      return {
        date: dateShort(r?.date),
        hours: Number(hours.toFixed(2)),
        growth: Number(growth.toFixed(2)),
        cumulative: Number(cumulative.toFixed(2)),
      };
    });
  }, [trainingRecords]);

  const filteredTrainingRecords = useMemo(() => {
    const typeSel = String(trainingFilterType || "全部").trim() || "全部";
    return asArray(trainingRecords).filter((r) => {
      const dateOk = inDateRange(r?.date, trainingFilterFrom, trainingFilterTo);
      if (!dateOk) return false;
      if (typeSel === "全部") return true;
      const t = String(r?.type || inferTrainingTypeFromContent(r?.content) || "").trim() || "其他";
      return t === typeSel;
    });
  }, [trainingRecords, trainingFilterFrom, trainingFilterTo, trainingFilterType]);

  const trainingStats = useMemo(() => {
    const list = asArray(trainingRecords);
    const ratingCounts = { 进步: 0, 持平: 0, 退步: 0 };
    const typeHours = {};
    const typeGrowth = {};

    for (const r of list) {
      const rating = String(r?.rating || "").trim();
      if (ratingCounts[rating] !== undefined) ratingCounts[rating] += 1;

      const t = String(r?.type || inferTrainingTypeFromContent(r?.content) || "").trim() || "其他";
      const hours = Math.max(0, num(r?.durationHours, 1));
      const growth = computeGrowthIndex(r);
      typeHours[t] = (typeHours[t] || 0) + hours;
      typeGrowth[t] = (typeGrowth[t] || 0) + growth;
    }

    const typeRank = Object.keys(typeHours)
      .map((t) => ({ type: t, hours: typeHours[t], growth: typeGrowth[t] || 0 }))
      .sort((a, b) => b.hours - a.hours);

    return {
      ratingCounts,
      ratingChart: [
        { k: "进步", v: ratingCounts.进步, color: "#34d399" },
        { k: "持平", v: ratingCounts.持平, color: "#94a3b8" },
        { k: "退步", v: ratingCounts.退步, color: "#f87171" },
      ],
      typeRank,
    };
  }, [trainingRecords]);

  const suggestedTraining = useMemo(() => {
    const recent = asArray(trainingRecords)
      .slice()
      .sort(
        (a, b) =>
          normalizeDateISO(a?.date).localeCompare(normalizeDateISO(b?.date)) ||
          num(a?.id, 0) - num(b?.id, 0)
      )
      .slice(-10);

    const recentHours = {};
    for (const r of recent) {
      const t = String(r?.type || inferTrainingTypeFromContent(r?.content) || "").trim() || "其他";
      recentHours[t] = (recentHours[t] || 0) + Math.max(0, num(r?.durationHours, 1));
    }

    let pick = "其他";
    let minHours = Number.POSITIVE_INFINITY;
    for (const t of TRAINING_TYPE_OPTIONS) {
      const h = recentHours[t] ?? 0;
      if (h < minHours) {
        minHours = h;
        pick = t;
      }
    }

    const templates = {
      发球: "发球变化训练：同一落点做下旋/侧下旋变化，练 10 组 × 12 球",
      接发球: "接发球训练：短球控短 + 拧拉/挑打选择，练前三板衔接",
      正手: "正手进攻训练：正手拉冲上台率 + 落点大角，练 8 组 × 20 球",
      反手: "反手稳定训练：反手快撕/快带连续 30 球，强调上台率与还原",
      步法: "步法训练：两点/三点移动 + 还原，配合上手 6 组 × 3 分钟",
      相持: "相持训练：中等强度长回合，控制失误并加入落点变化",
      战术: "战术训练：针对一套发球 + 三板线路固定套路，打 3 套实战演练",
      心理: "心理训练：关键分预案（落后/领先）+ 呼吸节奏，模拟 6 次关键分",
      体能: "体能训练：核心 + 下肢力量（深蹲/弓步/跳绳）+ 间歇跑 20 分钟",
      其他: "综合训练：发接发 + 上手 + 相持各 20 分钟，做一次完整训练结构",
    };

    return {
      type: pick,
      content: templates[pick] || templates.其他,
    };
  }, [trainingRecords]);

  const planTasks = useMemo(() => {
    const goal = String(planGoal || "").trim();
    const lib = {
      提升发球稳定性: [
        { type: "发球", content: "发球稳定性：同动作同落点连续 50 球，上台率≥90%", durationHours: 1, difficulty: 3 },
        { type: "发球", content: "发球落点：短/长两点切换，10 组×12 球", durationHours: 1, difficulty: 3 },
        { type: "接发球", content: "发球后第三板：发球→抢攻/控短→下一板跟进", durationHours: 1, difficulty: 4 },
      ],
      增强反手稳定性: [
        { type: "反手", content: "反手连续：快撕/快带 30 球×8 组，强调还原", durationHours: 1, difficulty: 3 },
        { type: "相持", content: "反手相持：中强度长回合，目标失误≤3/回合", durationHours: 1, difficulty: 4 },
        { type: "步法", content: "反手位步法：两点移动+反手出球 6 组×3 分钟", durationHours: 1, difficulty: 4 },
      ],
      提高相持稳定性: [
        { type: "相持", content: "相持稳定：连续 50 球训练，控制弧线与落点", durationHours: 1, difficulty: 3 },
        { type: "战术", content: "落点控制：定点→变点，线路组合 8 组×20 球", durationHours: 1, difficulty: 4 },
        { type: "心理", content: "耐心与节奏：长回合模拟 + 关键分不冒险策略", durationHours: 1, difficulty: 3 },
      ],
      提升步法体能: [
        { type: "步法", content: "两点/三点步法：启动+还原 8 组×2 分钟", durationHours: 1, difficulty: 4 },
        { type: "体能", content: "下肢力量：深蹲/弓步/提踵 3 组×12 次", durationHours: 1, difficulty: 3 },
        { type: "体能", content: "间歇跑：30秒快 + 30秒慢 × 10 轮", durationHours: 1, difficulty: 4 },
      ],
    };

    return lib[goal] || lib.提升发球稳定性;
  }, [planGoal]);

  const pendingCount = useMemo(
    () => asArray(bookings).filter((b) => String(b?.status || "pending") !== "confirmed").length,
    [bookings]
  );
  const confirmedCount = useMemo(
    () => asArray(bookings).filter((b) => String(b?.status || "pending") === "confirmed").length,
    [bookings]
  );

  const loadUser = async () => {
    try {
      const u = await fetchJson(`/api/users/${encodeURIComponent(userId)}`);
      setUser(u && typeof u === "object" ? u : null);
      const name = String(u?.name || "当前用户").trim() || "当前用户";
      setCurrentUserName(name);
      return name;
    } catch {
      setUser(null);
      setCurrentUserName("当前用户");
      return "当前用户";
    }
  };

  const loadTrainings = async () => {
    setTrainingsError("");
    setTrainingsLoading(true);
    try {
      const data = await fetchJson(`/api/users/${encodeURIComponent(userId)}/trainings`);
      setTrainingRecords(asArray(data));
    } catch (e) {
      setTrainingRecords([]);
      setTrainingsError(e?.message || "训练记录加载失败");
    } finally {
      setTrainingsLoading(false);
    }
  };

  const loadBookings = async (userNameOverride) => {
    setBookingsError("");
    setBookingsLoading(true);
    try {
      const userName =
        String(userNameOverride || currentUserName || "").trim() ||
        (await loadUser()) ||
        "当前用户";
      const data = await fetchJson(
        `/api/bookings?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
      );
      setBookings(asArray(data));
    } catch (e) {
      setBookings([]);
      setBookingsError(e?.message || "预约记录加载失败");
    } finally {
      setBookingsLoading(false);
    }
  };

  const deleteBooking = async (bookingId) => {
    const id = Number(bookingId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!window.confirm("确定要删除这条预约记录吗？")) return;

    setBookingsError("");
    setDeletingBookingId(id);
    try {
      const userName = String(currentUserName || "当前用户").trim() || "当前用户";
      const resp = await fetch(
        `/api/bookings/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`,
        { method: "DELETE" }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${resp.status}`);
      }
      setBookings((prev) => asArray(prev).filter((b) => Number(b?.id) !== id));
    } catch (e) {
      setBookingsError(e?.message || "删除失败");
    } finally {
      setDeletingBookingId(null);
    }
  };

  useEffect(() => {
    (async () => {
      const userName = await loadUser();
      await Promise.all([loadTrainings(), loadBookings(userName)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitTraining = async (e) => {
    e.preventDefault();
    if (savingTraining) return;
    const date = String(newTraining?.date || "").trim();
    const content = String(newTraining?.content || "").trim();
    const typeRaw = String(newTraining?.type || "").trim();
    const rating = String(newTraining?.rating || "").trim();
    const durationHours = parseDurationToHours(newTraining?.durationHours);
    const difficulty = Number(newTraining?.difficulty);
    const result = String(newTraining?.result || "").trim();

    if (!date || !content || !rating) return;
    if (!Number.isFinite(durationHours) || durationHours <= 0) return;
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) return;

    const type = typeRaw || inferTrainingTypeFromContent(content) || "";

    setSavingTraining(true);
    try {
      await fetchJson(`/api/users/${encodeURIComponent(userId)}/trainings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, content, type, rating, durationHours, difficulty, result }),
      });
      setNewTraining((v) => ({ ...v, content: "", type: "", result: "" }));
      await loadTrainings();
    } catch (err) {
      setTrainingsError(err?.message || "训练记录保存失败");
    } finally {
      setSavingTraining(false);
    }
  };

  const deleteTraining = async (trainingId) => {
    const id = Number(trainingId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!window.confirm("确定要删除这条训练记录吗？")) return;

    setTrainingsError("");
    setDeletingTrainingId(id);
    try {
      await fetchJson(
        `/api/users/${encodeURIComponent(userId)}/trainings/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      setTrainingRecords((prev) => asArray(prev).filter((t) => Number(t?.id) !== id));
    } catch (e) {
      setTrainingsError(e?.message || "删除失败");
    } finally {
      setDeletingTrainingId(null);
    }
  };

  const submitRecommend = async (e) => {
    e.preventDefault();
    if (recommendLoading) return;
    setRecommendError("");
    setRecommendLoading(true);
    try {
      const payload = {
        location: String(recommendForm.location || "").trim(),
        budget: num(recommendForm.budget, 0),
        coachGender: String(recommendForm.coachGender || "不限").trim() || "不限",
        coachType: String(recommendForm.coachType || "不限").trim() || "不限",
        trainingGoal: String(recommendForm.trainingGoal || "").trim(),
        improveSkill: String(recommendForm.improveSkill || "").trim(),
        coachStyle: String(recommendForm.coachStyle || "").trim(),
      };
      const data = await fetchJson("/api/recommend-coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRecommended(asArray(data?.coaches).slice(0, 3));
    } catch (err) {
      setRecommended([]);
      setRecommendError(err?.message || "推荐失败");
    } finally {
      setRecommendLoading(false);
    }
  };

  const aiSummary = useMemo(() => {
    const list = asArray(trainingRecords);
    if (!list.length) return "暂无训练记录，先添加几条训练记录再查看分析。";
    const last = list[list.length - 1];
    const delta = num(RATING_DELTA[last?.rating], 0);
    if (delta >= 3) return "最近一次训练有明显进步，建议保持训练频率并增加对抗强度巩固成果。";
    if (delta > 0) return "最近训练保持稳定，建议把训练内容细化到关键环节（例如发接发、前三板）。";
    if (delta < 0) return "最近训练出现退步，建议降低强度、回归基本功并复盘失误点。";
    return "训练趋势较平稳，建议设定更明确的训练目标并记录可量化指标。";
  }, [trainingRecords]);

  const aiReport = useMemo(() => {
    const list = asArray(trainingRecords);
    if (!list.length) {
      return {
        strengths: "暂无数据",
        risks: "暂无数据",
        suggestion: "先添加训练记录，AI 才能根据你的训练轨迹生成更准确的建议。",
      };
    }

    const rankedByGrowth = trainingStats.typeRank
      .slice()
      .sort((a, b) => Number(b.growth || 0) - Number(a.growth || 0));

    const best = rankedByGrowth[0];
    const worst = rankedByGrowth[rankedByGrowth.length - 1];

    const recent10 = list
      .slice()
      .sort(
        (a, b) =>
          normalizeDateISO(a?.date).localeCompare(normalizeDateISO(b?.date)) ||
          num(a?.id, 0) - num(b?.id, 0)
      )
      .slice(-10);

    const totalHours10 = recent10.reduce((s, r) => s + Math.max(0, num(r?.durationHours, 1)), 0);
    const avgDifficulty10 = recent10.length
      ? recent10.reduce((s, r) => s + Math.max(1, Math.min(5, num(r?.difficulty, 3))), 0) / recent10.length
      : 0;
    const declines10 = recent10.filter((r) => String(r?.rating || "").trim() === "退步").length;

    const suggestionParts = [];
    if (declines10 >= 3) suggestionParts.push("最近训练波动较大，建议先把强度下调到“中等”，用基本功稳住失误。");
    if (avgDifficulty10 >= 4) suggestionParts.push("近期难度偏高，建议加入 1 次“低难度巩固课”提升稳定性。");
    if (totalHours10 < 6) suggestionParts.push("近期训练量偏少，建议把训练频率固定下来（例如每周 2 次）。");
    suggestionParts.push(`下一次可以优先安排：${suggestedTraining.type}（${suggestedTraining.content}）。`);

    return {
      strengths: best?.type ? `${best.type}（投入 ${Number(best.hours || 0).toFixed(1)}h）` : "暂无",
      risks: worst?.type ? `${worst.type}（成长贡献偏低，可补齐短板）` : "暂无",
      suggestion: suggestionParts.join(" "),
    };
  }, [trainingRecords, trainingStats.typeRank, suggestedTraining]);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">用户训练中心</h1>
          <div className="text-slate-400 text-sm mt-2">
            训练记录、AI分析、预约记录与AI教练推荐
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 hover:border-red-500/40 hover:bg-slate-800 transition"
          onClick={() => (onGoCoachMarket ? onGoCoachMarket() : null)}
        >
          <Users size={18} />
          去教练平台
        </button>
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-bold text-lg">我的预约</div>
            <div className="text-slate-400 text-sm mt-1">
              用户：<span className="text-slate-200">{currentUserName}</span>
              <span className="mx-2 text-slate-600">•</span>
              正在预约中：<span className="text-slate-200">{pendingCount}</span>
              <span className="mx-2 text-slate-600">/</span>
              已预约：<span className="text-slate-200">{confirmedCount}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              教练确认后状态会变为“已预约”，点击右侧刷新查看最新状态。
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
            onClick={() => loadBookings()}
            disabled={bookingsLoading}
          >
            {bookingsLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            刷新
          </button>
        </div>

        {bookingsError ? <div className="mt-4 text-sm text-red-400">{bookingsError}</div> : null}

        {bookingsLoading ? (
          <div className="mt-4 text-sm text-slate-400">加载中...</div>
        ) : bookings.length ? (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bookings
              .slice()
              .sort((a, b) => num(b?.id, 0) - num(a?.id, 0))
              .map((b) => {
                const meta = bookingStatusMeta(b?.status);
                return (
                  <div
                    key={`booking-${b?.id}`}
                    className="relative bg-slate-950/20 border border-slate-800 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-white font-bold truncate">
                        {b?.coachName || "教练"}{" "}
                        <span className="text-slate-400 font-normal">
                          #{String(b?.id || "").slice(-6)}
                        </span>
                      </div>
                      <Badge className={meta.badgeClass}>{meta.label}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        {b?.date || "-"} {b?.time || ""}
                      </span>
                      <span className="text-slate-500">地点：{b?.location || "-"}</span>
                      <span className="text-slate-500">内容：{b?.content || "-"}</span>
                    </div>

                    <button
                      type="button"
                      title="删除预约"
                      aria-label="删除预约"
                      onClick={() => deleteBooking(b?.id)}
                      disabled={deletingBookingId === Number(b?.id)}
                      className="absolute right-3 bottom-3 p-2 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-300 hover:border-red-500/40 hover:text-red-200 transition disabled:opacity-50"
                    >
                      {deletingBookingId === Number(b?.id) ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-400">暂无预约记录，去教练平台预约后这里会显示。</div>
        )}
      </Card>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardTitle>训练次数</CardTitle>
          <CardValue>{trainingRecords.length}</CardValue>
        </Card>
        <Card>
          <CardTitle>累计训练时间</CardTitle>
          <CardValue>
            {Math.round(
              asArray(trainingRecords).reduce(
                (sum, r) => sum + Math.max(0, num(r?.durationHours, 1)),
                0
              )
            )}{" "}
            小时
          </CardValue>
        </Card>
        <Card>
          <CardTitle>技术评分</CardTitle>
          <CardValue>{score}</CardValue>
        </Card>
        <Card>
          <CardTitle>最近成长趋势</CardTitle>
          <CardValue className={trendClass(trend)}>{formatTrend(trend)}</CardValue>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-white font-bold text-lg">努力轨迹与成长</div>
            <div className="text-slate-400 text-sm mt-1">展示最近 10 次训练的训练时长与成长指数</div>
          </div>
        </div>
        {effortSeries.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={effortSeries}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <RechartsTooltip
                  contentStyle={{
                    background: "rgba(15,23,42,0.96)",
                    border: "1px solid #334155",
                    borderRadius: "10px",
                    color: "#e2e8f0",
                  }}
                  formatter={(value, name) => {
                    if (name === "hours") return [`${Number(value).toFixed(1)} 小时`, "训练时长"];
                    if (name === "growth") return [`${Number(value).toFixed(1)}`, "成长指数"];
                    if (name === "cumulative") return [`${Number(value).toFixed(1)}`, "累计成长"];
                    return [value, name];
                  }}
                />
                <Bar dataKey="hours" name="hours" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="growth"
                  name="growth"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-sm text-slate-400">暂无数据，添加训练记录后会显示趋势图。</div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-white font-bold text-lg">训练记录</div>
              <div className="text-slate-400 text-sm mt-1">记录每次训练内容与自评结果</div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Filter size={14} className="text-slate-500" />
                  快速筛选
                </span>
                <input
                  type="date"
                  value={trainingFilterFrom}
                  onChange={(e) => setTrainingFilterFrom(e.target.value)}
                  className="bg-slate-950/30 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                  title="开始日期"
                />
                <span className="text-slate-600">-</span>
                <input
                  type="date"
                  value={trainingFilterTo}
                  onChange={(e) => setTrainingFilterTo(e.target.value)}
                  className="bg-slate-950/30 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                  title="结束日期"
                />
                <select
                  value={trainingFilterType}
                  onChange={(e) => setTrainingFilterType(e.target.value)}
                  className="bg-slate-950/30 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                  title="训练类型"
                >
                  <option value="全部">类型：全部</option>
                  {TRAINING_TYPE_OPTIONS.map((t) => (
                    <option key={`ft-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {(trainingFilterFrom || trainingFilterTo || trainingFilterType !== "全部") ? (
                  <button
                    type="button"
                    className="px-2 py-1 rounded-lg bg-slate-900/40 border border-slate-800 text-slate-300 hover:border-slate-700 transition"
                    onClick={() => {
                      setTrainingFilterFrom("");
                      setTrainingFilterTo("");
                      setTrainingFilterType("全部");
                    }}
                  >
                    清除
                  </button>
                ) : null}
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">
                  显示 {filteredTrainingRecords.length}/{trainingRecords.length}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
              onClick={loadTrainings}
              disabled={trainingsLoading}
            >
              {trainingsLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              刷新
            </button>
          </div>

          {trainingsError ? <div className="mt-4 text-sm text-red-400">{trainingsError}</div> : null}

          <form onSubmit={submitTraining} className="mt-5 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              type="date"
              className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              value={newTraining.date}
              onChange={(e) => setNewTraining((v) => ({ ...v, date: e.target.value }))}
            />
            <select
              className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              value={newTraining.type}
              onChange={(e) => setNewTraining((v) => ({ ...v, type: e.target.value }))}
            >
              <option value="">类型（自动）</option>
              {TRAINING_TYPE_OPTIONS.map((t) => (
                <option key={`nt-${t}`} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="训练内容（如：反手训练）"
              className="w-full md:col-span-3 bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600"
              value={newTraining.content}
              onChange={(e) =>
                setNewTraining((v) => {
                  const content = e.target.value;
                  const curType = String(v?.type || "").trim();
                  const inferred = inferTrainingTypeFromContent(content);
                  const nextType = curType ? curType : inferred;
                  return { ...v, content, type: nextType };
                })
              }
            />
            <select
              className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              value={newTraining.rating}
              onChange={(e) => setNewTraining((v) => ({ ...v, rating: e.target.value }))}
            >
              <option value="进步">进步</option>
              <option value="持平">持平</option>
              <option value="退步">退步</option>
            </select>

            <div className="w-full md:col-span-2 flex items-center bg-slate-950/30 border border-slate-800 rounded-xl overflow-hidden">
              <div className="shrink-0 px-3 text-sm text-slate-400">时间：</div>
              <input
                type="text"
                inputMode="decimal"
                className="w-full bg-transparent px-3 py-2 text-slate-200 placeholder:text-slate-600 outline-none"
                value={newTraining.durationHours}
                onChange={(e) => setNewTraining((v) => ({ ...v, durationHours: e.target.value }))}
                placeholder="如 1小时30分钟 / 90分钟 / 1.5小时"
                aria-label="训练时间"
              />
            </div>
            <select
              className="w-full md:col-span-2 bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              value={newTraining.difficulty}
              onChange={(e) => setNewTraining((v) => ({ ...v, difficulty: e.target.value }))}
            >
              <option value={1}>难度：简单</option>
              <option value={2}>难度：偏低</option>
              <option value={3}>难度：中等</option>
              <option value={4}>难度：偏高</option>
              <option value={5}>难度：高强度</option>
            </select>
            <div className="hidden md:block md:col-span-2" />
            <input
              type="text"
              placeholder="训练结果/复盘（可选）"
              className="w-full md:col-span-6 bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600"
              value={newTraining.result}
              onChange={(e) => setNewTraining((v) => ({ ...v, result: e.target.value }))}
            />
            <button
              type="submit"
              disabled={
                savingTraining ||
                !newTraining.date ||
                !newTraining.content ||
                !newTraining.rating ||
                !Number.isFinite(parseDurationToHours(newTraining.durationHours)) ||
                parseDurationToHours(newTraining.durationHours) <= 0
              }
              className="md:col-span-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {savingTraining ? <Loader2 className="animate-spin" size={16} /> : <LineChart size={16} />}
              添加训练记录
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {trainingsLoading ? (
              <div className="text-sm text-slate-400">加载中...</div>
            ) : filteredTrainingRecords.length ? (
              filteredTrainingRecords
                .slice()
                .sort((a, b) => num(b?.id, 0) - num(a?.id, 0))
                .map((r) => (
                  <div
                    key={`tr-${r?.id}`}
                    className="relative bg-slate-950/20 border border-slate-800 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-white font-bold min-w-0 truncate">{r?.content || "-"}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-slate-800/60 border-slate-700 text-slate-200">
                          {String(r?.type || inferTrainingTypeFromContent(r?.content) || "其他")}
                        </Badge>
                        <Badge
                          className={
                            r?.rating === "进步"
                              ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-300"
                              : r?.rating === "退步"
                                ? "bg-red-950/30 border-red-900/40 text-red-300"
                                : "bg-slate-800/60 border-slate-700 text-slate-200"
                          }
                        >
                          {r?.rating || "-"}
                        </Badge>
                        <button
                          type="button"
                          title="删除训练记录"
                          aria-label="删除训练记录"
                          onClick={() => deleteTraining(r?.id)}
                          disabled={deletingTrainingId === Number(r?.id)}
                          className="p-2 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-300 hover:border-red-500/40 hover:text-red-200 transition disabled:opacity-50"
                        >
                          {deletingTrainingId === Number(r?.id) ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{r?.date || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      时长：{Math.max(0, num(r?.durationHours, 1))} 小时 · 难度：{difficultyLabel(r?.difficulty)}
                    </div>
                    {r?.result ? <div className="mt-2 text-sm text-slate-300">{r.result}</div> : null}
                  </div>
                ))
            ) : (
              <div className="text-sm text-slate-400">
                {trainingRecords.length ? "当前筛选条件下没有记录。" : "还没有训练记录。"}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Sparkles size={18} className="text-slate-200" />
              AI分析
            </div>
            <div className="text-slate-400 text-sm mt-2">{aiSummary}</div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2">
                <div className="text-slate-500">总时长</div>
                <div className="text-slate-200 font-semibold">
                  {asArray(trainingRecords).reduce((s, r) => s + Math.max(0, num(r?.durationHours, 1)), 0).toFixed(1)}h
                </div>
              </div>
              <div className="bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2">
                <div className="text-slate-500">平均难度</div>
                <div className="text-slate-200 font-semibold">
                  {trainingRecords.length
                    ? (
                        asArray(trainingRecords).reduce(
                          (s, r) => s + Math.max(1, Math.min(5, num(r?.difficulty, 3))),
                          0
                        ) / trainingRecords.length
                      ).toFixed(1)
                    : "-"}
                </div>
              </div>
              <div className="bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2">
                <div className="text-slate-500">最常训练</div>
                <div className="text-slate-200 font-semibold">
                  {trainingStats.typeRank[0]?.type || "-"}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-slate-300 text-sm font-semibold mb-2">训练质量分布</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trainingStats.ratingChart}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="4 4" />
                    <XAxis dataKey="k" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.96)",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                        color: "#e2e8f0",
                      }}
                    />
                    <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                      {trainingStats.ratingChart.map((entry) => (
                        <Cell key={`cell-${entry.k}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {trainingStats.typeRank.length ? (
              <div className="mt-4">
                <div className="text-slate-300 text-sm font-semibold mb-2">训练类型投入（Top3）</div>
                <div className="space-y-2">
                  {trainingStats.typeRank.slice(0, 3).map((t) => (
                    <div
                      key={`trank-${t.type}`}
                      className="flex items-center justify-between text-xs bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2"
                    >
                      <div className="text-slate-200 font-semibold">{t.type}</div>
                      <div className="text-slate-400">{Number(t.hours).toFixed(1)}h</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 bg-slate-950/20 border border-slate-800 rounded-2xl p-4">
              <div className="text-slate-200 font-semibold text-sm">详细报告</div>
              <div className="mt-2 text-sm text-slate-300 space-y-1">
                <div>
                  <span className="text-slate-400">优势：</span>
                  {aiReport.strengths}
                </div>
                <div>
                  <span className="text-slate-400">风险：</span>
                  {aiReport.risks}
                </div>
                <div>
                  <span className="text-slate-400">建议：</span>
                  {aiReport.suggestion}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Target size={18} className="text-slate-200" />
              AI推荐训练
            </div>
            <div className="text-slate-400 text-sm mt-2">
              选择目标后生成 3 条训练任务，可一键填入训练记录。
            </div>

            <div className="mt-4">
              <select
                className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                value={planGoal}
                onChange={(e) => setPlanGoal(e.target.value)}
              >
                <option value="提升发球稳定性">目标：提升发球稳定性</option>
                <option value="增强反手稳定性">目标：增强反手稳定性</option>
                <option value="提高相持稳定性">目标：提高相持稳定性</option>
                <option value="提升步法体能">目标：提升步法体能</option>
              </select>
            </div>

            <div className="mt-4 space-y-3">
              {planTasks.map((task, idx) => (
                <div
                  key={`pt-${idx}`}
                  className="bg-slate-950/20 border border-slate-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-200 font-semibold">
                      {idx + 1}. {task.type} · 难度 {task.difficulty} · {task.durationHours}h
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-200 hover:border-red-500/40 transition"
                      onClick={() =>
                        setNewTraining((v) => ({
                          ...v,
                          type: task.type,
                          content: task.content,
                          durationHours: task.durationHours,
                          difficulty: task.difficulty,
                        }))
                      }
                    >
                      <Wand2 size={14} />
                      填入
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{task.content}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-white font-bold text-lg">AI推荐教练</div>
                <div className="text-slate-400 text-sm mt-1">根据需求计算匹配度推荐</div>
              </div>
            </div>

            <form onSubmit={submitRecommend} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="城市"
                  className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600"
                  value={recommendForm.location}
                  onChange={(e) => setRecommendForm((v) => ({ ...v, location: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="预算"
                  className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-600"
                  value={recommendForm.budget}
                  onChange={(e) => setRecommendForm((v) => ({ ...v, budget: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  value={recommendForm.coachGender}
                  onChange={(e) => setRecommendForm((v) => ({ ...v, coachGender: e.target.value }))}
                >
                  <option value="不限">教练性别：不限</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
                <select
                  className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  value={recommendForm.coachType}
                  onChange={(e) => setRecommendForm((v) => ({ ...v, coachType: e.target.value }))}
                >
                  <option value="不限">教练类型：不限</option>
                  <option value="professional">专业教练</option>
                  <option value="amateur">业余教练</option>
                  <option value="peer">校园陪练</option>
                </select>
              </div>

              <select
                className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                value={recommendForm.trainingGoal}
                onChange={(e) => setRecommendForm((v) => ({ ...v, trainingGoal: e.target.value }))}
              >
                <option value="初学者">训练目标：初学者</option>
                <option value="业余提升">训练目标：业余提升</option>
                <option value="青少年训练">训练目标：青少年训练</option>
                <option value="比赛训练">训练目标：比赛训练</option>
              </select>

              <select
                className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                value={recommendForm.improveSkill}
                onChange={(e) => setRecommendForm((v) => ({ ...v, improveSkill: e.target.value }))}
              >
                <option value="发球">想提升：发球</option>
                <option value="接发球">想提升：接发球</option>
                <option value="正手进攻">想提升：正手进攻</option>
                <option value="反手技术">想提升：反手技术</option>
                <option value="步法训练">想提升：步法训练</option>
                <option value="相持能力">想提升：相持能力</option>
                <option value="战术意识">想提升：战术意识</option>
              </select>

              <select
                className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                value={recommendForm.coachStyle}
                onChange={(e) => setRecommendForm((v) => ({ ...v, coachStyle: e.target.value }))}
              >
                <option value="技术细节型">喜欢风格：技术细节型</option>
                <option value="实战对抗型">喜欢风格：实战对抗型</option>
                <option value="体系训练型">喜欢风格：体系训练型</option>
                <option value="快乐教学型">喜欢风格：快乐教学型</option>
              </select>

              <button
                type="submit"
                disabled={recommendLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 hover:border-red-500/40 hover:bg-slate-800 transition disabled:opacity-50"
              >
                {recommendLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                生成推荐
              </button>

              {recommendError ? <div className="text-sm text-red-400">{recommendError}</div> : null}
            </form>

            {recommended.length ? (
              <div className="mt-4 space-y-3">
                {recommended.map((c) => (
                  <div
                    key={`rec-${c?.id}`}
                    className="bg-slate-950/20 border border-slate-800 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-white font-bold">
                        {c?.name || "教练"}{" "}
                        <span className="text-slate-400 font-normal text-sm">
                          {coachTypeLabel(c?.coachType)}
                        </span>
                      </div>
                      <div className="text-green-400 font-bold">{num(c?.match, 0)}%</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c?.city ? (
                        <Badge className="bg-slate-800/60 border-slate-700 text-slate-200">
                          {c.city}
                        </Badge>
                      ) : null}
                      {recommendForm.improveSkill ? (
                        <Badge className="bg-slate-800/60 border-slate-700 text-slate-200">
                          {recommendForm.improveSkill}
                        </Badge>
                      ) : null}
                      {recommendForm.trainingGoal ? (
                        <Badge className="bg-slate-800/60 border-slate-700 text-slate-200">
                          {recommendForm.trainingGoal}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      推荐原因：{buildRecommendReason(recommendForm, c)}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-slate-200 font-bold">￥{num(c?.price, 0)} / 小时</div>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
                        onClick={() => (onGoCoachMarket ? onGoCoachMarket() : null)}
                      >
                        去预约
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
