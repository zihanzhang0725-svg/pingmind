import React, { useMemo, useState } from "react";
import { Loader2, UserPlus, LogIn } from "lucide-react";

export default function Register({ onRegistered, onGoLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return username.trim() && password.trim() && !submitting;
  }, [username, password, submitting]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || data?.message || `HTTP ${resp.status}`);
      if (onRegistered) onRegistered(data.user);
    } catch (err) {
      setError(err?.message || "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="text-white text-2xl font-black">注册</div>
        <div className="text-slate-400 text-sm mt-2">创建账号后默认身份为用户，可在教练平台“成为教练”。</div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <div className="text-xs text-slate-400 mb-1">用户名</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-400 mb-1">密码</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-red-500/50"
              placeholder="请输入密码"
              autoComplete="new-password"
            />
          </label>

          {error ? (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
            注册并登录
          </button>
        </form>

        <div className="mt-5 text-sm text-slate-400 flex items-center justify-between">
          <span>已有账号？</span>
          <button
            type="button"
            onClick={() => (onGoLogin ? onGoLogin() : null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-200 hover:border-slate-600 transition"
          >
            <LogIn size={16} />
            去登录
          </button>
        </div>
      </div>
    </div>
  );
}

