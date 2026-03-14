import React, { useMemo, useState } from "react";
import { Activity, AlertTriangle, Sparkles } from "lucide-react";

const STYLE_OPTIONS = ["弧圈进攻", "快攻结合弧圈", "控制型", "削球防守", "反手强攻"];
const WEAKNESS_OPTIONS = ["反手弱", "移动慢", "发球一般", "稳定性差", "接发球差"];

// 业余风格克制矩阵：值域建议在 [-2, 2]，最终会乘以 3 进入 score
const STYLE_MATRIX = {
  弧圈进攻: {
    弧圈进攻: 0,
    快攻结合弧圈: 0,
    控制型: 0,
    削球防守: 2,
    反手强攻: 0,
  },
  快攻结合弧圈: {
    弧圈进攻: 0,
    快攻结合弧圈: 0,
    控制型: 1,
    削球防守: 1,
    反手强攻: 0,
  },
  控制型: {
    弧圈进攻: 0,
    快攻结合弧圈: -1,
    控制型: 0,
    削球防守: 0,
    反手强攻: -1,
  },
  削球防守: {
    弧圈进攻: -2,
    快攻结合弧圈: -1,
    控制型: 0,
    削球防守: 0,
    反手强攻: 0,
  },
  反手强攻: {
    弧圈进攻: 0,
    快攻结合弧圈: 0,
    控制型: 1,
    削球防守: 0,
    反手强攻: 0,
  },
};

function hashString32(s) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp0to100(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function amateurPredict({ myStyle, myWeakness, oppStyle, oppWeakness, seed }) {
  let score = 0;
  const advantages = [];
  const risks = [];

  // 1) 风格克制
  const styleScore = STYLE_MATRIX[myStyle]?.[oppStyle] || 0;
  if (styleScore) {
    const delta = styleScore * 3;
    score += delta;
    if (delta > 0) {
      advantages.push(`风格克制：${myStyle} 对 ${oppStyle}（+${delta}）`);
    } else {
      risks.push(`风格对位：${myStyle} 对 ${oppStyle}（${delta}）`);
    }
  }

  // 2) 弱点利用
  if (oppWeakness === "反手弱" && myStyle === "弧圈进攻") {
    score += 4;
    advantages.push("对手反手偏弱，弧圈进攻可压反手、调动后抢先手");
  }
  if (oppWeakness === "移动慢" && myStyle === "快攻结合弧圈") {
    score += 3;
    advantages.push("对手移动偏慢，快攻结合弧圈可用节奏和落点左右调动");
  }
  if (myWeakness === "稳定性差") {
    score -= 4;
    risks.push("稳定性差会放大失误波动，建议优先高成功率线路");
  }
  if (myWeakness === "接发球差") {
    score -= 3;
    risks.push("接发球差容易丢先手，建议简化接发球并提前预判落点");
  }

  // 3) 随机扰动（模拟竞技波动）
  const rng = mulberry32(seed >>> 0);
  score += (rng() - 0.5) * 2;

  // 4) Logistic 胜率函数
  const winProb = 1 / (1 + Math.exp(-score / 6));
  const win = clamp0to100(winProb * 100);

  if (!advantages.length) advantages.push("未触发明显克制规则，胜负更多取决于发接发与稳定性");
  if (!risks.length) risks.push("未触发明显风险规则，注意保持落点变化与节奏控制");

  return {
    win,
    advantages: Array.from(new Set(advantages)),
    risks: Array.from(new Set(risks)),
  };
}

export default function AmateurPredict() {
  const [meStyle, setMeStyle] = useState(STYLE_OPTIONS[0]);
  const [meWeak, setMeWeak] = useState(WEAKNESS_OPTIONS[0]);
  const [oppStyle, setOppStyle] = useState(STYLE_OPTIONS[0]);
  const [oppWeak, setOppWeak] = useState(WEAKNESS_OPTIONS[0]);
  const [result, setResult] = useState(null); // { seed }

  const computed = useMemo(() => {
    if (!result) return null;
    return amateurPredict({
      myStyle: meStyle,
      myWeakness: meWeak,
      oppStyle,
      oppWeakness: oppWeak,
      seed: result.seed >>> 0,
    });
  }, [result, meStyle, meWeak, oppStyle, oppWeak]);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">业余对战预测</h1>
          <p className="text-slate-400 mt-2 text-sm">
            填写我方与对手信息，使用简化规则快速估算胜率与对战要点
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="text-white font-bold mb-4 flex items-center gap-2">
            <Activity size={18} className="text-slate-300" />
            我方信息
          </div>
          <div className="space-y-4">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">我的打法</div>
              <select
                value={meStyle}
                onChange={(e) => setMeStyle(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">我的弱点</div>
              <select
                value={meWeak}
                onChange={(e) => setMeWeak(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                {WEAKNESS_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="text-white font-bold mb-4 flex items-center gap-2">
            <Activity size={18} className="text-slate-300" />
            对手信息
          </div>
          <div className="space-y-4">
            <label className="block">
              <div className="text-xs text-slate-400 mb-1">对手打法</div>
              <select
                value={oppStyle}
                onChange={(e) => setOppStyle(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-slate-400 mb-1">对手弱点</div>
              <select
                value={oppWeak}
                onChange={(e) => setOppWeak(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              >
                {WEAKNESS_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="text-white font-bold mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-amber-300" />
            预测
          </div>
          <div className="text-sm text-slate-400">
            初始胜率 50%，按规则加减后输出 0-100%
          </div>
          <button
            type="button"
            className="mt-5 w-full px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 active:bg-red-700 transition"
            onClick={() => {
              const base = `${meStyle}|${meWeak}|${oppStyle}|${oppWeak}|${Date.now()}`;
              setResult({ seed: hashString32(base) });
            }}
          >
            开始预测
          </button>

          {computed ? (
            <div className="mt-6 bg-slate-950/40 border border-slate-800 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">胜率预测</div>
              <div className="text-white font-extrabold text-4xl">
                {computed.win}%
              </div>
            </div>
          ) : (
            <div className="mt-6 text-slate-500 text-sm border border-slate-800/60 rounded-xl p-4 bg-slate-950/20">
              点击“开始预测”查看胜率与分析
            </div>
          )}
        </div>
      </div>

      {computed ? (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <div className="text-white font-bold mb-3">AI分析 · 优势</div>
            <div className="space-y-2 text-sm text-slate-200">
              {(computed.advantages.length ? computed.advantages : ["暂无明显优势规则触发，建议以发接发抢前三板争取主动。"]).map(
                (t, idx) => (
                  <div
                    key={`a-${idx}`}
                    className="bg-emerald-900/10 border border-emerald-900/30 rounded-xl px-4 py-3"
                  >
                    {t}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <div className="text-white font-bold mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              AI分析 · 风险
            </div>
            <div className="space-y-2 text-sm text-slate-200">
              {(computed.risks.length ? computed.risks : ["暂无明显风险规则触发，注意保持稳定性与落点变化。"]).map(
                (t, idx) => (
                  <div
                    key={`r-${idx}`}
                    className="bg-red-900/10 border border-red-900/30 rounded-xl px-4 py-3"
                  >
                    {t}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
