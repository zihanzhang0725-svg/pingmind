import React, { useMemo, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";

const LEVEL_OPTIONS = [
  "国家级运动员",
  "省队/专业队",
  "体育院校专业",
  "高水平业余",
  "普通爱好者",
];

const SKILL_OPTIONS = [
  "发球",
  "接发球",
  "正手进攻",
  "反手技术",
  "相持能力",
  "步法训练",
  "战术意识",
  "心理训练",
];

const STUDENT_OPTIONS = ["初学者", "业余提升", "青少年训练", "比赛选手"];

const STYLE_OPTIONS = ["技术细节型", "实战对抗型", "体系训练型", "快乐教学型"];

const TEACHING_MODE_OPTIONS = ["一对一", "小班课", "陪练", "比赛指导"];

function toggleInList(list, value) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export default function BecomeCoach({ onBack, onSubmitted, userId }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [years, setYears] = useState("");
  const [coachType, setCoachType] = useState(""); // peer | professional
  const [affiliationName, setAffiliationName] = useState("");
  const [level, setLevel] = useState("");
  const [skills, setSkills] = useState([]);
  const [students, setStudents] = useState([]);
  const [style, setStyle] = useState("");
  const [teachingMode, setTeachingMode] = useState([]);
  const [price, setPrice] = useState("");
  const [intro, setIntro] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    const typeOk = coachType === "peer" || coachType === "professional";
    const affiliationOk =
      coachType === "peer" || coachType === "professional" ? affiliationName.trim() : true;
    return (
      name.trim() &&
      city.trim() &&
      typeOk &&
      affiliationOk &&
      Array.isArray(skills) &&
      skills.length > 0 &&
      Number.isFinite(Number(price)) &&
      Number(price) > 0 &&
      !submitting
    );
  }, [name, city, coachType, affiliationName, skills, price, submitting]);

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const yearsNum = years === "" ? 0 : Number(years);
      if (years !== "" && (!Number.isFinite(yearsNum) || yearsNum < 0)) {
        throw new Error("执教年限需要为非负数字");
      }

      const payload = {
        userId,
        name: name.trim(),
        city: city.trim(),
        years: Number.isFinite(yearsNum) ? yearsNum : 0,
        coachType: String(coachType || "").trim(),
        affiliationType: coachType === "peer" ? "school" : coachType === "professional" ? "org" : "",
        affiliationName: affiliationName.trim(),
        level: String(level || "").trim(),
        skills: (skills || []).slice(),
        students: (students || []).slice(),
        style: String(style || "").trim(),
        teachingMode: (teachingMode || []).slice(),
        price: Number(price),
        intro: intro.trim(),
      };

      const resp = await fetch("/api/register-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        const msg = data?.error || data?.message || `HTTP ${resp.status}`;
        throw new Error(msg);
      }
      if (onSubmitted) onSubmitted(data.coach, data.user);
    } catch (e) {
      setError(e?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fadeIn">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            type="button"
            onClick={() => (onBack ? onBack() : null)}
            className="flex items-center text-slate-400 hover:text-white mb-4"
          >
            <ChevronLeft size={20} /> 返回
          </button>
          <h1 className="text-3xl font-black text-white">成为教练</h1>
          <p className="text-slate-400 mt-2 text-sm">
            填写完整注册信息后提交，系统将生成结构化教练画像，便于后续AI推荐匹配。
          </p>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="space-y-8">
          <section>
            <h2 className="text-white font-extrabold text-lg">基础信息</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">
                  姓名 <span className="text-red-400">*</span>
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                  placeholder="例如：王强"
                />
              </label>

              <label className="block">
                <div className="text-xs text-slate-400 mb-1">
                  城市 <span className="text-red-400">*</span>
                </div>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                  placeholder="例如：北京"
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="text-xs text-slate-400 mb-1">执教年限</div>
                <input
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  inputMode="numeric"
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                  placeholder="例如：8"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">教练身份</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">
                  成为 <span className="text-red-400">*</span>
                </div>
                <select
                  value={coachType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCoachType(v);
                    setAffiliationName("");
                  }}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                >
                  <option value="">请选择</option>
                  <option value="peer">校园陪练</option>
                  <option value="professional">专业教练</option>
                </select>
              </label>

              {coachType === "peer" ? (
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">
                    学校名称 <span className="text-red-400">*</span>
                  </div>
                  <input
                    value={affiliationName}
                    onChange={(e) => setAffiliationName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                    placeholder="例如：北京大学"
                  />
                </label>
              ) : coachType === "professional" ? (
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1">
                    机构名称 <span className="text-red-400">*</span>
                  </div>
                  <input
                    value={affiliationName}
                    onChange={(e) => setAffiliationName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                    placeholder="例如：XX乒乓球俱乐部"
                  />
                </label>
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">教练水平</h2>
            <div className="mt-4">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">level</div>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                >
                  <option value="">请选择</option>
                  {LEVEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">技术专长</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SKILL_OPTIONS.map((opt) => {
                const checked = Array.isArray(skills) && skills.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-3 bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSkills((prev) => toggleInList(prev, opt))}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              <span className="text-red-400">*</span> 至少选择 1 项
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">擅长学员类型</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STUDENT_OPTIONS.map((opt) => {
                const checked = Array.isArray(students) && students.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-3 bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setStudents((prev) => toggleInList(prev, opt))}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">教学风格</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STYLE_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-3 bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                >
                  <input
                    type="radio"
                    name="coachStyle"
                    checked={style === opt}
                    onChange={() => setStyle(opt)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">教学方式</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEACHING_MODE_OPTIONS.map((opt) => {
                const checked = Array.isArray(teachingMode) && teachingMode.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-3 bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setTeachingMode((prev) => toggleInList(prev, opt))}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">价格</h2>
            <div className="mt-4">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">
                  元/小时 <span className="text-red-400">*</span>
                </div>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="numeric"
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                  placeholder="例如：300"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-white font-extrabold text-lg">个人简介</h2>
            <div className="mt-4">
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={4}
                className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                placeholder="例如：前省队队员，擅长反手体系训练..."
              />
            </div>
          </section>

          {error ? (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition ${
              canSubmit
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
            提交并加入教练平台
          </button>
        </div>
      </div>
    </div>
  );
}
