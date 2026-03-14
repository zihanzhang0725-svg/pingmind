import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, UserCheck } from "lucide-react";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function num(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
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

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${className}`}>
      {children}
    </span>
  );
}

function statusMeta(status) {
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

export default function CoachDashboard({ coachId, coachName }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);

  const load = async () => {
    if (!coachId) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const list = await fetchJson(`/api/bookings?coachId=${encodeURIComponent(coachId)}`);
      setBookings(asArray(list).slice().sort((a, b) => num(b?.id, 0) - num(a?.id, 0)));
    } catch (e) {
      setBookings([]);
      setError(e?.message || "预约加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  const pendingCount = useMemo(
    () => bookings.filter((b) => String(b?.status || "pending") !== "confirmed").length,
    [bookings]
  );
  const confirmedCount = useMemo(
    () => bookings.filter((b) => String(b?.status || "pending") === "confirmed").length,
    [bookings]
  );

  const confirmBooking = async (id) => {
    const bid = Number(id);
    if (!Number.isFinite(bid) || bid <= 0) return;
    setConfirmingId(bid);
    try {
      await fetchJson(`/api/bookings/${encodeURIComponent(bid)}/confirm`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e?.message || "确认失败");
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-white">教练工作台</h1>
          <div className="text-slate-400 text-sm mt-2">
            {coachName ? (
              <>
                当前教练：<span className="text-slate-200">{coachName}</span>
              </>
            ) : (
              "查看学员预约并确认上课"
            )}
            <span className="mx-2 text-slate-600">•</span>
            正在预约中：<span className="text-slate-200">{pendingCount}</span>
            <span className="mx-2 text-slate-600">/</span>
            已预约：<span className="text-slate-200">{confirmedCount}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-200 hover:border-slate-600 transition disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          刷新
        </button>
      </div>

      {error ? (
        <div className="mb-5 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
          {error}
        </div>
      ) : null}

      {!coachId ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
          你还不是教练账号：请先在教练平台点击“成为教练”，系统会为你生成 coachId。
        </div>
      ) : loading ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
          加载中...
        </div>
      ) : bookings.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bookings.map((b) => {
            const meta = statusMeta(b?.status);
            const canConfirm = String(b?.status || "pending") !== "confirmed";
            return (
              <div
                key={`cb-${b?.id}`}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white font-extrabold truncate">
                    {b?.username || b?.userName || "学员"}{" "}
                    <span className="text-slate-400 font-normal">
                      #{String(b?.id || "").slice(-6)}
                    </span>
                  </div>
                  <Badge className={meta.badgeClass}>{meta.label}</Badge>
                </div>

                <div className="mt-3 text-sm text-slate-300 space-y-1">
                  <div>时间：{b?.date || "-"} {b?.time || ""}</div>
                  <div>地点：{b?.location || "-"}</div>
                  <div>内容：{b?.content || "-"}</div>
                  <div className="text-slate-500">联系方式：{b?.phone || "-"}</div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-3">
                  {canConfirm ? (
                    <button
                      type="button"
                      onClick={() => confirmBooking(b?.id)}
                      disabled={confirmingId === Number(b?.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition disabled:opacity-60"
                    >
                      {confirmingId === Number(b?.id) ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <UserCheck size={16} />
                      )}
                      确认预约
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-emerald-300 text-sm font-semibold">
                      <CheckCircle2 size={16} />
                      已确认
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
          暂无预约记录。
        </div>
      )}
    </div>
  );
}

