"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      setError("비밀번호가 올바르지 않습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <GlassCard className="w-full max-w-sm" padding="lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-sage-dark mb-2">InstaAgent</h1>
          <p className="text-charcoal-light text-sm">오늘부동산 콘텐츠 에이전트</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
              autoFocus
              className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50"
          >
            {loading ? "확인 중..." : "입장"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
