import React, { useMemo, useState } from "react";
import { Flame, Shield, SlidersHorizontal } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const DIM_KEYS = ["attack", "control", "defense", "speed", "spin"];

const QUESTIONS = [
  {
    id: "q1",
    q: "Q1 比赛中你更喜欢？",
    options: [
      { key: "A", label: "主动抢攻", delta: { attack: 2, speed: 1 } },
      { key: "B", label: "稳定控制", delta: { control: 2 } },
      { key: "C", label: "防守反击", delta: { defense: 2 } },
    ],
  },
  {
    id: "q2",
    q: "Q2 如果对手进攻很猛，你会？",
    options: [
      { key: "A", label: "继续对攻", delta: { attack: 2 } },
      { key: "B", label: "稳住节奏", delta: { control: 2 } },
      { key: "C", label: "拉开距离防守", delta: { defense: 2 } },
    ],
  },
  {
    id: "q3",
    q: "Q3 你最常得分的方式？",
    options: [
      { key: "A", label: "正手进攻", delta: { attack: 2 } },
      { key: "B", label: "连续相持", delta: { control: 2 } },
      { key: "C", label: "对手失误", delta: { defense: 1, control: 1 } },
    ],
  },
  {
    id: "q4",
    q: "Q4 你比赛最关注？",
    options: [
      { key: "A", label: "速度", delta: { speed: 2 } },
      { key: "B", label: "落点", delta: { control: 2 } },
      { key: "C", label: "旋转", delta: { spin: 2 } },
    ],
  },
  {
    id: "q5",
    q: "Q5 你更喜欢站位？",
    options: [
      { key: "A", label: "近台", delta: { speed: 1, attack: 1 } },
      { key: "B", label: "中台", delta: { control: 2 } },
      { key: "C", label: "远台", delta: { defense: 2 } },
    ],
  },
  {
    id: "q6",
    q: "Q6 你最强技术？",
    options: [
      { key: "A", label: "正手进攻", delta: { attack: 2 } },
      { key: "B", label: "发球变化", delta: { spin: 2 } },
      { key: "C", label: "防守削球", delta: { defense: 2 } },
    ],
  },
  {
    id: "q7",
    q: "Q7 遇到关键球你会？",
    options: [
      { key: "A", label: "抢攻结束", delta: { attack: 2 } },
      { key: "B", label: "找机会进攻", delta: { control: 2 } },
      { key: "C", label: "稳住回合", delta: { defense: 1, control: 1 } },
    ],
  },
  {
    id: "q8",
    q: "Q8 你觉得自己的优势？",
    options: [
      { key: "A", label: "爆发力", delta: { attack: 2 } },
      { key: "B", label: "稳定性", delta: { control: 2 } },
      { key: "C", label: "防守能力", delta: { defense: 2 } },
    ],
  },
  {
    id: "q9",
    q: "Q9 你喜欢哪种比赛节奏？",
    options: [
      { key: "A", label: "快节奏", delta: { speed: 2 } },
      { key: "B", label: "中等节奏", delta: { control: 2 } },
      { key: "C", label: "慢节奏", delta: { defense: 1 } },
    ],
  },
  {
    id: "q10",
    q: "Q10 发球时你更看重？",
    options: [
      { key: "A", label: "快速抢攻", delta: { attack: 1, speed: 1 } },
      { key: "B", label: "落点变化", delta: { control: 2 } },
      { key: "C", label: "强旋转", delta: { spin: 2 } },
    ],
  },
  {
    id: "q11",
    q: "Q11 相持球时你更倾向？",
    options: [
      { key: "A", label: "主动进攻", delta: { attack: 2 } },
      { key: "B", label: "控制落点", delta: { control: 2 } },
      { key: "C", label: "等对手失误", delta: { defense: 1 } },
    ],
  },
  {
    id: "q12",
    q: "Q12 你理想的打法是？",
    options: [
      { key: "A", label: "强力进攻型", delta: { attack: 2 } },
      { key: "B", label: "控制型", delta: { control: 2 } },
      { key: "C", label: "防守反击型", delta: { defense: 2 } },
    ],
  },
];

const TYPE_META = {
  进攻猎手: {
    icon: Flame,
    badge: "bg-red-600/20 border-red-600/30 text-red-300",
    feature: "主动进攻、抢攻意识强",
    description: "以进攻为主轴，偏向用先手与速度抢占主动权。",
    templates: ["张本智和", "林昀儒（快节奏上手型）"],
  },
  旋转大师: {
    icon: SlidersHorizontal,
    badge: "bg-fuchsia-600/20 border-fuchsia-600/30 text-fuchsia-200",
    feature: "善于制造旋转变化",
    description: "以旋转变化为核心，用发球与摩擦质量制造判断压力。",
    templates: ["马琳（发球变化）", "许昕（旋转与变化）"],
  },
  速度压制者: {
    icon: Flame,
    badge: "bg-amber-600/20 border-amber-600/30 text-amber-200",
    feature: "快节奏、连续进攻",
    description: "以速度与连贯为核心，通过连续压制打乱对手节奏。",
    templates: ["张继科（提速压制）", "张本智和（连续提速）"],
  },
  节奏控制者: {
    icon: SlidersHorizontal,
    badge: "bg-sky-600/20 border-sky-600/30 text-sky-200",
    feature: "控制落点与节奏",
    description: "以落点与节奏组织为核心，把比赛带进自己的节拍。",
    templates: ["马龙（体系控制）", "波尔（节奏变化）"],
  },
  防守反击者: {
    icon: Shield,
    badge: "bg-emerald-600/20 border-emerald-600/30 text-emerald-200",
    feature: "擅长防守与反击",
    description: "以防守质量顶住压力，再在对手质量下降时果断反击。",
    templates: ["朱世赫（防守反击）", "松平健太（防反取向）"],
  },
  稳定型选手: {
    icon: Shield,
    badge: "bg-slate-600/20 border-slate-500/30 text-slate-200",
    feature: "失误少、稳定性高",
    description: "以高成功率与稳定为核心，通过细节积累优势。",
    templates: ["波尔（稳定与节奏）", "马龙（稳定与控制）"],
  },
  变化型选手: {
    icon: SlidersHorizontal,
    badge: "bg-indigo-600/20 border-indigo-600/30 text-indigo-200",
    feature: "战术变化多",
    description: "以旋转+落点组合与节奏切换为核心，擅长用变化制造机会。",
    templates: ["马琳（变化）", "波尔（线路变化）"],
  },
  全能型选手: {
    icon: SlidersHorizontal,
    badge: "bg-violet-600/20 border-violet-600/30 text-violet-200",
    feature: "各方面均衡",
    description: "五项能力接近，策略切换灵活，综合适配性强。",
    templates: ["马龙（全面）", "樊振东（均衡全面）"],
  },
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function nearlyEqual(a, b, diff = 2) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= diff;
}

function computeScores(answersById) {
  const score = { attack: 0, control: 0, defense: 0, speed: 0, spin: 0 };
  for (const q of QUESTIONS) {
    const pickKey = answersById[q.id];
    if (!pickKey) continue;
    const opt = q.options.find((o) => o.key === pickKey);
    if (!opt) continue;
    const delta = opt.delta && typeof opt.delta === "object" ? opt.delta : {};
    for (const k of DIM_KEYS) {
      const v = Number(delta[k] ?? 0);
      if (Number.isFinite(v)) score[k] += v;
    }
  }
  return score;
}

function computeMaxByDim() {
  const maxByDim = { attack: 0, control: 0, defense: 0, speed: 0, spin: 0 };
  for (const q of QUESTIONS) {
    const best = { attack: 0, control: 0, defense: 0, speed: 0, spin: 0 };
    for (const o of q.options) {
      const d = o?.delta && typeof o.delta === "object" ? o.delta : {};
      for (const k of DIM_KEYS) best[k] = Math.max(best[k], Number(d[k] ?? 0) || 0);
    }
    for (const k of DIM_KEYS) maxByDim[k] += best[k];
  }
  return maxByDim;
}

function to100(raw, maxRaw) {
  const v = Number(raw);
  const m = Number(maxRaw);
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return 0;
  return clamp(Math.round((v / m) * 100), 0, 100);
}

function classifyType(score) {
  const s = { ...score };
  const values = DIM_KEYS.map((k) => Number(s[k] ?? 0));
  const max = Math.max(...values);
  const min = Math.min(...values);

  // 全能型：五项接近
  if (max - min <= 2) return "全能型选手";

  const sorted = DIM_KEYS
    .map((k) => ({ k, v: Number(s[k] ?? 0) }))
    .sort((a, b) => b.v - a.v);
  const top = sorted[0];
  const second = sorted[1];
  const isHigh = (k) => Number(s[k] ?? 0) >= max - 2;

  // 规则（按图示意）
  if (top.k === "attack" && isHigh("speed")) return "进攻猎手";
  if (top.k === "spin" && isHigh("control")) return "旋转大师";
  if (top.k === "speed" && isHigh("attack")) return "速度压制者";
  if (top.k === "control") return "节奏控制者";
  if (top.k === "defense" && (second?.k === "control" || isHigh("control"))) return "防守反击者";
  if (isHigh("spin") && isHigh("control")) return "变化型选手";
  if (isHigh("control") && nearlyEqual(s.attack, s.defense, 2)) return "稳定型选手";

  // fallback
  if (top.k === "attack") return "进攻猎手";
  if (top.k === "speed") return "速度压制者";
  if (top.k === "spin") return "旋转大师";
  if (top.k === "defense") return "防守反击者";
  return "节奏控制者";
}

function buildRadar(score) {
  const maxByDim = computeMaxByDim();
  const raw = {
    attack: Number(score?.attack ?? 0) || 0,
    control: Number(score?.control ?? 0) || 0,
    defense: Number(score?.defense ?? 0) || 0,
    speed: Number(score?.speed ?? 0) || 0,
    spin: Number(score?.spin ?? 0) || 0,
  };
  const pctRaw = {
    attack: to100(raw.attack, maxByDim.attack),
    control: to100(raw.control, maxByDim.control),
    defense: to100(raw.defense, maxByDim.defense),
    speed: to100(raw.speed, maxByDim.speed),
    spin: to100(raw.spin, maxByDim.spin),
  };
  // Visual boost: nonlinear scaling so distributed scores don't look tiny.
  const scale = (p) => clamp(Math.round(100 * Math.pow(clamp(p, 0, 100) / 100, 0.65)), 0, 100);
  const pct = {
    attack: scale(pctRaw.attack),
    control: scale(pctRaw.control),
    defense: scale(pctRaw.defense),
    speed: scale(pctRaw.speed),
    spin: scale(pctRaw.spin),
  };
  return { raw, pctRaw, pct, maxByDim };
}

function buildPlaystyleSections(type) {
  const advantages = [];
  const risks = [];

  switch (type) {
    case "进攻猎手":
      advantages.push("主动上手强，抢攻意识明确");
      advantages.push("先手得分效率高，压迫感强");
      risks.push("失误波动偏大时容易丢分");
      risks.push("遇到强控制/高质量防守容易被拖慢节奏");
      break;
    case "旋转大师":
      advantages.push("旋转变化足，能制造判断难度");
      advantages.push("发球与前三板更容易建立优势");
      risks.push("旋转质量不稳定时容易被对手适应");
      risks.push("过度追求旋转可能导致出手慢、被提速");
      break;
    case "速度压制者":
      advantages.push("节奏快，连续压制能力强");
      advantages.push("对抗强度高，容易打乱对手准备");
      risks.push("对手顶住后，容易陷入“快但不稳”");
      risks.push("体能/步法不足时后半局稳定性下降");
      break;
    case "节奏控制者":
      advantages.push("落点与线路组织强，稳定性高");
      advantages.push("能掌控节奏变化，让对手不舒服");
      risks.push("终结能力不足时容易被对手强冲抢先手");
      risks.push("被对手提速时需要更明确的反制手段");
      break;
    case "防守反击者":
      advantages.push("抗压强，能把对手强攻化解掉");
      advantages.push("反击点清晰时得分效率高");
      risks.push("反攻触发点不明确时容易被持续压制");
      risks.push("过度防守会让对手更敢进攻");
      break;
    case "稳定型选手":
      advantages.push("失误少，比赛容错高");
      advantages.push("关键分更稳，能把对手耗到失误");
      risks.push("缺少爆点时难以快速拉开分差");
      risks.push("面对极强进攻需要更主动的上手方案");
      break;
    case "变化型选手":
      advantages.push("旋转+落点组合多，战术变化丰富");
      advantages.push("能根据对手弱点快速调整策略");
      risks.push("变化过多会降低稳定性与命中率");
      risks.push("需要更强基本功支撑变化执行质量");
      break;
    case "全能型选手":
    default:
      advantages.push("各维度均衡，适配不同对手");
      advantages.push("可切换策略，临场调整空间大");
      risks.push("需要明确主武器，避免“样样会但不精”");
      risks.push("训练需阶段性聚焦，避免平均用力");
      break;
  }

  return { advantages, risks };
}

function buildTactics(type) {
  switch (type) {
    case "进攻猎手":
      return [
        "前三板优先抢先手：发球后第一板先上手，尽量不把主动权交出去。",
        "优先打高成功率线路：先打肋部/大角稳定得分，再追求强度。",
        "关键分降风险：领先时少搏杀，多用落点控住一板质量。",
      ];
    case "旋转大师":
      return [
        "用旋转制造落点优势：先让对手出球难，再抓质量下降回合上手。",
        "发球两套体系：同落点不同旋转/同旋转不同落点，建立判断压力。",
        "对手提速时要简化：减少花活，先稳住旋转质量与落点。",
      ];
    case "速度压制者":
      return [
        "先提速再变线：用速度压住对手准备，再用落点终结。",
        "连续进攻以连贯为先：宁可中强度多板，也别一板拼死。",
        "体能策略：后半局适当降速，优先保证上台率与落点质量。",
      ];
    case "防守反击者":
      return [
        "先顶住强攻：把第一目标设为高质量回球，不急于出手。",
        "建立反击触发点：对手回球质量下降/落点不到位时果断转攻。",
        "用变化防守：挡/削/加转结合落点，逼对手先冒险。",
      ];
    case "稳定型选手":
      return [
        "高成功率优先：减少无谓变招，用稳定把对手逼急。",
        "关键分固定套路：发球+一板线路固定，降低决策成本。",
        "被动时先回安全球：落点深、质量足，再找机会变线。",
      ];
    case "变化型选手":
      return [
        "变化要有主线：先用稳定套路建立优势，再用变化扩大优势。",
        "旋转+落点组合：同线路改旋转/同旋转改线路，迫使对手判断失误。",
        "控制变化频率：按局势切换，比“一分一变”更有效。",
      ];
    case "节奏控制者":
    default:
      return [
        "用落点控制节奏：先锁住对手惯用点，再通过变线制造空当。",
        "强迫对手先失误：相持中减少无谓变招，等待对手先冒险。",
        "预备反提速战术：被对手提速时，用快撕/快带把节奏抢回来。",
      ];
  }
}

function buildTraining(type) {
  switch (type) {
    case "进攻猎手":
      return [
        "发接发 + 第三板上手：固定套路练到稳定（旋转/落点/第一板质量）。",
        "连续进攻稳定性：1-3板连贯训练，减少“强但不稳”的失误。",
        "步法与重心：提高第一步启动与还原速度，支撑快节奏对抗。",
      ];
    case "旋转大师":
      return [
        "发球摩擦质量：旋转强度与落点精度同时练，形成可控的变化。",
        "前三板衔接：发球→抢攻/控短→下一板跟进，形成一套体系。",
        "旋转变化训练：同动作不同旋转/同旋转不同动作，提升迷惑性。",
      ];
    case "速度压制者":
      return [
        "快撕快带：近台连续上手训练，强调节奏与上台率。",
        "步法连续性：两点/三点移动练启动与还原，避免速度断档。",
        "体能+节奏控制：间歇训练提升后半局稳定。",
      ];
    case "防守反击者":
      return [
        "防守质量：挡/削/加转与落点控制，先把“顶住”做扎实。",
        "防守转攻：从防守出球到反拉/反击的一板连贯训练。",
        "核心力量与耐力：提升相持后段稳定性，减少被动失误。",
      ];
    case "稳定型选手":
      return [
        "相持稳定：中等强度长回合训练，提升质量与耐心。",
        "接发球细节：短球质量、拧拉/挑打选择与落点，建立优势开局。",
        "一板质量：落点+弧线+旋转三者兼顾，减少“送分球”。",
      ];
    case "变化型选手":
      return [
        "基本功底座：正反手稳定与上台率先打牢，变化才有意义。",
        "变化组合训练：发球/接发/相持三段各准备2套变化方案。",
        "决策训练：在限定回合内选择变化（而不是随机），提升实战效率。",
      ];
    case "节奏控制者":
    default:
      return [
        "落点控制训练：定点/变点 + 线路组合，形成“控住再变线”的能力。",
        "相持稳定性：中等强度长回合训练，提升质量与耐心。",
        "接发球体系：短球、拧拉、劈长选择与落点，建立开局优势。",
      ];
  }
}

function buildGear(type) {
  switch (type) {
    case "进攻猎手":
    case "速度压制者":
      return {
        blade: "底板：外置纤维或快攻弧圈型（偏速度与出球直接）",
        rubbers: "胶皮：正手中硬粘性（强上旋），反手高弹张力（快撕快带）",
      };
    case "旋转大师":
      return {
        blade: "底板：内置纤维或持球更好的7夹/内置（偏摩擦与旋转）",
        rubbers: "胶皮：正手偏粘旋转型（更易制造旋转），反手中等弹性旋转型",
      };
    case "防守反击者":
      return {
        blade: "底板：偏控制与持球的纯木/防守型（更稳更耐磨）",
        rubbers: "胶皮：正手旋转控制型，反手偏控制/变化型（稳定与变化优先）",
      };
    case "稳定型选手":
    case "变化型选手":
    case "节奏控制者":
    case "全能型选手":
    default:
      return {
        blade: "底板：内置纤维或5夹纯木（偏持球与控制）",
        rubbers: "胶皮：正手中硬旋转型，反手中等弹性控制型（更稳更准）",
      };
  }
}

function RadarCard({ radarPct, radarRaw }) {
  const data = [
    { key: "attack", label: "attack", value: radarPct.attack, name: "进攻" },
    { key: "control", label: "control", value: radarPct.control, name: "控制" },
    { key: "defense", label: "defense", value: radarPct.defense, name: "防守" },
    { key: "speed", label: "speed", value: radarPct.speed, name: "速度" },
    { key: "spin", label: "spin", value: radarPct.spin, name: "旋转" },
  ];

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="text-white font-bold mb-4">能力雷达图</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickCount={6}
              axisLine={false}
            />
            <RechartsTooltip
              formatter={(value, _n, item) => [`${Number(value).toFixed(0)}`, item?.payload?.label]}
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
              stroke="#f43f5e"
              fill="#f43f5e"
              fillOpacity={0.24}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
        {data.map((d) => (
          <div
            key={d.key}
            className="bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2"
          >
            <div className="text-slate-400">{d.label}</div>
            <div className="text-white font-mono font-bold">{radarRaw[d.key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListCard({ title, items }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="text-white font-bold mb-3">{title}</div>
      <ul className="space-y-2">
        {items.map((t, idx) => (
          <li key={`${title}-${idx}`} className="text-sm text-slate-300">
            • {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TwoColCard({ title, leftTitle, leftItems, rightTitle, rightItems }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="text-white font-bold mb-4">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-4">
          <div className="text-slate-200 font-semibold">{leftTitle}</div>
          <ul className="mt-3 space-y-2">
            {leftItems.map((t, idx) => (
              <li key={`l-${idx}`} className="text-sm text-slate-300">
                • {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-4">
          <div className="text-slate-200 font-semibold">{rightTitle}</div>
          <ul className="mt-3 space-y-2">
            {rightItems.map((t, idx) => (
              <li key={`r-${idx}`} className="text-sm text-slate-300">
                • {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function PlaystyleTest() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [view, setView] = useState("quiz"); // quiz | result

  const progress = useMemo(() => {
    const answered = QUESTIONS.filter((q) => Boolean(answers[q.id])).length;
    return { answered, total: QUESTIONS.length };
  }, [answers]);

  const result = useMemo(() => {
    if (!submitted) return null;
    const score = computeScores(answers);
    const type = classifyType(score);
    const meta = TYPE_META[type] || TYPE_META["节奏控制者"];
    const radar = buildRadar(score);
    const features = buildPlaystyleSections(type);
    const tactics = buildTactics(type);
    const training = buildTraining(type);
    const gear = buildGear(type);
    return { score, type, meta, radar, features, tactics, training, gear };
  }, [answers, submitted]);

  const canSubmit = progress.answered === progress.total;

  if (view === "result") {
    return (
      <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <button
              type="button"
              className="flex items-center text-slate-400 hover:text-white mb-4"
              onClick={() => {
                setView("quiz");
                setSubmitted(false);
              }}
            >
              ← 返回修改
            </button>
            <h1 className="text-3xl font-black text-white">你的乒乓人格</h1>
            <p className="text-slate-400 mt-2 text-sm">
              基于你的作答生成的能力画像与建议（返回后仍保留刚刚的作答）。
            </p>
          </div>
        </div>

        {!result ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
            结果生成失败，请返回检查作答是否完整。
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div className="text-slate-400 text-xs mb-1">人格名称</div>
              <div className="flex items-center gap-3">
                {result.meta?.icon ? (
                  <div className={`p-2 rounded-xl border ${result.meta.badge}`}>
                    <result.meta.icon size={18} />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="text-white font-extrabold text-2xl">{result.type}</div>
                  <div className="text-slate-400 text-sm mt-1">{result.meta.feature}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-300">{result.meta.description}</div>
            </div>

            <RadarCard radarPct={result.radar.pct} radarRaw={result.radar.raw} />

            <TwoColCard
              title="打法特点"
              leftTitle="优势"
              leftItems={result.features.advantages}
              rightTitle="风险"
              rightItems={result.features.risks}
            />

            <ListCard title="战术建议（3条）" items={result.tactics} />
            <ListCard title="训练建议（3条）" items={result.training} />

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div className="text-white font-bold mb-3">职业模板</div>
              <div className="text-sm text-slate-300">打法说明：{result.meta.description}</div>
              <div className="mt-4 text-slate-200 font-semibold">参考球员</div>
              <div className="mt-2 space-y-2">
                {result.meta.templates.map((t) => (
                  <div
                    key={t}
                    className="bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div className="text-white font-bold mb-3">装备推荐</div>
              <div className="text-sm text-slate-300">{result.gear.blade}</div>
              <div className="mt-2 text-sm text-slate-300">{result.gear.rubbers}</div>
              <div className="mt-3 text-xs text-slate-500">
                备注：装备建议仅为风格匹配参考，实际还需结合力量、击球习惯与手感试打调整。
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">乒乓球打法人格测试</h1>
          <p className="text-slate-400 mt-2 text-sm">
            根据 12 题问卷统计 5 个核心维度（attack/control/defense/speed/spin），自动生成 8 种乒乓人格之一。
          </p>
        </div>
        <div className="text-sm text-slate-400">
          已完成 <span className="text-white font-bold">{progress.answered}</span>/{progress.total}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {QUESTIONS.map((q) => (
            <div key={q.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div className="text-white font-bold mb-4">{q.q}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {q.options.map((o) => {
                  const active = answers[q.id] === o.key;
                  return (
                    <button
                      key={`${q.id}-${o.key}`}
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setAnswers((prev) => ({ ...(prev || {}), [q.id]: o.key }));
                      }}
                      className={`px-4 py-3 rounded-xl border text-left transition ${
                        active
                          ? "bg-red-600/20 border-red-500/40 text-white"
                          : "bg-slate-950/40 border-slate-800 text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      <div className="text-xs text-slate-400 mb-1">选项 {o.key}</div>
                      <div className="font-semibold">{o.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <div className="text-white font-bold mb-3">生成结果</div>
            <div className="text-sm text-slate-400">计分维度：attack / control / defense / speed / spin</div>

            <button
              type="button"
              disabled={!canSubmit}
              className={`mt-5 w-full px-4 py-2.5 rounded-xl font-semibold transition ${
                canSubmit
                  ? "bg-red-600 text-white hover:bg-red-500 active:bg-red-700"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
              onClick={() => {
                setSubmitted(true);
                setView("result");
              }}
            >
              生成我的乒乓人格
            </button>

            {!canSubmit ? (
              <div className="mt-6 text-slate-500 text-sm border border-slate-800/60 rounded-xl p-4 bg-slate-950/20">
                完成全部题目后才能生成结果。
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
