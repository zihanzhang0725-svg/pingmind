import React, { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function BookingModal({
  open,
  coach,
  userId,
  username,
  onClose,
  onBooked,
}) {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("19:00");
  const [trainingContent, setTrainingContent] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      open &&
      coach &&
      Number.isFinite(Number(coach?.id)) &&
      String(coach?.name || "").trim() &&
      date &&
      time &&
      trainingContent.trim() &&
      location.trim() &&
      phone.trim() &&
      !submitting
    );
  }, [open, coach, date, time, trainingContent, location, phone, submitting]);

  const close = () => {
    if (submitting) return;
    setError("");
    setSuccess(false);
    if (onClose) onClose();
  };

  const submit = async () => {
    setError("");
    setSuccess(false);
    setSubmitting(true);
    try {
      const resolvedUserId = Number(userId);
      const resolvedUsername = String(username || "当前用户").trim() || "当前用户";

      const payload = {
        coachId: Number(coach.id),
        coachName: String(coach.name || "").trim(),
        userId: Number.isFinite(resolvedUserId) && resolvedUserId > 0 ? resolvedUserId : undefined,
        username: resolvedUsername,
        userName: resolvedUsername,
        date,
        time,
        trainingContent: trainingContent.trim(),
        location: location.trim(),
        phone: phone.trim(),
      };

      const resp = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${resp.status}`);
      }
      setSuccess(true);
      if (onBooked) onBooked(data.booking);
    } catch (e) {
      setError(e?.message || "预约失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={close} role="presentation" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div className="min-w-0">
              <div className="text-white font-extrabold text-lg truncate">预约教练</div>
              <div className="text-slate-400 text-sm mt-1 truncate">
                {coach?.name ? `教练：${coach.name}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 hover:border-slate-600"
              aria-label="Close"
              disabled={submitting}
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-xs text-slate-400 mb-1">日期</div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                />
              </label>

              <label className="block">
                <div className="text-xs text-slate-400 mb-1">时间</div>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="text-xs text-slate-400 mb-1">训练内容</div>
                <input
                  value={trainingContent}
                  onChange={(e) => setTrainingContent(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                  placeholder="例如：发接发前三板 / 反手体系 / 步法体能"
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="text-xs text-slate-400 mb-1">地点</div>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                  placeholder="例如：北体体育馆 / 学校训练馆"
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="text-xs text-slate-400 mb-1">手机号</div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
                  placeholder="用于联系确认"
                />
              </label>
            </div>

            {error ? (
              <div className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-4 text-sm text-emerald-300 bg-emerald-950/20 border border-emerald-900/40 rounded-xl px-4 py-3">
                预约成功（等待教练确认）
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
                disabled={submitting}
              >
                取消
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className={`px-5 py-2.5 rounded-xl font-semibold transition inline-flex items-center gap-2 ${
                  canSubmit
                    ? "bg-red-600 text-white hover:bg-red-500 active:bg-red-700"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                提交预约
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

