import React, { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, PlusCircle, School, Star, Trash2, Users, X } from "lucide-react";
import BookingModal from "./BookingModal";

function num(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function resolvePublicUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const path = raw.replace(/^\/+/, "");
  const base =
    typeof window !== "undefined" && window.location?.protocol === "file:"
      ? "./"
      : import.meta.env.BASE_URL || "/";
  const normalizedBase = String(base).endsWith("/") ? String(base) : `${base}/`;
  return `${normalizedBase}${path}`;
}

function CoachAvatar({ name, avatar }) {
  const [broken, setBroken] = useState(false);
  const src = resolvePublicUrl(avatar);
  const showImg = src && !broken;
  return (
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden">
      {showImg ? (
        <img
          src={src}
          alt={name || "coach"}
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
          loading="lazy"
        />
      ) : (
        <Users className="text-slate-300" size={28} />
      )}
    </div>
  );
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function displayDistance(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d)) return "-";
  if (d < 1) return `${Math.round(d * 1000)}m`;
  return `${d.toFixed(1)}km`;
}

function coachTypeLabel(t) {
  if (t === "professional") return "专业教练";
  if (t === "amateur") return "业余教练";
  if (t === "peer") return "校园陪练";
  return String(t || "");
}

function affiliationLabel(coach) {
  const type = String(coach?.affiliationType || "").trim();
  const name = String(coach?.affiliationName || "").trim();
  if (!name) return "";
  if (type === "school") return `学校：${name}`;
  if (type === "org") return `机构：${name}`;
  return name;
}

function CoachDetailModal({ open, coach, onClose, onBook }) {
  if (!open || !coach) return null;

  const isPeer = String(coach?.coachType || "").trim() === "peer";
  const aff = affiliationLabel(coach);
  const title = coach?.name || (isPeer ? "陪练" : "教练");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <CoachAvatar name={coach?.name} avatar={coach?.avatar} />
            <div className="min-w-0">
              <div className="text-white font-extrabold text-lg truncate">{title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} className="text-slate-500" />
                  <span className="truncate">{coach?.city || "-"}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300">{coachTypeLabel(coach?.coachType) || "教练"}</span>
                {coach?.level ? (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-300">{coach.level}</span>
                  </>
                ) : null}
              </div>
              {aff ? (
                <div className="mt-2 text-xs text-slate-300 flex items-center gap-2">
                  {String(coach?.affiliationType || "") === "school" ? (
                    <School size={14} className="text-slate-500" />
                  ) : (
                    <Building2 size={14} className="text-slate-500" />
                  )}
                  <span className="truncate">{aff}</span>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">价格</div>
            <div className="mt-1 text-white font-black text-2xl">￥{num(coach?.price, 0)} / 小时</div>
            {Number(coach?.years) ? (
              <div className="mt-2 text-sm text-slate-300">执教年限：{num(coach?.years, 0)} 年</div>
            ) : null}
            {asArray(coach?.teachingMode).length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {asArray(coach?.teachingMode).slice(0, 8).map((m) => (
                  <span
                    key={`tm-${coach?.id}-${m}`}
                    className="text-xs px-2 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-300"
                  >
                    {m}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">技术专长</div>
            {asArray(coach?.skills).length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {asArray(coach?.skills).slice(0, 12).map((s) => (
                  <span
                    key={`sk-${coach?.id}-${s}`}
                    className="text-xs px-2 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-400">暂无</div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:col-span-2">
            <div className="text-xs text-slate-400">擅长学员类型</div>
            {asArray(coach?.students).length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {asArray(coach?.students).slice(0, 16).map((s) => (
                  <span
                    key={`st-${coach?.id}-${s}`}
                    className="text-xs px-2 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-400">暂无</div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:col-span-2">
            <div className="text-xs text-slate-400">简介</div>
            <div className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">
              {coach?.intro ? coach.intro : "暂无简介"}
            </div>
          </div>
        </div>

        <div className="p-5 pt-0 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
            onClick={onClose}
          >
            关闭
          </button>
          <button
            type="button"
            className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
            onClick={() => (onBook ? onBook(coach) : null)}
          >
            {isPeer ? "预约陪练" : "预约教练"}
          </button>
        </div>
      </div>
    </div>
  );
}

const FALLBACK_USER = {
  label: "教学楼",
  name: "当前用户",
  username: "当前用户",
  city: "北京",
  // Chosen so that peer coach "王同学" is ~200m away.
  location: { lat: 39.9932, lng: 116.316 },
};

export default function CoachMarket({ onBecomeCoach, userId = 1 }) {
  const [coaches, setCoaches] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userError, setUserError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingCoachId, setDeletingCoachId] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingCoach, setBookingCoach] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCoach, setDetailCoach] = useState(null);

  const load = async () => {
    setError("");
    setUserError("");
    setLoading(true);
    try {
      const [coachesResp, userResp] = await Promise.all([
        fetch("/api/coaches"),
        fetch(`/api/users/${encodeURIComponent(userId)}`),
      ]);

      const coachesData = await coachesResp.json().catch(() => null);
      if (!coachesResp.ok) throw new Error(coachesData?.error || `HTTP ${coachesResp.status}`);
      if (!Array.isArray(coachesData)) throw new Error("Invalid /api/coaches response");
      setCoaches(coachesData);

      const userData = await userResp.json().catch(() => null);
      if (userResp.ok && userData && typeof userData === "object") {
        setUser(userData);
      } else {
        setUser(FALLBACK_USER);
        setUserError(`用户位置不可用（${userData?.error || `HTTP ${userResp.status}` }），已使用“${FALLBACK_USER.label}”模拟位置`);
      }
    } catch (e) {
      setError(e?.message || "加载失败");
      setCoaches([]);
      setUser(FALLBACK_USER);
      setUserError(`用户位置不可用，已使用“${FALLBACK_USER.label}”模拟位置`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...(coaches || [])].sort((a, b) => {
      const ra = num(a?.rating, 0);
      const rb = num(b?.rating, 0);
      if (rb !== ra) return rb - ra;
      return num(a?.price, 0) - num(b?.price, 0);
    });
  }, [coaches]);

  const myCoach = useMemo(() => {
    const myCoachId = Number(user?.coachId);
    if (!Number.isFinite(myCoachId) || myCoachId <= 0) return null;
    return (coaches || []).find((c) => Number(c?.id) === myCoachId) || null;
  }, [coaches, user]);

  const nearbyPeers = useMemo(() => {
    const baseUser = user && typeof user === "object" ? user : FALLBACK_USER;
    const baseLoc =
      baseUser?.location && typeof baseUser.location === "object"
        ? baseUser.location
        : FALLBACK_USER.location;

    const ulat = Number(baseLoc?.lat);
    const ulng = Number(baseLoc?.lng);
    if (!Number.isFinite(ulat) || !Number.isFinite(ulng)) return [];

    const myCoachId = Number(baseUser?.coachId);
    const userCity = String(baseUser?.city || FALLBACK_USER.city || "").trim();

    return (coaches || [])
      .filter((c) => String(c?.coachType || "").trim() === "peer")
      .map((c) => {
        const clat = Number(c?.location?.lat);
        const clng = Number(c?.location?.lng);
        const isMine = Number.isFinite(myCoachId) && Number(c?.id) === myCoachId;
        const distance =
          isMine
            ? 0
            : Number.isFinite(clat) && Number.isFinite(clng)
              ? getDistance(ulat, ulng, clat, clng)
              : Number.POSITIVE_INFINITY;
        return { ...c, distance };
      })
      // Prefer nearby within 5km, but also keep same-city peers with unknown distance
      // so user-created records (older ones with missing location) can still be discovered.
      .filter((c) => {
        if (c.distance === 0) return true;
        if (Number.isFinite(c.distance) && c.distance < 5) return true;
        const city = String(c?.city || "").trim();
        return userCity && city && userCity === city && !Number.isFinite(c.distance);
      })
      .sort((a, b) => a.distance - b.distance);
  }, [coaches, user]);

  const openBooking = (coach) => {
    setBookingCoach(coach || null);
    setBookingOpen(true);
  };

  const openDetail = (coach) => {
    setDetailCoach(coach || null);
    setDetailOpen(true);
  };

  const canDeleteCoach = (coach) => {
    const myCoachId = Number(user?.coachId);
    const coachId = Number(coach?.id);
    return Number.isFinite(myCoachId) && Number.isFinite(coachId) && myCoachId === coachId;
  };

  const deleteCoach = async (coach) => {
    const coachId = Number(coach?.id);
    if (!Number.isFinite(coachId) || coachId <= 0) return;
    if (!window.confirm("确定删除你创建的教练信息吗？删除后将同时清除相关预约记录。")) return;

    setDeleteError("");
    setDeletingCoachId(coachId);
    try {
      const resp = await fetch(
        `/api/coaches/${encodeURIComponent(coachId)}?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }

      setCoaches((prev) => asArray(prev).filter((c) => Number(c?.id) !== coachId));
      setUser((prev) => {
        if (!prev || typeof prev !== "object") return prev;
        const prevCoachId = Number(prev?.coachId);
        if (!Number.isFinite(prevCoachId) || prevCoachId !== coachId) return prev;
        return { ...prev, coachId: null, role: "user" };
      });
    } catch (e) {
      setDeleteError(e?.message || "删除失败");
    } finally {
      setDeletingCoachId(null);
    }
  };

  const professionalDisplay = useMemo(() => {
    const list = sorted.filter((c) => String(c?.coachType || "").trim() !== "peer");
    const mine = myCoach && String(myCoach?.coachType || "").trim() !== "peer" ? myCoach : null;
    if (!mine) return list;
    return [mine, ...list.filter((c) => Number(c?.id) !== Number(mine?.id))];
  }, [sorted, myCoach]);

  const currentUsername =
    String(user?.username || user?.name || FALLBACK_USER.username).trim() || FALLBACK_USER.username;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
      <BookingModal
        open={bookingOpen}
        coach={bookingCoach}
        userId={userId}
        username={currentUsername}
        onClose={() => {
          setBookingOpen(false);
          setBookingCoach(null);
        }}
        onBooked={() => {
          // keep modal open to show success
        }}
      />

      <CoachDetailModal
        open={detailOpen}
        coach={detailCoach}
        onClose={() => {
          setDetailOpen(false);
          setDetailCoach(null);
        }}
        onBook={(c) => {
          setDetailOpen(false);
          setDetailCoach(null);
          openBooking(c);
        }}
      />

      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">教练平台</h1>
          <p className="text-slate-400 mt-2 text-sm">
            浏览教练画像，快速预约线下训练或线上指导
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 hover:border-red-500/40 hover:bg-slate-800 transition"
          onClick={() => (onBecomeCoach ? onBecomeCoach() : null)}
        >
          <PlusCircle size={18} />
          成为教练
        </button>
      </div>

      {error ? (
        <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>教练列表加载失败：{error}</div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
            onClick={load}
          >
            重试
          </button>
        </div>
      ) : null}

      {deleteError ? (
        <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
          删除失败：{deleteError}
        </div>
      ) : null}

      <div className="mb-10">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-white font-bold text-lg">校园陪练</div>
          </div>
          {user?.city ? (
            <div className="text-xs text-slate-400">
              当前城市：<span className="text-slate-200">{user.city}</span>
            </div>
          ) : null}
        </div>

        {userError ? <div className="mb-4 text-xs text-slate-500">{userError}</div> : null}

        {nearbyPeers.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {nearbyPeers.slice(0, 12).map((c) => (
              <div
                key={`peer-${c.id}`}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-blue-500/30 transition"
                role="button"
                tabIndex={0}
                onClick={() => openDetail(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openDetail(c);
                }}
              >
                <div className="flex items-center gap-4">
                  <CoachAvatar name={c?.name} avatar={c?.avatar} />
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-white font-extrabold truncate">{c?.name || "陪练"}</div>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-900/50 border border-blue-900/40 text-blue-300">
                          校园陪练
                        </span>
                        {canDeleteCoach(c) ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/40 border border-emerald-900/30 text-emerald-200">
                            我的
                          </span>
                        ) : null}
                      </div>

                      {canDeleteCoach(c) ? (
                        <button
                          type="button"
                          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-200 hover:border-red-500/40 hover:text-red-200 transition disabled:opacity-50"
                          title="删除我的教练信息"
                          disabled={Number(deletingCoachId) === Number(c?.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCoach(c);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <MapPin size={14} className="text-slate-500" />
                      <span className="truncate">{c?.city || "-"}</span>
                      <span className="text-green-400 font-semibold">
                        距离 {displayDistance(c.distance)}
                      </span>
                    </div>
                    {c?.affiliationName ? (
                      <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                        <School size={14} className="text-slate-500" />
                        <span className="truncate">{affiliationLabel(c)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {asArray(c?.skills)
                    .slice(0, 6)
                    .map((s) => (
                      <span
                        key={`ps-${c.id}-${s}`}
                        className="text-xs px-2 py-1 rounded-full bg-blue-900/40 border border-blue-900/30 text-blue-300"
                      >
                        {s}
                      </span>
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-slate-200 font-bold">￥{num(c?.price, 0)} / 小时</div>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      openBooking(c);
                    }}
                  >
                    预约陪练
                  </button>
                </div>

                <button
                  type="button"
                  className="mt-3 text-xs text-slate-400 hover:text-slate-200 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(c);
                  }}
                >
                  查看详情
                </button>
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
            加载中...
          </div>
        ) : (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
            附近 5km 内暂无陪练
          </div>
        )}
      </div>

      <div>
        <div className="text-white font-bold text-lg mb-4">专业教练</div>
        {loading ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
            加载中...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {professionalDisplay.map((c) => (
              <div
                key={`coach-${c.id}`}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-red-500/30 transition"
                role="button"
                tabIndex={0}
                onClick={() => openDetail(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openDetail(c);
                }}
              >
                <div className="flex items-center gap-4">
                  <CoachAvatar name={c?.name} avatar={c?.avatar} />
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-white font-extrabold truncate">{c?.name || "教练"}</div>
                        {c?.level ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-300">
                            {c.level}
                          </span>
                        ) : null}
                        {canDeleteCoach(c) ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/40 border border-emerald-900/30 text-emerald-200">
                            我的
                          </span>
                        ) : null}
                      </div>

                      {canDeleteCoach(c) ? (
                        <button
                          type="button"
                          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900/60 border border-slate-700 text-slate-200 hover:border-red-500/40 hover:text-red-200 transition disabled:opacity-50"
                          title="删除我的教练信息"
                          disabled={Number(deletingCoachId) === Number(c?.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCoach(c);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <MapPin size={14} className="text-slate-500" />
                      <span className="truncate">{c?.city || "-"}</span>
                      <span className="text-slate-600">·</span>
                      <span className="truncate">{coachTypeLabel(c?.coachType) || "教练"}</span>
                    </div>
                    {c?.affiliationName ? (
                      <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                        {String(c?.affiliationType || "") === "school" ? (
                          <School size={14} className="text-slate-500" />
                        ) : (
                          <Building2 size={14} className="text-slate-500" />
                        )}
                        <span className="truncate">{affiliationLabel(c)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-slate-300 text-sm font-semibold mb-2">技术专长</div>
                  <div className="flex flex-wrap gap-2">
                    {asArray(c?.skills)
                      .slice(0, 8)
                      .map((s) => (
                        <span
                          key={`cs-${c.id}-${s}`}
                          className="text-xs px-2 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-300"
                        >
                          {s}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-400">
                  {c?.intro ? c.intro : "暂无简介"}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Star size={16} className="text-yellow-400" />
                    <span className="font-semibold">{num(c?.rating, 0).toFixed(1)}</span>
                  </div>
                  <div className="text-slate-200 font-bold">￥{num(c?.price, 0)} / 小时</div>
                </div>

                <button
                  type="button"
                  className="mt-4 w-full px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBooking(c);
                  }}
                >
                  预约教练
                </button>

                <button
                  type="button"
                  className="mt-3 w-full text-xs text-slate-400 hover:text-slate-200 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(c);
                  }}
                >
                  查看详情
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
