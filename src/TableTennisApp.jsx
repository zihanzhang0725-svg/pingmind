import { NAME_ZH_MAP } from "./nameMap";
import MarkdownMessage from "./components/MarkdownMessage";
import StrategicMatrix from "./StrategicMatrix";
import CoachMarket from "./components/CoachMarket";
import BecomeCoach from "./components/BecomeCoach";
import UserTrainingCenter from "./components/UserTrainingCenter";
import CoachDashboard from "./components/CoachDashboard";
import PlaystyleTest from "./pages/PlaystyleTest";
import MatchViewer from "./pages/MatchViewer";
import Login from "./pages/Login";
import Register from "./pages/Register";
import React, { useEffect, useMemo, useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  MessageSquare,
  Users,
  Activity,
  Trophy,
  ChevronLeft,
  TrendingUp,
  Sparkles,
  ShieldAlert,
  MapPin,
  User,
  Menu,
  Filter
} from 'lucide-react';
const LIVESPORT_URL_MAP = {
  "Hugo CALDERANO": "https://www.livesport.com/en/player/calderano-hugo/GSJm6R3k/",
  "Truls MOREGARD": "https://www.livesport.com/en/player/moregard-truls/uBB5LfAm/",
  "HARIMOTO Tomokazu": "https://www.livesport.com/en/player/tomokazu-harimoto/4jk9ZVzK/",
  "LEBRUN Felix": "https://www.livesport.com/en/player/felix-lebrun/0Pfk2VjP/",
  "MATSUSHIMA Sora": "https://www.livesport.com/en/player/sora-matsushima/9mRQepwH/",
  "LIN Yun-Ju": "https://www.livesport.com/en/player/yun-ju-lin/WZekqLLp/",
  "Alexis LEBRUN": "https://www.livesport.com/en/player/alexis-lebrun/JdPkZ56y/",
  "Dang QIU": "https://www.livesport.com/en/player/dang-qiu/4fGKbJ7y/",
  "JANG Woojin": "https://www.livesport.com/en/player/woo-jin-jang/cTBz7vjQ/",
  "Benedikt DUDA": "https://www.livesport.com/en/player/benedikt-duda/xQKdcYbT/",
  // 女选手
  "ZHU Yuling": "https://www.livesport.com/en/player/yuling-zhu/zLfY7d6H/",
  "HARIMOTO Miwa": "https://www.livesport.com/en/player/miwa-harimoto/0T7Rrz3q/",
  "ITO Mima": "https://www.livesport.com/en/player/mima-ito/bbqfQpWw/",
  "HAYATA Hina": "https://www.livesport.com/en/player/hina-hayata/3xPptKF9/",
};
function getLivesportUrl(player) {
  if (!player) return "";
  return (
    player.livesportUrl ||
    LIVESPORT_URL_MAP[player.nameEn || player.name] ||
    ""
  );
}

const CHINA_WOMEN_PHOTO_FILE_MAP = {
  "yingsha sun": "Yingsha Sun.png",
  "manyu wang": "Manyu Wang.png",
  "yidi wang": "Yidi Wang.png",
  "xingtong chen": "Xingtong Chen.png",
  "man kuai": "Man Kuai.png",
  "yi chen": "Yi Chen.png",
  "zhuojia he": "Zhuojia He.png",
  "xunyao shi": "Xunyao Shi.png",
  "yuxuan qin": "Yuxuan Qin.png",
  "weishan liu": "Weishan Liu.png",
  "siqi fan": "Siqi Fan.png",
};

function getPlayerPhotoUrl(player, photoIndex) {
  if (!player) return "";

  const cacheBust = photoIndex?.cacheBust
    ? `?v=${encodeURIComponent(photoIndex.cacheBust)}`
    : "";

  const byKey = photoIndex?.byKey || null;
  if (byKey) {
    const keys = [
      normNameKey(player.nameEn || player.name),
      normNameKey(player.name),
      normNameKey(player.shortName),
    ].filter(Boolean);
    for (const k of keys) {
      const url = byKey[k];
      if (url) return `${url}${cacheBust}`;
    }
  }

  // Back-compat fallback for the original china-women mapping.
  const isChinaWomen = player.country === "CHN" && player.gender === "Female";
  if (isChinaWomen) {
    const key = normNameKey(player.nameEn || player.name);
    const file = CHINA_WOMEN_PHOTO_FILE_MAP[key];
    if (file) return `/player-photos/china-women/${encodeURIComponent(file)}${cacheBust}`;
  }

  return "";
}

function normNameKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SIM_EVENT_WEIGHTS = {
  olympics: { label: "奥运会", mentalFactor: 1.25, expFactor: 1.25 },
  worlds: { label: "世锦赛", mentalFactor: 1.25, expFactor: 1.25 },
  worldCup: { label: "世界杯/总决赛", mentalFactor: 1.1, expFactor: 1.15 },
  wtt: { label: "WTT常规赛", mentalFactor: 1, expFactor: 1 },
  feeder: { label: "支线赛", mentalFactor: 0.9, expFactor: 0.85 },
};

const TAB_PATH_MAP = {
  database: "/",
  analysis: "/analysis",
  matrix: "/strategic-matrix",
  simulator: "/tactical-simulator",
  coachMarket: "/coach-market",
  becomeCoach: "/become-coach",
  coachDashboard: "/coach-dashboard",
  trainingCenter: "/training-center",
  playstyleTest: "/playstyle-test",
  matchViewer: "/match-viewer",
  chat: "/chat",
};

function pathToTab(pathname) {
  switch (pathname) {
    case "/china":
      return "database";
    case "/analysis":
      return "analysis";
    case "/strategic-matrix":
      return "matrix";
    case "/tactical-simulator":
      return "simulator";
    case "/coach-market":
      return "coachMarket";
    case "/become-coach":
      return "becomeCoach";
    case "/coach-dashboard":
      return "coachDashboard";
    case "/training-center":
      return "trainingCenter";
    case "/playstyle-test":
      return "playstyleTest";
    case "/match-viewer":
      return "matchViewer";
    case "/chat":
      return "chat";
    default:
      return "database";
  }
}

// ===== 中文名映射：内置(./nameMap.js) + 你手动补充(本地localStorage) =====
const LS_NAME_MAP_KEY = "ttci_nameZhMap_v1";
function loadUserNameMap() {
  try {
    const raw = localStorage.getItem(LS_NAME_MAP_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function saveUserNameMap(map) {
  try {
    localStorage.setItem(LS_NAME_MAP_KEY, JSON.stringify(map ?? {}));
  } catch {
    // ignore
  }
}

// --- 组件 ---
const ThreatBar = ({ label, score, color = "bg-blue-600" }) => (
  <div className="mb-3">
    <div className="flex justify-between text-sm mb-1 text-slate-400">
      <span>{label}</span>
      <span className="font-mono">
        {Number(score || 0).toFixed(1)}
      </span>
    </div>
    <div className="w-full bg-slate-700 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(Number(score || 0), 100)}%` }}
      ></div>
    </div>
  </div>
);

const ThreatRadar = ({ dimensions = {} }) => {
  const data = [
    { metric: "节奏", fullMetric: "节奏强度", value: Number(dimensions.speed || 0) },
    { metric: "技术", fullMetric: "技术稳定度", value: Number(dimensions.technique || 0) },
    { metric: "战术", fullMetric: "战术执行能力", value: Number(dimensions.tactics || 0) },
    { metric: "决胜", fullMetric: "决胜局稳定性", value: Number(dimensions.mental || 0) },
    { metric: "经验", fullMetric: "高水平赛事经验", value: Number(dimensions.experience || 0) },
    { metric: "对华", fullMetric: "对华对抗能力", value: Number(dimensions.chinaImpact || 0) },
  ];

  return (
    <div className="h-[360px]">
      <div className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="52%" outerRadius="84%">
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="fullMetric"
              tick={{ fill: "#cbd5e1", fontSize: 11 }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickCount={6}
              axisLine={false}
            />
            <RechartsTooltip
              formatter={(value) => [Number(value).toFixed(1), "分值"]}
              contentStyle={{
                background: "rgba(15,23,42,0.96)",
                border: "1px solid #334155",
                borderRadius: "10px",
                color: "#e2e8f0",
              }}
            />
            <Radar
              name="威胁值"
              dataKey="value"
              stroke="#f43f5e"
              fill="#f43f5e"
              fillOpacity={0.24}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const DominanceRadar = ({ dimensions = {} }) => {
  const data = [
    { metric: "技术压制力", value: Number(dimensions.techPressure || 0) },
    { metric: "稳定性", value: Number(dimensions.stability || 0) },
    { metric: "外战控制力", value: Number(dimensions.foreignControl || 0) },
    { metric: "大赛表现评分", value: Number(dimensions.eventPerformanceScore || 0) },
    { metric: "排名强度", value: Number(dimensions.rankingStrength || 0) },
  ];

  return (
    <div className="h-[360px]">
      <div className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="52%" outerRadius="84%">
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "#cbd5e1", fontSize: 11 }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickCount={6}
              axisLine={false}
            />
            <RechartsTooltip
              formatter={(value) => [Number(value).toFixed(1), "分值"]}
              contentStyle={{
                background: "rgba(15,23,42,0.96)",
                border: "1px solid #334155",
                borderRadius: "10px",
                color: "#e2e8f0",
              }}
            />
            <Radar
              name="能力"
              dataKey="value"
              stroke="#38bdf8"
              fill="#38bdf8"
              fillOpacity={0.22}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default function TableTennisApp({ mode = "user", setMode }) {
  const [activeTab, setActiveTab] = useState(() => pathToTab(window.location.pathname));
  const [threatMetrics, setThreatMetrics] = useState({});
  const [dominanceMetrics, setDominanceMetrics] = useState({});
  useEffect(() => {
    fetch("/api/player-threat-metrics")
      .then((res) => res.json())
      .then((data) => {
        setThreatMetrics(data);
      })
      .catch((err) => {
        console.error("加载威胁维度失败:", err);
      });
  }, []);
  useEffect(() => {
    fetch(`/api/player-dominance-metrics?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setDominanceMetrics(data);
      })
      .catch((err) => {
        console.error("加载统治模型失败:", err);
      });
  }, []);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playersData, setPlayersData] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterCountry, setFilterCountry] = useState('All');
  const [filterGender, setFilterGender] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [intelScope, setIntelScope] = useState(
    () => (window.location.pathname === "/china" ? "domestic" : "foreign")
  );
  const [analysisGender, setAnalysisGender] = useState("Male");
  const [simGender, setSimGender] = useState("Male");
  const [simEvent, setSimEvent] = useState("worlds");
  const [simOpponentName, setSimOpponentName] = useState("");
  const [simChinaName, setSimChinaName] = useState("");
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState("");
  const [simLineup, setSimLineup] = useState([]);
  const [simLineupLoading, setSimLineupLoading] = useState(false);
  const [simLineupError, setSimLineupError] = useState("");

  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("tt_auth") : "";
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  });
  const [authView, setAuthView] = useState("login"); // login | register

  const switchTab = (tab, resetPlayer = true) => {
    setActiveTab(tab);
    if (resetPlayer) setSelectedPlayer(null);
    const targetPath = TAB_PATH_MAP[tab] || "/";
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, "", targetPath);
    }
  };
  const setActivePage = (page) => switchTab(page);

  const persistAuthUser = (u) => {
    const safe = u && typeof u === "object" ? { ...u } : null;
    if (safe && "password" in safe) delete safe.password;
    setAuthUser(safe);
    try {
      if (!safe) window.localStorage.removeItem("tt_auth");
      else window.localStorage.setItem("tt_auth", JSON.stringify(safe));
    } catch {
      // ignore storage issues
    }
  };

  const refreshAuthUser = async (id) => {
    const uid = Number(id);
    if (!Number.isFinite(uid) || uid <= 0) return;
    try {
      const resp = await fetch(`/api/users/${encodeURIComponent(uid)}`);
      const data = await resp.json().catch(() => null);
      if (resp.ok && data && typeof data === "object") {
        persistAuthUser(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const userTabs = new Set(["coachMarket", "becomeCoach", "trainingCenter", "coachDashboard", "playstyleTest", "matchViewer"]);
    const proTabs = new Set(["database", "analysis", "matrix", "simulator", "chat"]);

    if (mode === "user" && !userTabs.has(activeTab)) {
      setActivePage("coachMarket");
    } else if (mode === "pro" && !proTabs.has(activeTab)) {
      switchTab("database");
    }
    // Only react to mode changes (avoid loops on activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const onPopState = () => {
      setActiveTab(pathToTab(window.location.pathname));
      if (window.location.pathname === "/china") {
        setIntelScope("domestic");
      } else if (window.location.pathname === "/") {
        setIntelScope("foreign");
      }
      setSelectedPlayer(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 你手动补充的中文名（会保存在浏览器本地，不需要联网）
  const [userNameMap, setUserNameMap] = useState(() => loadUserNameMap());
  useEffect(() => {
    saveUserNameMap(userNameMap);
  }, [userNameMap]);
  useEffect(() => {
    fetch("/api/players")
      .then(async (res) => {
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        if (!Array.isArray(data)) {
          throw new Error("Invalid /api/players response: expected array");
        }
        console.log("加载players:", data.length);
        setPlayersData(data);
      })
      .catch((err) => {
        console.error("加载 /api/players 失败:", err);
        setPlayersData([]);
      });
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch(`/player-photos/manifest.json?ts=${Date.now()}`)
      .then((res) => res.json())
      .then((manifest) => {
        const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
        const byKey = {};
        for (const e of entries) {
          const k = String(e?.key || "").trim();
          const url = String(e?.url || "").trim();
          if (!k || !url) continue;
          if (!byKey[k]) byKey[k] = url;
        }
        if (!cancelled) {
          setPhotoIndex({
            byKey,
            cacheBust: String(manifest?.cacheBust || "").trim(),
          });
        }
      })
      .catch((err) => {
        console.warn("加载头像清单失败: /player-photos/manifest.json", err);
        if (!cancelled) setPhotoIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // 内置映射 + 你补充的映射（你补充的优先）
  const mergedNameMap = useMemo(() => ({ ...NAME_ZH_MAP, ...userNameMap }), [userNameMap]);
  const threatMetricsNorm = useMemo(() => {
    const map = {};
    Object.entries(threatMetrics || {}).forEach(([k, v]) => {
      const nk = normNameKey(k);
      if (nk) map[nk] = v;
    });
    return map;
  }, [threatMetrics]);
  const dominanceMetricsNorm = useMemo(() => {
    const map = {};
    Object.entries(dominanceMetrics || {}).forEach(([k, v]) => {
      const nk = normNameKey(k);
      if (nk) map[nk] = v;
    });
    return map;
  }, [dominanceMetrics]);
    // 根据 threatScore 生成稳定的五维（0-100）——只用于UI展示

  // 给所有选手补齐 nameEn / nameZh（用于“中文主标题 + 英文副标题”显示）
  // 并补齐详情页需要的 style / features / threatDimensions（防止点详情页崩溃）
  const players = useMemo(() => {
    return (playersData || []).map((p) => {
      const nameEn = (p.nameEn ?? p.name ?? "").trim();
      const nameZh = (p.nameZh ?? mergedNameMap[nameEn] ?? mergedNameMap[p.name] ?? "").trim();

      const style = (p.playstyleCN ?? p.style ?? p.styleTag ?? "").trim();
      const features = (p.rationale ?? p.features ?? "").trim();

      // ============================
      // 🔥 用真实威胁维度替换假数据
      // ============================
      const threatData =
        threatMetrics[nameEn] ||
        threatMetrics[p.name] ||
        threatMetricsNorm[normNameKey(nameEn)] ||
        threatMetricsNorm[normNameKey(p.name)] ||
        threatMetricsNorm[normNameKey(p.shortName)] ||
        {};
      const dominanceData =
        dominanceMetrics[nameEn] ||
        dominanceMetrics[p.name] ||
        dominanceMetricsNorm[normNameKey(nameEn)] ||
        dominanceMetricsNorm[normNameKey(p.name)] ||
        dominanceMetricsNorm[normNameKey(p.shortName)] ||
        {};

      const threatDimensions = threatData.metrics || {
        speed: 0,
        technique: 0,
        tactics: 0,
        mental: 0,
        chinaImpact: 0,
        experience: 0,
      };
      const dominanceDimensions = dominanceData.metrics || {
        techPressure: 0,
        stability: 0,
        foreignControl: 0,
        eventPerformanceScore: 0,
        rankingStrength: 0,
      };

      // 如果你想连总威胁分也替换掉
      const threatScore = threatData.threatScore ?? p.threatScore;
      const dominanceScore = dominanceData.dominanceScore ?? p.dominanceScore;
      const dominantWinRate = threatData.dominantWinRate;
      const closeRatio = threatData.closeRatio;
      const closeWinRate = threatData.closeWinRate;
      const intensityRatio = threatData.intensityRatio;
      const deciderMatchesW = threatData.deciderMatchesW;
      return {
        ...p,
        nameEn,
        nameZh,
        style,
        features,
        threatDimensions,
        dominanceDimensions,
        threatScore, // 🔥 这里覆盖原来的
        dominanceScore,
        dominantWinRate,
        closeRatio,
        closeWinRate,
        intensityRatio,
        deciderMatchesW,
      };
    });
  }, [mergedNameMap, threatMetrics, dominanceMetrics, threatMetricsNorm, dominanceMetricsNorm]);


  const upsertNameZh = (nameEn, nameZh) => {
    const key = (nameEn ?? "").trim();
    const val = (nameZh ?? "").trim();
    if (!key) return;
    setUserNameMap((prev) => ({ ...(prev || {}), [key]: val }));
  };
  // 🔥 对华威胁排行榜 Top20（全量，不受筛选影响）
  const threatRanking = useMemo(() => {
    return [...players]
      .filter(p =>
        Number(p.threatScore) > 0 &&
        p.country !== "CHN" &&
        p.gender === analysisGender
      )
      .sort((a, b) => b.threatScore - a.threatScore)
      .slice(0, 10);
  }, [players, analysisGender]);

  const chinaAbilityRanking = useMemo(() => {
    return [...players]
      .filter(
        (p) =>
          p.country === "CHN" &&
          p.gender === analysisGender &&
          Number(p.dominanceScore ?? 0) > 0
      )
      .sort(
        (a, b) => Number(b.dominanceScore ?? 0) - Number(a.dominanceScore ?? 0)
      )
      .slice(0, 10);
  }, [players, analysisGender]);

  const foreignAbilityRanking = useMemo(() => {
    return [...players]
      .filter(
        (p) =>
          p.country !== "CHN" &&
          p.gender === analysisGender &&
          Number(p.dominanceScore ?? 0) > 0
      )
      .sort((a, b) => Number(b.dominanceScore ?? 0) - Number(a.dominanceScore ?? 0))
      .slice(0, 10);
  }, [players, analysisGender]);

  const simForeignPlayers = useMemo(() => {
    return [...players]
      .filter((p) => p.country !== "CHN" && p.gender === simGender)
      .filter((p) => Number(p.dominanceScore || 0) > 0)
      .sort((a, b) => Number(b.dominanceScore || 0) - Number(a.dominanceScore || 0));
  }, [players, simGender]);

  const simChinaPlayers = useMemo(() => {
    return [...players]
      .filter((p) => p.country === "CHN" && p.gender === simGender)
      .filter((p) => Number(p.dominanceScore || 0) > 0)
      .sort((a, b) => Number(b.dominanceScore || 0) - Number(a.dominanceScore || 0));
  }, [players, simGender]);

  useEffect(() => {
    if (!simForeignPlayers.length) {
      setSimOpponentName("");
      return;
    }
    if (!simForeignPlayers.some((p) => p.nameEn === simOpponentName)) {
      setSimOpponentName(simForeignPlayers[0].nameEn);
    }
  }, [simForeignPlayers, simOpponentName]);

  useEffect(() => {
    if (!simChinaPlayers.length) {
      setSimChinaName("");
      return;
    }
    if (!simChinaPlayers.some((p) => p.nameEn === simChinaName)) {
      setSimChinaName(simChinaPlayers[0].nameEn);
    }
  }, [simChinaPlayers, simChinaName]);

  useEffect(() => {
    const opp = simForeignPlayers.find((p) => p.nameEn === simOpponentName);
    const us = simChinaPlayers.find((p) => p.nameEn === simChinaName);
    if (!opp || !us) {
      setSimResult(null);
      setSimLineup([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setSimLoading(true);
      setSimLineupLoading(true);
      setSimError("");
      setSimLineupError("");
      try {
        const foreignName = opp.nameEn || opp.name;
        const chinaName = us.nameEn || us.name;
        const chinaPoolNames = simChinaPlayers.map((p) => p.nameEn || p.name).filter(Boolean);

        const [matchResp, lineupResp] = await Promise.all([
          fetch("/api/matchup-predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ foreignName, chinaName, eventKey: simEvent, foreignUseDominance: true }),
          }),
          fetch("/api/lineup-recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ foreignName, eventKey: simEvent, chinaPoolNames, topN: 10, foreignUseDominance: true }),
          }),
        ]);

        const matchData = await matchResp.json().catch(() => ({}));
        const lineupData = await lineupResp.json().catch(() => ({}));
        if (!matchResp.ok) {
          throw new Error(matchData?.error || matchData?.message || `HTTP ${matchResp.status}`);
        }
        if (!cancelled) {
          setSimResult({ opp, us, ...matchData });
        }
        if (!cancelled) {
          if (lineupResp.ok) {
            setSimLineup(Array.isArray(lineupData?.rankings) ? lineupData.rankings : []);
          } else {
            setSimLineup([]);
            setSimLineupError(lineupData?.error || lineupData?.message || `HTTP ${lineupResp.status}`);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSimResult(null);
          setSimError(err?.message || "预测失败");
          setSimLineup([]);
        }
      } finally {
        if (!cancelled) setSimLoading(false);
        if (!cancelled) setSimLineupLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [simOpponentName, simChinaName, simEvent, simForeignPlayers, simChinaPlayers]);

  const intelligencePlayers = useMemo(() => {
    if (intelScope === "domestic") {
      return (players || []).filter((p) => p.country === "CHN");
    }
    return (players || []).filter((p) => p.country !== "CHN");
  }, [players, intelScope]);

  const availableCountries = useMemo(() => {
    return Array.from(new Set(intelligencePlayers.map((p) => p.country))).sort();
  }, [intelligencePlayers]);

  const filteredPlayers = intelligencePlayers.filter((p) => {
    const matchCountry = filterCountry === "All" || p.country === filterCountry;
    const matchGender = filterGender === "All" || p.gender === filterGender;

    const qRaw = searchQuery.trim();
    if (!qRaw) return matchCountry && matchGender;

    const qLower = qRaw.toLowerCase();
    const nameEnLower = (p.nameEn || p.name || "").toLowerCase();
    const nameRawLower = (p.name || "").toLowerCase();
    const nameZh = p.nameZh || mergedNameMap[p.nameEn] || mergedNameMap[p.name] || "";

    const matchSearch =
      nameEnLower.includes(qLower) ||
      nameRawLower.includes(qLower) ||
      (nameZh && nameZh.includes(qRaw));

    return matchCountry && matchGender && matchSearch;
  }, [players]);

  if (!authUser) {
    if (authView === "register") {
      return (
        <Register
          onRegistered={(u) => {
            persistAuthUser(u);
            setActivePage("trainingCenter");
          }}
          onGoLogin={() => setAuthView("login")}
        />
      );
    }

    return (
      <Login
        onLogin={(u) => {
          persistAuthUser(u);
          setActivePage("trainingCenter");
        }}
        onGoRegister={() => setAuthView("register")}
      />
    );
  }

  const Sidebar = () => (
    <div
      className={`${
        sidebarOpen ? 'w-64' : 'w-20'
      } bg-slate-900 text-white transition-all duration-300 flex flex-col border-r border-slate-800 h-screen fixed left-0 top-0 z-50`}
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        {sidebarOpen && (
          <div className="font-bold text-xl text-red-500 flex items-center gap-2">
            <Activity size={20} /> 乒乓智库
          </div>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 hover:bg-slate-800 rounded"
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="flex-1 py-6 px-2 space-y-2">
        {mode === "user" ? (
          <>
            <NavButton
              icon={<Users />}
              label="教练平台"
              active={activeTab === "coachMarket" || activeTab === "becomeCoach"}
              onClick={() => setActivePage("coachMarket")}
              isOpen={sidebarOpen}
            />
            <NavButton
              icon={<TrendingUp />}
              label="用户训练中心"
              active={activeTab === "trainingCenter"}
              onClick={() => setActivePage("trainingCenter")}
              isOpen={sidebarOpen}
            />
            {authUser?.role === "coach" ? (
              <NavButton
                icon={<User />}
                label="教练工作台"
                active={activeTab === "coachDashboard"}
                onClick={() => setActivePage("coachDashboard")}
                isOpen={sidebarOpen}
              />
            ) : null}
            <NavButton
              icon={<Activity />}
              label="打法人格测试"
              active={activeTab === "playstyleTest"}
              onClick={() => setActivePage("playstyleTest")}
              isOpen={sidebarOpen}
            />
            <NavButton
              icon={<Trophy />}
              label="赛事观赛助手"
              active={activeTab === "matchViewer"}
              onClick={() => setActivePage("matchViewer")}
              isOpen={sidebarOpen}
            />
          </>
        ) : (
          <>
            <NavButton
              icon={<Users />}
              label="情报库"
              active={activeTab === "database"}
              onClick={() => switchTab("database")}
              isOpen={sidebarOpen}
            />
            <NavButton
              icon={<ShieldAlert />}
              label="梯队分析 (100人)"
              active={activeTab === "analysis"}
              onClick={() => switchTab("analysis")}
              isOpen={sidebarOpen}
            />
            <NavButton
              icon={<MapPin />}
              label="📊 战略矩阵分析"
              active={activeTab === "matrix"}
              onClick={() => switchTab("matrix")}
              isOpen={sidebarOpen}
            />
            <NavButton
              icon={<Trophy />}
              label="战术模拟中心"
              active={activeTab === "simulator"}
              onClick={() => switchTab("simulator", false)}
              isOpen={sidebarOpen}
            />
            <NavButton
              icon={<MessageSquare />}
              label="战术AI助手"
              active={activeTab === "chat"}
              onClick={() => switchTab("chat", false)}
              isOpen={sidebarOpen}
            />
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        {sidebarOpen ? (
          <div className="text-xs text-slate-400">
            当前账号：{" "}
            <span className="text-slate-200">
              {authUser?.username || authUser?.name || "-"}
            </span>
            <span className="mx-2 text-slate-600">•</span>
            <span className="text-slate-300">{authUser?.role === "coach" ? "教练" : "用户"}</span>
          </div>
        ) : null}

        <button
          type="button"
          className="mt-3 w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
          onClick={() => {
            persistAuthUser(null);
            setAuthView("login");
          }}
        >
          退出登录
        </button>

        {sidebarOpen ? (
          <div className="mt-3 text-[10px] text-slate-500">
            数据版本：2024-2025 v2.0 · 男单50+女单50全覆盖
          </div>
        ) : null}
      </div>
    </div>
  );

  const NavButton = ({ icon, label, active, onClick, isOpen }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center p-3 rounded-lg transition-colors ${
        active
          ? 'bg-red-600 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span className="text-xl">{icon}</span>
      {isOpen && <span className="ml-3 font-medium whitespace-nowrap">{label}</span>}
    </button>
  );
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-200">
      <Sidebar />

      <main className={`${sidebarOpen ? "pl-64" : "pl-20"} transition-all duration-300`}>
        <div className="sticky top-0 z-40 bg-slate-950/40 backdrop-blur border-b border-slate-900/60">
          <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center justify-end">
            <select
              value={mode}
              onChange={(e) => (setMode ? setMode(e.target.value) : null)}
              className="bg-slate-800 text-white px-3 py-1 rounded border border-slate-700"
            >
              <option value="user">训练服务</option>
              <option value="pro">竞技分析</option>
            </select>
          </div>
        </div>
        {activeTab === "database" ? (
          selectedPlayer ? (
            <PlayerDetail
              player={selectedPlayer}
              players={players}
              photoIndex={photoIndex}
              onBack={() => setSelectedPlayer(null)}
              onSetNameZh={upsertNameZh}
              onJumpToPlayer={(p) => setSelectedPlayer(p)}
            />
          ) : (
            <div className="p-8 max-w-[1400px] mx-auto">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-black text-white">
                    {intelScope === "domestic" ? "中国队员库" : "对手情报库"}
                  </h1>
                  <p className="text-slate-400 mt-2 text-sm">
                    {intelScope === "domestic"
                      ? "国内/国外可切换，支持按性别与中英文搜索，点击卡片进入详情页"
                      : "国内/国外可切换，支持按国家/性别过滤 + 中英文搜索，点击卡片进入详情页"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIntelScope("foreign");
                        setFilterCountry("All");
                        setSelectedPlayer(null);
                      }}
                      className={`px-4 py-2 rounded-xl text-sm transition ${
                        intelScope === "foreign"
                          ? "bg-red-600 text-white"
                          : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-red-500/40"
                      }`}
                    >
                      国外
                    </button>
                    <button
                      onClick={() => {
                        setIntelScope("domestic");
                        setFilterCountry("All");
                        setSelectedPlayer(null);
                      }}
                      className={`px-4 py-2 rounded-xl text-sm transition ${
                        intelScope === "domestic"
                          ? "bg-red-600 text-white"
                          : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-red-500/40"
                      }`}
                    >
                      国内
                    </button>
                  </div>
                  <div className="text-sm text-slate-400">
                    共 <span className="text-white font-bold">{filteredPlayers.length}</span> 人
                  </div>
                </div>
              </div>

              {/* 过滤栏 */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Filter size={16} />
                    筛选
                  </div>

                  <select
                    value={filterGender}
                    onChange={(e) => setFilterGender(e.target.value)}
                    className="bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none text-slate-200"
                  >
                    <option value="All">全部性别</option>
                    <option value="Male">男单</option>
                    <option value="Female">女单</option>
                  </select>

                  {intelScope === "foreign" ? (
                    <select
                      value={filterCountry}
                      onChange={(e) => setFilterCountry(e.target.value)}
                      className="bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none text-slate-200"
                    >
                      <option value="All">全部国家</option>
                      {availableCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索：英文名 / 中文名"
                    className="flex-1 min-w-[220px] bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none text-slate-200 placeholder:text-slate-500"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setFilterCountry("All");
                      setFilterGender("All");
                      setSearchQuery("");
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-red-500/40 hover:bg-slate-800 transition text-sm"
                  >
                    重置
                  </button>
                </div>
              </div>

              {/* 列表卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayer(p)}
                    className="text-left bg-slate-900/40 border border-slate-800 rounded-2xl p-4 hover:border-red-500/40 hover:bg-slate-900/60 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-white text-[16px] leading-[22px]">
                          {p.nameZh || p.nameEn || p.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{p.nameEn || p.name}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-400">WR#{p.ranking}</div>
                        <div className="mt-1 text-xs px-2 py-1 rounded-full border border-red-900/40 bg-red-900/20 text-red-300 inline-block">
                          {p.tier}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 mt-3">
                      {p.country} · {p.gender === "Male" ? "男单" : "女单"} ·
                      {intelScope === "domestic" ? " 指数 " : " 威胁分 "}
                      {Number(
                        intelScope === "domestic"
                          ? (p.dominanceScore ?? p.threatScore ?? 0)
                          : (p.threatScore ?? 0)
                      ).toFixed(2)}
                    </div>

                    <div className="text-sm text-slate-300 mt-2 line-clamp-2">
                      {p.style || p.styleTag || "（暂无打法标签）"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : activeTab === "analysis" ? (
          <div className="p-8 max-w-[1500px] mx-auto">

            {/* 标题 + 切换按钮 */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-black text-white">
                排行榜 - {analysisGender === "Male" ? "男单" : "女单"} Top10
              </h1>
              <div className="flex gap-3">
                <button
                  onClick={() => setAnalysisGender("Male")}
                  className={`px-4 py-2 rounded-xl text-sm transition ${
                    analysisGender === "Male"
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-red-500/40"
                  }`}
                >
                  男单
                </button>

                <button
                  onClick={() => setAnalysisGender("Female")}
                  className={`px-4 py-2 rounded-xl text-sm transition ${
                    analysisGender === "Female"
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-red-500/40"
                  }`}
                >
                  女单
                </button>
              </div>
            </div>
            {/* 三栏排行榜 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="bg-slate-900/35 border border-slate-800 rounded-2xl p-4">
                <h2 className="text-xl font-black text-white mb-4">
                  对华威胁排行榜
                </h2>
                <div className="space-y-3">
                  {threatRanking.map((p, index) => (
                    <div
                      key={`threat-${p.id}`}
                      onClick={() => setSelectedPlayer(p)}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition
                        ${
                          index < 3
                            ? "bg-red-900/20 border-red-900/40"
                            : "bg-slate-900/40 border-slate-800 hover:border-red-500/40"
                        }`}
                    >
                      <div>
                        <div className="text-white font-bold">
                          {index + 1}. {p.nameZh || p.nameEn}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {p.country} · {analysisGender === "Male" ? "男单" : "女单"}
                        </div>
                      </div>

                      <div className="text-red-400 font-mono text-lg font-bold">
                        {Number(p.threatScore).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/35 border border-slate-800 rounded-2xl p-4">
                <h2 className="text-xl font-black text-white mb-4">
                  外国选手能力排行榜
                </h2>
                {foreignAbilityRanking.length === 0 ? (
                  <div className="text-sm text-slate-400 px-1 py-2">
                    当前分组暂无外国选手能力数据
                  </div>
                ) : (
                  <div className="space-y-3">
                    {foreignAbilityRanking.map((p, index) => (
                      <div
                        key={`foreign-ability-${p.id}`}
                        onClick={() => setSelectedPlayer(p)}
                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition
                          ${
                            index < 3
                              ? "bg-cyan-900/20 border-cyan-900/40"
                              : "bg-slate-900/40 border-slate-800 hover:border-cyan-500/40"
                          }`}
                      >
                        <div>
                          <div className="text-white font-bold">
                            {index + 1}. {p.nameZh || p.nameEn}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {p.country} · {analysisGender === "Male" ? "男单" : "女单"}
                          </div>
                        </div>

                        <div className="text-cyan-300 font-mono text-lg font-bold">
                          {Number(p.dominanceScore ?? 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/35 border border-slate-800 rounded-2xl p-4">
                <h2 className="text-xl font-black text-white mb-4">
                  中国选手能力排行榜
                </h2>
                {chinaAbilityRanking.length === 0 ? (
                  <div className="text-sm text-slate-400 px-1 py-2">
                    当前分组暂无中国选手能力数据
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chinaAbilityRanking.map((p, index) => (
                      <div
                        key={`china-${p.id}`}
                        onClick={() => setSelectedPlayer(p)}
                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition
                          ${
                            index < 3
                              ? "bg-emerald-900/20 border-emerald-900/40"
                              : "bg-slate-900/40 border-slate-800 hover:border-emerald-500/40"
                          }`}
                      >
                        <div>
                          <div className="text-white font-bold">
                            {index + 1}. {p.nameZh || p.nameEn}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {p.country} · {analysisGender === "Male" ? "男单" : "女单"}
                          </div>
                        </div>

                        <div className="text-emerald-400 font-mono text-lg font-bold">
                          {Number(p.dominanceScore ?? 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "coachMarket" ? (
          <CoachMarket
            userId={authUser?.id || 1}
            onBecomeCoach={() => setActivePage("becomeCoach")}
          />
        ) : activeTab === "becomeCoach" ? (
          <BecomeCoach
            onBack={() => setActivePage("coachMarket")}
            userId={authUser?.id || 1}
            onSubmitted={(coach, updatedUser) => {
              if (updatedUser) persistAuthUser(updatedUser);
              else refreshAuthUser(authUser?.id);
              setActivePage("coachMarket");
            }}
          />
        ) : activeTab === "coachDashboard" ? (
          <CoachDashboard
            coachId={authUser?.coachId}
            coachName={authUser?.username || authUser?.name}
          />
        ) : activeTab === "trainingCenter" ? (
          <UserTrainingCenter
            userId={authUser?.id || 1}
            onGoCoachMarket={() => setActivePage("coachMarket")}
          />
        ) : activeTab === "playstyleTest" ? (
          <PlaystyleTest />
        ) : activeTab === "matchViewer" ? (
          <MatchViewer
            players={players}
            threatMetrics={threatMetrics}
            dominanceMetrics={dominanceMetrics}
          />
        ) : activeTab === "matrix" ? (
          <StrategicMatrix
            dominanceMetrics={dominanceMetrics}
            threatMetrics={threatMetrics}
            nameZhMap={mergedNameMap}
            players={players}
          />
        ) : activeTab === "simulator" ? (
          <TacticalSimulatorPanel
            gender={simGender}
            onGenderChange={setSimGender}
            eventKey={simEvent}
            onEventChange={setSimEvent}
            foreignOptions={simForeignPlayers}
            chinaOptions={simChinaPlayers}
            foreignName={simOpponentName}
            chinaName={simChinaName}
            onForeignNameChange={setSimOpponentName}
            onChinaNameChange={setSimChinaName}
            result={simResult}
            loading={simLoading}
            error={simError}
            lineup={simLineup}
            lineupLoading={simLineupLoading}
            lineupError={simLineupError}
          />
        ) : activeTab === "chat" ? (
          <ChatPanel selectedPlayer={selectedPlayer} players={players} onPickPlayer={(p) => setSelectedPlayer(p)} />
        ):null}

      </main>
    </div>
  );
}

const RISK_TIPS_MAP = {
  strength: "基础强度偏弱，建议以发接发抢前三板争取先手，避免纯相持硬碰硬。",
  winRate: "稳定性略弱，建议降低无谓失误，优先执行高成功率线路。",
  closeWin: "关键分能力偏弱，建议固定关键分战术并强化发球后第一板质量。",
  mental: "心理抗压处于下风，建议赛前预案化处理暂停、擦边/擦网和比分波动。",
  experience: "大赛经验不足，建议增加高压情境模拟，提前演练落后追分局。",
  chinaImpact: "对华克制维度不占优，建议提升落点变化和节奏切换，减少被反制概率。",
};

const DEFAULT_RISK_TIP = "该风险项来自规则或新特征维度，建议结合当场战术录像做针对性拆解。";

const TacticalSimulatorPanel = ({
  gender,
  onGenderChange,
  eventKey,
  onEventChange,
  foreignOptions = [],
  chinaOptions = [],
  foreignName,
  chinaName,
  onForeignNameChange,
  onChinaNameChange,
  result,
  loading,
  error,
  lineup = [],
  lineupLoading,
  lineupError,
}) => {
  const event = SIM_EVENT_WEIGHTS[eventKey] || SIM_EVENT_WEIGHTS.wtt;
  const [simAiMessages, setSimAiMessages] = useState([
    {
      role: "assistant",
      content: "等待对阵结果后，将基于当前模拟自动生成战术建议。",
    },
  ]);
  const [simAiInput, setSimAiInput] = useState("");
  const [simAiLoading, setSimAiLoading] = useState(false);
  const [simAiError, setSimAiError] = useState("");

  const lineupNameMap = useMemo(() => {
    const m = new Map();
    chinaOptions.forEach((p) => {
      m.set(p.nameEn || p.name, p.nameZh || p.nameEn || p.name);
    });
    return m;
  }, [chinaOptions]);

  const scoreClass = (v) => {
    const n = Number(v || 0);
    if (n >= 60) return "text-emerald-300";
    if (n >= 50) return "text-yellow-300";
    return "text-red-300";
  };

  const lineupSig = useMemo(() => {
    return (lineup || [])
      .map((it) => `${it.name}:${Number(it.winPct ?? it.chinaWinPct ?? 0).toFixed(2)}`)
      .join("|");
  }, [lineup]);

  const buildScenarioPrompt = (userTask) => {
    const oppName = result?.opp?.nameZh || result?.opp?.nameEn || "未知对手";
    const usName = result?.us?.nameZh || result?.us?.nameEn || "未知选手";
    const risks = (result?.biggestRisks || [])
      .map((r) => `${r.label}:${Number(r.value || 0).toFixed(2)}`)
      .join("；") || "无显著风险";
    const topLineup = (lineup || [])
      .slice(0, 5)
      .map((it, idx) => {
        const name = lineupNameMap.get(it.name) || it.name;
        const pct = Number(it.winPct ?? it.chinaWinPct ?? 0).toFixed(1);
        return `${idx + 1}. ${name} ${pct}%`;
      })
      .join("\n");

    return [
      "请严格基于以下模拟数据生成战术建议，不要虚构数据。",
      `赛事: ${event.label}`,
      `对手: ${oppName}`,
      `我方当前出场: ${usName}`,
      `中国胜率: ${Number(result?.chinaWinPct || 0).toFixed(1)}%`,
      `对手胜率: ${Number(result?.foreignWinPct || 0).toFixed(1)}%`,
      `综合得分: ${Number(result?.matchScore || 0).toFixed(2)}`,
      `风险项: ${risks}`,
      "推荐出场Top5:",
      topLineup || "暂无",
      "",
      `任务: ${userTask}`,
      "输出结构：1) 关键判断 2) 三条可执行战术 3) 是否建议调整出场人与理由。",
    ].join("\n");
  };

  const askSimAi = async (userTask, mode = "append") => {
    if (!result) return;
    setSimAiError("");
    setSimAiLoading(true);
    try {
      const question = buildScenarioPrompt(userTask);
      if (mode === "replace") {
        setSimAiMessages([
          { role: "assistant", content: "正在根据最新模拟结果生成建议..." },
        ]);
      } else {
        setSimAiMessages((prev) => [...prev, { role: "user", content: userTask }]);
      }

      const resp = await fetch("/api/tt-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          player: result?.opp || null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${resp.status}`);
      }
      const content = data?.answer || "（无内容返回）";
      if (mode === "replace") {
        setSimAiMessages([{ role: "assistant", content }]);
      } else {
        setSimAiMessages((prev) => [...prev, { role: "assistant", content }]);
      }
    } catch (err) {
      setSimAiError(err?.message || "AI建议生成失败");
      if (mode === "append") {
        setSimAiMessages((prev) => [
          ...prev,
          { role: "assistant", content: `请求失败：${err?.message || "未知错误"}` },
        ]);
      } else {
        setSimAiMessages([
          { role: "assistant", content: `请求失败：${err?.message || "未知错误"}` },
        ]);
      }
    } finally {
      setSimAiLoading(false);
    }
  };

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      askSimAi("请基于当前模拟结果给出实时战术建议。", "replace");
    }, 300);
    return () => clearTimeout(timer);
  }, [
    result?.opp?.nameEn,
    result?.us?.nameEn,
    result?.matchScore,
    eventKey,
    lineupSig,
  ]);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white">战术模拟中心</h1>
        <p className="text-slate-400 mt-2 text-sm">
          输入赛事类型 + 对手 + 我方出战人，输出单场胜率、风险项和战术提示
        </p>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <label className="text-sm text-slate-300">
            单项组别
            <select
              value={gender}
              onChange={(e) => onGenderChange(e.target.value)}
              className="mt-2 w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              <option value="Male">男单</option>
              <option value="Female">女单</option>
            </select>
          </label>

          <label className="text-sm text-slate-300">
            赛事类型
            <select
              value={eventKey}
              onChange={(e) => onEventChange(e.target.value)}
              className="mt-2 w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              {Object.entries(SIM_EVENT_WEIGHTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            对手出场
            <select
              value={foreignName}
              onChange={(e) => onForeignNameChange(e.target.value)}
              className="mt-2 w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              {foreignOptions.map((p) => (
                <option key={`opp-${p.nameEn}`} value={p.nameEn}>
                  {(p.nameZh || p.nameEn) + ` · ${p.country} · Dom ${Number(p.dominanceScore || 0).toFixed(1)}`}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            我方出场
            <select
              value={chinaName}
              onChange={(e) => onChinaNameChange(e.target.value)}
              className="mt-2 w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              {chinaOptions.map((p) => (
                <option key={`chn-${p.nameEn}`} value={p.nameEn}>
                  {(p.nameZh || p.nameEn) + ` · CHN · Dom ${Number(p.dominanceScore || 0).toFixed(1)}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          当前赛事权重: mental x{event.mentalFactor.toFixed(2)} / experience x{event.expFactor.toFixed(2)}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">正在计算预测结果...</div>
      ) : error ? (
        <div className="text-red-300 text-sm">{error}</div>
      ) : !result ? (
        <div className="text-slate-400 text-sm">当前分组暂无可用对阵数据</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">中国选手胜率</div>
              <div className="text-4xl font-black text-emerald-400">
                {result.chinaWinPct.toFixed(1)}%
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {result.us.nameZh || result.us.nameEn}
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">对手胜率</div>
              <div className="text-4xl font-black text-red-400">
                {result.foreignWinPct.toFixed(1)}%
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {result.opp.nameZh || result.opp.nameEn}
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">对阵综合得分</div>
              <div className={`text-4xl font-black ${result.matchScore >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {result.matchScore.toFixed(2)}
              </div>
              <div className="text-sm text-slate-400 mt-1">{result.event.label}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">基础模型得分</div>
              <div className={`text-2xl font-black ${Number(result.baseScore || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {Number(result.baseScore || 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">规则修正得分</div>
              <div className={`text-2xl font-black ${Number(result.adjScore || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {Number(result.adjScore || 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs text-slate-500 mb-2">估算单局胜率 pGame</div>
              <div className="text-2xl font-black text-white">
                {Number((result.pGame || 0) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-white font-bold mb-3">六维贡献分解</div>
              <div className="space-y-3">
                {result.contributions.map((it) => (
                  <div key={it.key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-300">{it.label}</span>
                      <span className={it.value >= 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                        {it.value >= 0 ? "+" : ""}{it.value.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${it.value >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(Math.abs(it.value) * 2.5, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-white font-bold mb-3">风险提示与策略建议</div>
              {result.biggestRisks.length === 0 ? (
                <div className="text-sm text-emerald-300">主要维度均占优，可按常规高压推进节奏执行。</div>
              ) : (
                <div className="space-y-3">
                  {result.biggestRisks.map((it) => (
                    <div key={`risk-${it.key}`} className="rounded-xl border border-red-900/40 bg-red-900/20 p-3">
                      <div className="text-sm text-red-300 font-semibold">
                        {it.label} ({it.value.toFixed(2)})
                      </div>
                      <div className="text-sm text-slate-200 mt-1">
                        {RISK_TIPS_MAP[it.key] || DEFAULT_RISK_TIP}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-white font-bold mb-3">阈值规则修正 (Adjustments)</div>
              {!Array.isArray(result.adjustments) || result.adjustments.length === 0 ? (
                <div className="text-sm text-slate-400">当前对阵未触发额外规则修正。</div>
              ) : (
                <div className="space-y-3">
                  {result.adjustments.map((it, idx) => (
                    <div key={`adj-${it.key || idx}`} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-200 font-semibold">{it.label || it.key}</div>
                        <div className={Number(it.value || 0) >= 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                          {Number(it.value || 0) >= 0 ? "+" : ""}{Number(it.value || 0).toFixed(2)}
                        </div>
                      </div>
                      {it.reason ? <div className="text-sm text-slate-400 mt-1">{it.reason}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-white font-bold mb-3">BO5比分概率</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 p-3">
                  <div className="text-xs text-emerald-300 mb-2">中国取胜</div>
                  <div className="text-sm text-slate-200">3-0: {Number((result.scoreline?.china?.["3-0"] || 0) * 100).toFixed(1)}%</div>
                  <div className="text-sm text-slate-200">3-1: {Number((result.scoreline?.china?.["3-1"] || 0) * 100).toFixed(1)}%</div>
                  <div className="text-sm text-slate-200">3-2: {Number((result.scoreline?.china?.["3-2"] || 0) * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3">
                  <div className="text-xs text-red-300 mb-2">对手取胜</div>
                  <div className="text-sm text-slate-200">0-3: {Number((result.scoreline?.foreign?.["0-3"] || 0) * 100).toFixed(1)}%</div>
                  <div className="text-sm text-slate-200">1-3: {Number((result.scoreline?.foreign?.["1-3"] || 0) * 100).toFixed(1)}%</div>
                  <div className="text-sm text-slate-200">2-3: {Number((result.scoreline?.foreign?.["2-3"] || 0) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="text-white font-bold mb-3">推荐出场排序</div>
              {lineupLoading ? (
                <div className="text-sm text-slate-400">正在计算阵容推荐...</div>
              ) : lineupError ? (
                <div className="text-sm text-red-300">{lineupError}</div>
              ) : !lineup.length ? (
                <div className="text-sm text-slate-400">暂无推荐结果</div>
              ) : (
                <div className="space-y-2">
                  {lineup.map((it, idx) => {
                    const isCurrent = (it.name || "") === (chinaName || "");
                    const displayName = lineupNameMap.get(it.name) || it.name;
                    const winPct = Number(it.winPct ?? it.chinaWinPct ?? 0);
                    return (
                      <div
                        key={`lineup-${it.name}-${idx}`}
                        className={`rounded-xl border px-3 py-2 flex items-center justify-between ${
                          isCurrent ? "border-blue-600/60 bg-blue-900/20" : "border-slate-700 bg-slate-900/40"
                        }`}
                      >
                        <div className="text-sm text-slate-100">
                          <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded bg-blue-600/90 text-white font-bold text-xs">
                            {idx + 1}
                          </span>
                          {displayName}
                          {isCurrent ? <span className="ml-2 text-xs text-blue-300">当前出场</span> : null}
                        </div>
                        <div className={`font-mono font-semibold ${scoreClass(winPct)}`}>
                          {winPct.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 text-xs text-slate-500">
                颜色规则：{">=60% 绿色，50%~60% 黄色，<50% 红色"}
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-bold">战术AI建议（DeepSeek）</div>
                <button
                  type="button"
                  onClick={() => askSimAi("请重新评估并更新本场战术建议。", "replace")}
                  disabled={simAiLoading || !result}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:border-blue-500/50 disabled:opacity-50"
                >
                  重新生成
                </button>
              </div>

              <div className="h-[360px] overflow-auto space-y-3 pr-1">
                {simAiMessages.map((m, idx) => (
                  <div
                    key={`sim-ai-${idx}`}
                    className={`rounded-xl border px-3 py-2 ${
                      m.role === "user"
                        ? "ml-8 bg-blue-900/20 border-blue-900/40 text-slate-100 text-sm"
                        : "mr-2 bg-slate-950/40 border-slate-800 text-sm"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <MarkdownMessage content={m.content} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    )}
                  </div>
                ))}
                {simAiLoading ? (
                  <div className="mr-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
                    正在生成建议...
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={simAiInput}
                  onChange={(e) => setSimAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const q = simAiInput.trim();
                      if (!q || simAiLoading || !result) return;
                      setSimAiInput("");
                      askSimAi(q, "append");
                    }
                  }}
                  placeholder="继续追问本场策略（回车发送）"
                  className="flex-1 bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none text-slate-200 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const q = simAiInput.trim();
                    if (!q || simAiLoading || !result) return;
                    setSimAiInput("");
                    askSimAi(q, "append");
                  }}
                  disabled={simAiLoading || !result}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold"
                >
                  发送
                </button>
              </div>
              {simAiError ? (
                <div className="mt-2 text-xs text-red-300">{simAiError}</div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ChatPanel = ({ selectedPlayer, players, onPickPlayer }) => {
  const [playerId, setPlayerId] = useState(selectedPlayer?.id ?? "");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "我是战术AI助手。你可以选择一个对手，然后问我：最近状态、打法特点、对战策略、封闭训练建议等。",
    },
  ]);

  // 同步外部选择的球员
  useEffect(() => {
    if (selectedPlayer?.id) setPlayerId(selectedPlayer.id);
  }, [selectedPlayer?.id]);

  const currentPlayer = useMemo(() => {
    const idNum = Number(playerId);
    return players.find((p) => p.id === idNum) || null;
  }, [playerId, players]);

  const quickAsk = (q) => {
    setInput(q);
  };

  const send = async () => {
    const q = input.trim();
    if (!q) return;

    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("/api/tt-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, player: currentPlayer }),
    });

    let data = {};
    try {
      data = await resp.json();
    } catch {
      data = {};
    }

    if (!resp.ok) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `后端报错：${data.message || data.error || resp.status}` },
      ]);
      return;
    }

    setMessages((m) => [
      ...m,
      { role: "assistant", content: data.answer || "（无内容返回）" },
    ]);

    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "请求失败：请检查后端是否在运行（3001）" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-black text-white">战术AI助手</h1>
          <p className="mt-2 text-slate-400">
            选择对手后提问：状态、战绩（后续接比赛库）、打法拆解、对战策略、训练建议等
          </p>
        </div>
      </div>

      {/* 顶部选择对手 */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-slate-200 min-w-[260px]"
          >
            <option value="">（先选择对手）</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.nameZh || p.nameEn || p.name) + ` · ${p.country} · WR#${p.ranking}`}
              </option>
            ))}
          </select>

          <div className="text-sm text-slate-400">
            当前：{" "}
            <span className="text-white font-bold">
              {currentPlayer ? (currentPlayer.nameZh || currentPlayer.nameEn || currentPlayer.name) : "未选择"}
            </span>
          </div>

          {/* 快捷提问 */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => quickAsk("请用固定结构输出：对手概览/核心威胁点/对战策略/针对训练建议")}
              className="text-xs px-3 py-2 rounded-full bg-slate-800/60 border border-slate-700 hover:border-red-500/40 hover:bg-slate-800 transition"
            >
              输出战术报告
            </button>
            <button
              type="button"
              onClick={() => quickAsk("请分析他的打法特点与弱点，并给出中国队的破局思路。")}
              className="text-xs px-3 py-2 rounded-full bg-slate-800/60 border border-slate-700 hover:border-red-500/40 hover:bg-slate-800 transition"
            >
              打法&弱点
            </button>
            <button
              type="button"
              onClick={() => quickAsk("请给出7天封闭训练计划（每天的训练目标、练习内容、关键指标）。")}
              className="text-xs px-3 py-2 rounded-full bg-slate-800/60 border border-slate-700 hover:border-red-500/40 hover:bg-slate-800 transition"
            >
              7天训练计划
            </button>
          </div>
        </div>
      </div>

      {/* 聊天区 */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <div className="h-[420px] overflow-auto pr-2 space-y-3 text-[15px] leading-[26px]">
          {messages.map((m, idx) => (
            <div
            key={idx}
            className={`max-w-[92%] rounded-2xl px-4 py-3 border break-words ${
              m.role === "user"
                ? "ml-auto bg-red-900/20 border-red-900/40 text-slate-100 text-[14px] leading-[24px] whitespace-pre-wrap"
                : "mr-auto bg-slate-950/40 border-slate-800"
            }`}
          >
            {m.role === "assistant" ? (
              <MarkdownMessage content={m.content} />
            ) : (
              <div className="whitespace-pre-wrap break-words">{m.content}</div>
            )}
          </div>
          ))}
          {loading ? (
            <div className="mr-auto max-w-[70%] rounded-2xl px-4 py-3 text-sm border bg-slate-950/40 border-slate-800 text-slate-400">
              正在生成…
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="输入你的问题（回车发送）"
            className="flex-1 bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none text-slate-200 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading}
            className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold"
          >
            发送
          </button>
        </div>

        {!currentPlayer ? (
          <div className="mt-3 text-xs text-slate-500">
            提示：先选择一个对手，回答会更准（会带入该选手画像）。
          </div>
        ) : null}
      </div>
    </div>
  );
};
const MetricCard = ({ label, value, desc }) => (
  <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
    <div className="text-xs text-slate-500 mb-1">{label}</div>
    <div className="text-lg font-bold text-white">{value}</div>
    <div className="text-xs text-slate-400 mt-1">{desc}</div>
  </div>
);
const PlayerDetail = ({ player, players, photoIndex, onBack, onSetNameZh, onJumpToPlayer }) => {
  const isChinaPlayer = player.country === "CHN";
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [recentMatches, setRecentMatches] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const [eventKeyword, setEventKeyword] = useState("");
  const [eventPick, setEventPick] = useState("ALL"); // 下拉选中的赛事

  const loadRecentMatches = async () => {
    setMatchLoading(true);
    setMatchError("");

    try {
      const nameQuery = player.nameEn || player.name;
      const livesportUrl = getLivesportUrl(player);

      console.log("🌐 请求比赛数据:", { nameQuery, livesportUrl });

      const resp = livesportUrl
        ? await fetch(
            `/api/player-matches?source=livesport&playerUrl=${encodeURIComponent(
              livesportUrl
            )}&name=${encodeURIComponent(nameQuery)}&years=2&force=1`
          )
        : await fetch(
            `/api/player-matches?name=${encodeURIComponent(
              nameQuery
            )}&country=${encodeURIComponent(player.country || "")}&force=1`
          );
      
      console.log("📡 响应状态:", resp.status);
      
      let data = {};
      try {
        data = await resp.json();
        console.log("📊 比赛数据:", data);
      } catch (parseError) {
        console.error("❌ JSON解析错误:", parseError);
        data = {};
      }

      if (!resp.ok) {
        const msg = data?.message || data?.error || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      
      if (data.matches && data.matches.length > 0) {
        console.log(`✅ 成功获取 ${data.matches.length} 场比赛数据`);
        setRecentMatches(data.matches);
        setPage(1);
      } else {
        console.log("⚠️ 无比赛数据返回");
        setRecentMatches([]);
        setMatchError("未找到近两年的比赛记录");
      }
    } catch (e) {
      console.error("❌ 获取比赛数据失败:", e);
      setMatchError(`比赛数据获取失败：${e?.message || "请检查后端接口 /api/player-matches"}`);
      setRecentMatches([]);
    } finally {
      setMatchLoading(false);
    }
  };
  // 根据比赛里的简称匹配球员
  // opponentName 可能是 "WANG A." / "IONESCU E." / "CALDERANO H."
  // 根据比赛里的简称匹配球员（兼容：姓在前/姓在后、连字符名、点号）
  const findOpponentPlayer = (opponentName) => {
    if (!opponentName || !players) return null;

    const normalizeName = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[.\-']/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // 0) 先按“全名”直接匹配（忽略大小写/标点），可覆盖 "Wong Chun Ting" 这类写法
    const raw = String(opponentName).trim();
    const rawNorm = normalizeName(raw);
    if (rawNorm) {
      const exact = players.find((p) => {
        const n1 = normalizeName(p.nameEn || p.name || "");
        const n2 = normalizeName(p.name || "");
        return n1 === rawNorm || n2 === rawNorm;
      });
      if (exact) return exact;
    }

    // 1) 规范化对手字符串：去点号、多余空格
    const cleaned = raw.replace(/\./g, "").replace(/\s+/g, " ").trim(); // "Lin Y-J" / "Harimoto T"
    const parts = cleaned.split(" ");
    if (parts.length < 2) return null;

    const oppFamily = parts[0].toLowerCase(); // lin / harimoto
    const oppInit = (parts[1] || "").replace(/[^a-zA-Z]/g, "").slice(0, 1).toLowerCase(); // y / t
    if (!oppFamily || !oppInit) return null;

    // 2) 在 players 里尝试两种顺序：
    //    A: family = 第一个词, given = 最后一个词（姓在前：HARIMOTO Tomokazu）
    //    B: family = 最后一个词, given = 第一个词（姓在后：Amy WANG）
    const pickInitial = (s) =>
      String(s || "").replace(/[^a-zA-Z]/g, "").slice(0, 1).toLowerCase();

    for (const p of players) {
      const full = String(p.nameEn || p.name || "").trim();
      if (!full) continue;

      const tokens = full.split(/\s+/).filter(Boolean);
      if (tokens.length < 2) continue;

      const first = tokens[0].toLowerCase();
      const last = tokens[tokens.length - 1].toLowerCase();

      // 给名：用第一个词或最后一个词的首字母（看顺序）
      const initFirst = pickInitial(tokens[0]);
      const initLast = pickInitial(tokens[tokens.length - 1]);

      // A) 姓在前：family=first，given=last
      if (first === oppFamily && initLast === oppInit) return p;

      // B) 姓在后：family=last，given=first
      if (last === oppFamily && initFirst === oppInit) return p;
    }

    return null;
  };
  const filteredMatches = useMemo(() => {
    const kw = eventKeyword.trim().toLowerCase();
    return (recentMatches || []).filter((m) => {
      const ev = String(m.event || "");
      const hitKeyword = !kw || ev.toLowerCase().includes(kw);
      const hitPick = eventPick === "ALL" || ev === eventPick;
      return hitKeyword && hitPick;
    });
  }, [recentMatches, eventKeyword, eventPick]);
  // 组件加载时自动获取比赛数据
  useEffect(() => {
    loadRecentMatches();
  }, [player.id]);
  useEffect(() => {
  // 切换球员时：回到第一页 + 清空赛事搜索
    setPage(1);
    setAvatarBroken(false);
    setEventKeyword("");
    setEventPick("ALL");

    // 回到顶部（避免用户停留在列表中间）
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [player.id]);

  const playerPhotoUrl = getPlayerPhotoUrl(player, photoIndex);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
      <button onClick={onBack} className="flex items-center text-slate-400 hover:text-white mb-6">
        <ChevronLeft size={20} /> 返回情报列表
      </button>

      {/* ============ 保留原来的选手信息展示部分 ============ */}
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <div className="w-40 h-40 bg-slate-800 rounded-3xl flex items-center justify-center text-6xl border-2 border-slate-700 overflow-hidden">
          {playerPhotoUrl && !avatarBroken ? (
            <img
              src={playerPhotoUrl}
              alt={player.nameZh || player.nameEn || player.name}
              className="w-full h-full object-cover"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <User size={64} />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-bold text-white">
              {player.nameZh || player.nameEn || player.name}
            </h1>
            <div className="text-sm text-slate-400 mt-1">
              {player.nameEn || player.name}
              {!player.nameZh && (
                <button
                  className="ml-3 text-xs px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700 hover:border-red-500/50 hover:bg-slate-800 transition"
                  onClick={() => {
                    const val = window.prompt("请输入该选手中文名（会保存在本机浏览器）", "");
                    if (val && onSetNameZh) onSetNameZh(player.nameEn || player.name, val);
                  }}
                >
                  补充中文名
                </button>
              )}
            </div>

            <span className="bg-red-900/30 text-red-400 px-3 py-1 rounded-full text-sm border border-red-900/50">
              {player.tier}
            </span>
          </div>

          <p className="text-xl text-slate-400 mb-6">{player.country} 协会 · {player.style}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">世界排名</div>
              <div className="text-2xl font-mono text-white">#{player.ranking}</div>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">项目</div>
              <div className="text-2xl text-white">{player.gender === 'Male' ? '男单' : '女单'}</div>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">近期积分</div>
              <div className="text-2xl text-white">
                {player.pointsDelta === 0 ? "持平" : `${player.pointsDelta > 0 ? "+" : ""}${player.pointsDelta}`}
                {player.momentum ? `（${player.momentum}）` : ""}
              </div>
            </div>

            <div className="bg-red-900/20 p-4 rounded-xl border border-red-900/40">
              <div className="text-red-400 text-[10px] uppercase tracking-wider mb-1">
                {isChinaPlayer ? "综合能力指数" : "对华威胁分"}
              </div>
              <div className="text-2xl font-mono font-bold text-red-500">
                {Number(
                  isChinaPlayer
                    ? (player.dominanceScore ?? player.threatScore ?? 0)
                    : (player.threatScore ?? 0)
                ).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ============ 选手信息部分结束 ============ */}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* 威胁维度拆解模块 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="text-red-500" />
              {isChinaPlayer ? "技战术能力拆解" : "威胁维度拆解"}
            </h3>

            {isChinaPlayer ? (
              <DominanceRadar dimensions={player.dominanceDimensions} />
            ) : (
              <div className="space-y-8">
                <div>
                  <ThreatRadar dimensions={player.threatDimensions} />
                </div>

                <div className="pt-6 border-t border-slate-800/80">
                  <div className="text-slate-300 font-semibold mb-4">
                    技战术能力拆解
                    <span className="ml-2 text-xs text-slate-500">
                      （与中国选手同算法）
                    </span>
                  </div>
                  <DominanceRadar dimensions={player.dominanceDimensions} />
                </div>
              </div>
            )}
          </div>
          {/* 比赛结构指标模块 */}
          {!isChinaPlayer && player.dominantWinRate !== undefined && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Activity className="text-cyan-400" /> 比赛结构指标
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">

                <MetricCard
                  label="压制胜比例"
                  value={`${(player.dominantWinRate * 100).toFixed(1)}%`}
                  desc="3-0 / 4-0 胜场占比"
                />

                <MetricCard
                  label="胶着局比例"
                  value={`${(player.closeRatio * 100).toFixed(1)}%`}
                  desc="进入决胜局场次占比"
                />

                <MetricCard
                  label="胶着局胜率"
                  value={`${(player.closeWinRate * 100).toFixed(1)}%`}
                  desc="决胜局取胜能力"
                />

                <MetricCard
                  label="高等级赛事占比"
                  value={`${(player.intensityRatio * 100).toFixed(1)}%`}
                  desc="Champions / WTT 等"
                />

              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-8">
          {isChinaPlayer && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">
                阵容适配分析
              </h3>

              <div className="text-sm text-slate-400">
                （中国队专属模块预留，后续接入对外战绩、适配指数、排兵建议）
              </div>
            </div>
          )}
          {/* 最近比赛成绩模块（替换原战绩记录位置） */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="text-yellow-500" /> 最近比赛成绩
            </h3>
            <input
              value={eventKeyword}
              onChange={(e) => {
                setEventKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="搜索赛事名（例如：WTT / Doha / Champions）"
              className="w-full mb-4 bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none text-slate-200 placeholder:text-slate-500"
            />

            <div className="space-y-3">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-500 mb-2">近期战绩</div>
                {recentMatches.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>胜场:</span>
                      <span className="text-emerald-400 font-bold">
                        {recentMatches.filter(m => m.result === "W").length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>负场:</span>
                      <span className="text-red-400 font-bold">
                        {recentMatches.filter(m => m.result === "L").length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>胜率:</span>
                      <span className="text-yellow-400 font-bold">
                        {recentMatches.length > 0 
                          ? `${Math.round((recentMatches.filter(m => m.result === "W").length / recentMatches.length) * 100)}%`
                          : "0%"
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">暂无比赛数据</div>
                )}
              </div>

              {matchLoading ? (
                <div className="flex items-center gap-3 text-sm text-slate-400 p-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                  正在加载比赛数据…
                </div>
              ) : matchError ? (
                <div className="text-sm text-red-400 p-4 bg-red-900/20 rounded-xl border border-red-900/30">
                  <div className="font-bold mb-1">⚠️ 数据加载失败</div>
                  <div>{matchError}</div>
                  <button
                    onClick={loadRecentMatches}
                    className="mt-3 px-4 py-2 text-xs rounded-lg bg-red-800/40 hover:bg-red-700/40 transition"
                  >
                    重试
                  </button>
                </div>
              ) : recentMatches.length === 0 ? (
                <div className="text-sm text-slate-400 p-4 bg-slate-950/40 rounded-xl border border-slate-800">
                  暂无近两年的比赛数据
                  <div className="mt-2 text-xs text-slate-500">
                    数据源: {getLivesportUrl(player) ? "livesport.com" : "ITTF Results"}
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const total = filteredMatches.length;
                    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
                    const canPrev = page > 1;
                    const canNext = page < totalPages;

                    return (
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-2">
                        <div className="flex items-center gap-3">
                          <span>共 {total} 场比赛</span>
                          <span>第 {page} / {totalPages} 页</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!canPrev}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-800/40 transition"
                          >
                            上一页
                          </button>
                          <button
                            type="button"
                            disabled={!canNext}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-800/40 transition"
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {filteredMatches
                    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                    .map((m, i) => (
                      <div
                        key={i}
                        className="p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-white whitespace-nowrap">
                              {m.event || "赛事"}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {m.date || "日期未知"} · {m.round || "轮次"}
                            </div>
                          </div>
                          <div
                            className={`text-xs px-3 py-1 rounded-full border font-medium ${
                              m.result === "W"
                                ? "border-emerald-700/40 bg-emerald-900/20 text-emerald-300"
                                : m.result === "L"
                                ? "border-red-700/40 bg-red-900/20 text-red-300"
                                : "border-yellow-700/40 bg-yellow-900/20 text-yellow-300"
                            }`}
                          >
                            {m.result === "W" ? "胜" : m.result === "L" ? "负" : "未知"}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="text-sm text-slate-300">
                            对手:{" "}
                            {(() => {
                              const opponentPlayer = findOpponentPlayer(m.opponent);

                              if (opponentPlayer) {
                                return (
                                  <button
                                    onClick={() => onJumpToPlayer(opponentPlayer)}
                                    className="font-medium text-blue-400 hover:text-blue-300 hover:underline transition"
                                  >
                                    {m.opponent}
                                  </button>
                                );
                              }

                              return <span className="font-medium">{m.opponent || "-"}</span>;
                            })()}
                          </div>
                          <div className="text-sm font-mono bg-slate-800/50 px-3 py-1 rounded-lg">
                            {m.score || "比分未知"}
                          </div>
                        </div>

                        {m.subEvent && (
                          <div className="text-xs text-slate-500 mt-2">
                            {m.subEvent}
                          </div>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1 rounded-lg bg-blue-800/40 hover:bg-blue-700/40 transition"
                  onClick={() => {
                    const nameQuery = player.nameEn || player.name;
                    const livesportUrl = getLivesportUrl(player);
                    console.log('🔍 调试信息:', {
                      选手: nameQuery,
                      URL: livesportUrl
                    });

                    fetch(`/api/player-matches?source=livesport&playerUrl=${encodeURIComponent(livesportUrl)}&name=${encodeURIComponent(nameQuery)}&years=2&force=1&debug=1`)
                      .then(r => {
                        console.log('📡 API响应状态:', r.status);
                        return r.json();
                      })
                      .then(data => {
                        console.log('📊 完整API响应:', data);
                        if (data.matches && data.matches.length > 0) {
                          setRecentMatches(data.matches);
                          setPage(1);
                          console.log(`✅ 成功加载 ${data.matches.length} 场比赛`);
                        } else {
                          console.log('⚠️ API返回空数据');
                          setRecentMatches([]);
                        }
                      })
                      .catch(err => {
                        console.error('❌ API调用失败:', err);
                      });
                  }}
                >
                  调试API
                </button>
                <div className="text-xs text-slate-500">
                  数据源: {getLivesportUrl(player) ? "livesport.com" : "results.ittf.link"}
                </div>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-red-500/40 hover:bg-slate-800 transition text-sm flex items-center gap-2"
                onClick={loadRecentMatches}
                disabled={matchLoading}
              >
                {matchLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    刷新中...
                  </>
                ) : (
                  "刷新比赛数据"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
