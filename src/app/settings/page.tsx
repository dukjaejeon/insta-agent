"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const LOCATIONS = ["도봉구", "노원구", "강북구", "의정부시"];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    business_name: "",
    business_phone: "",
    license_number: "",
    default_locations: [] as string[],
  });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const user = { id: getCurrentUserId() };

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setForm({
          display_name: data.display_name ?? "",
          business_name: data.business_name ?? "",
          business_phone: data.business_phone ?? "",
          license_number: data.license_number ?? "",
          default_locations: data.default_locations ?? [],
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleLocation = (loc: string) => {
    setForm((prev) => ({
      ...prev,
      default_locations: prev.default_locations.includes(loc)
        ? prev.default_locations.filter((l) => l !== loc)
        : [...prev.default_locations, loc],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const user = { id: getCurrentUserId() };

    const update: ProfileUpdate = {
      display_name: form.display_name || null,
      business_name: form.business_name || null,
      business_phone: form.business_phone || null,
      license_number: form.license_number || null,
      default_locations: form.default_locations,
    };

    if (profile) {
      await supabase.from("profiles").update(update).eq("id", user.id);
    } else {
      await supabase.from("profiles").insert({ id: user.id, ...update });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-bg-primary">
          <Navigation />
          <div className="flex justify-center items-center py-32">
            <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <h1 className="text-2xl font-bold text-charcoal mb-6">설정</h1>

          <div className="space-y-4">
            {/* 프로필 */}
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">중개사 프로필</h2>
              <div className="space-y-3">
                <FormField label="이름">
                  <input
                    name="display_name"
                    value={form.display_name}
                    onChange={handleChange}
                    placeholder="홍길동"
                    className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                  />
                </FormField>
                <FormField label="중개사무소명">
                  <input
                    name="business_name"
                    value={form.business_name}
                    onChange={handleChange}
                    placeholder="오늘부동산"
                    className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="전화번호">
                    <input
                      name="business_phone"
                      value={form.business_phone}
                      onChange={handleChange}
                      placeholder="010-0000-0000"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </FormField>
                  <FormField label="중개사 등록번호">
                    <input
                      name="license_number"
                      value={form.license_number}
                      onChange={handleChange}
                      placeholder="11350-2024-00000"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </FormField>
                </div>
              </div>
            </GlassCard>

            {/* 담당 지역 */}
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-3">담당 지역</h2>
              <p className="text-xs text-charcoal-light mb-3">
                콘텐츠 생성 시 기본으로 적용할 지역을 선택하세요
              </p>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => toggleLocation(loc)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      form.default_locations.includes(loc)
                        ? "bg-sage text-white"
                        : "border border-border-soft text-charcoal-light hover:bg-white/80"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* 비용 모니터링 */}
            <CostMonitorCard />

            {/* 저장 버튼 */}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50/50 transition-colors"
              >
                로그아웃
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? "저장 중..." : saved ? "✓ 저장됨" : "설정 저장"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-charcoal-light mb-1">{label}</label>
      {children}
    </div>
  );
}

function CostMonitorCard() {
  const [costs, setCosts] = useState<{
    total: number;
    thisMonth: number;
    breakdown: Array<{ stage: string; cost: number; count: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data: allCalls } = await supabase.from("llm_calls").select("cost_usd, stage, created_at");

      if (allCalls) {
        const total = allCalls.reduce((s, c) => s + (c.cost_usd ?? 0), 0);
        const thisMonth = allCalls
          .filter((c) => c.created_at && new Date(c.created_at) >= monthStart)
          .reduce((s, c) => s + (c.cost_usd ?? 0), 0);

        const stageMap = new Map<string, { cost: number; count: number }>();
        for (const c of allCalls) {
          const stage = c.stage ?? "unknown";
          const entry = stageMap.get(stage) ?? { cost: 0, count: 0 };
          entry.cost += c.cost_usd ?? 0;
          entry.count += 1;
          stageMap.set(stage, entry);
        }

        setCosts({
          total,
          thisMonth,
          breakdown: Array.from(stageMap.entries())
            .map(([stage, v]) => ({ stage, ...v }))
            .sort((a, b) => b.cost - a.cost),
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <GlassCard>
      <h2 className="text-base font-semibold text-charcoal mb-4">LLM 비용 모니터링</h2>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-sage border-t-transparent rounded-full animate-spin" />
        </div>
      ) : costs ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="px-4 py-3 rounded-xl bg-sage/5 border border-sage/10">
              <p className="text-xs text-charcoal-light">이번 달</p>
              <p className="text-xl font-bold text-charcoal">${costs.thisMonth.toFixed(3)}</p>
            </div>
            <div className="px-4 py-3 rounded-xl bg-sage/5 border border-sage/10">
              <p className="text-xs text-charcoal-light">누계</p>
              <p className="text-xl font-bold text-charcoal">${costs.total.toFixed(3)}</p>
            </div>
          </div>
          {costs.breakdown.length > 0 && (
            <div>
              <p className="text-xs font-medium text-charcoal-light mb-2">단계별 비용</p>
              <div className="space-y-1.5">
                {costs.breakdown.map((item) => (
                  <div key={item.stage} className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light font-mono text-xs">{item.stage}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-charcoal-light/60 text-xs">{item.count}회</span>
                      <span className="text-charcoal font-medium">${item.cost.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-charcoal-light/60">LLM 호출 기록이 없습니다.</p>
      )}
    </GlassCard>
  );
}
