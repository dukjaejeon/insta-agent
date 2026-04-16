"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { ViralBadge } from "@/components/ui/ViralBadge";
import { RecommendBadge } from "@/components/ui/RecommendBadge";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type BenchmarkAccount = Database["public"]["Tables"]["benchmark_accounts"]["Row"];
type Analysis = Database["public"]["Tables"]["analyses"]["Row"];
type Playbook = Database["public"]["Tables"]["playbooks"]["Row"];
type VoiceProfile = Database["public"]["Tables"]["voice_profiles"]["Row"];

interface DeltaSummary {
  headline?: string;
  new_patterns?: string[];
  lost_patterns?: string[];
  viral_change?: number;
  portfolio_shift?: string;
  recommendation?: string;
  new_playbooks?: Array<{ code: string; name: string }>;
  lost_playbooks?: Array<{ code: string; name: string }>;
  prev_analysis_date?: string;
  curr_analysis_date?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  listing: "매물 광고",
  market_info: "시세 정보",
  lifestyle: "라이프스타일",
  authority: "전문성",
  engagement: "인게이지먼트",
};

const CATEGORY_COLORS: Record<string, string> = {
  listing: "#87A96B",
  market_info: "#5A9BD3",
  lifestyle: "#D4A574",
  authority: "#9B7DD4",
  engagement: "#D47D7D",
};

export default function BenchmarkReportPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<BenchmarkAccount | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [latestDelta, setLatestDelta] = useState<DeltaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningDelta, setRunningDelta] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [accountRes, analysisRes, playbookRes, voiceRes, deltaRes] = await Promise.all([
      supabase.from("benchmark_accounts").select("*").eq("id", accountId).single(),
      supabase.from("analyses").select("*").eq("account_id", accountId).eq("status", "completed").order("completed_at", { ascending: false }).limit(1).single(),
      supabase.from("playbooks").select("*").eq("source_account_id", accountId).order("created_at", { ascending: false }),
      supabase.from("voice_profiles").select("*").eq("source_account_id", accountId).single(),
      supabase.from("analysis_deltas").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).single(),
    ]);
    setAccount(accountRes.data);
    setLatestAnalysis(analysisRes.data);
    setPlaybooks(playbookRes.data ?? []);
    setVoiceProfile(voiceRes.data);
    setLatestDelta(deltaRes.data?.delta_summary as DeltaSummary | null ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [accountId]);

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

  if (!account) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-bg-primary">
          <Navigation />
          <div className="max-w-7xl mx-auto px-6 py-8">
            <p className="text-charcoal-light">계정을 찾을 수 없습니다.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const portfolioBreakdown =
    (latestAnalysis?.portfolio_breakdown as Record<string, number>) ?? {};
  const totalPosts = Object.values(portfolioBreakdown).reduce(
    (sum, n) => sum + n, 0
  );
  const viralHighlights =
    (latestAnalysis?.viral_highlights as Array<{
      post_id: string;
      why_viral_replicable: string[];
      application_warnings: string[];
    }>) ?? [];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* 헤더 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/benchmarks"
                  className="text-charcoal-light hover:text-charcoal text-sm"
                >
                  벤치마크
                </Link>
                <span className="text-charcoal-light/40">/</span>
                <span className="text-sm text-charcoal">{account.handle}</span>
              </div>
              <h1 className="text-2xl font-bold text-charcoal">
                {account.handle}
              </h1>
              {account.display_name && (
                <p className="text-charcoal-light">{account.display_name}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="w-9 h-9 rounded-xl border border-border-soft flex items-center justify-center text-charcoal-light hover:bg-white/80 transition-colors disabled:opacity-40"
                title="새로고침"
              >
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!confirm(`"${account.handle}" 계정을 삭제하시겠습니까?\n분석 데이터, Playbook 등 모든 관련 데이터가 삭제됩니다.`)) return;
                  setDeleting(true);
                  const supabase = createClient();
                  await supabase.from("benchmark_accounts").delete().eq("id", accountId);
                  router.push("/benchmarks");
                }}
                className="px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting ? (
                  <><span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> 삭제 중...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    삭제
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={runningDelta}
                onClick={async () => {
                  setRunningDelta(true);
                  const supabase = createClient();
                  const { data } = await supabase.functions.invoke("analyze-delta", {
                    body: { account_id: accountId },
                  });
                  if (data?.summary) setLatestDelta(data.summary as DeltaSummary);
                  setRunningDelta(false);
                }}
                className="px-4 py-2 rounded-xl border border-sage/30 text-sage-dark text-sm hover:bg-sage/5 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {runningDelta ? (
                  <><span className="w-3 h-3 border border-sage-dark border-t-transparent rounded-full animate-spin" /> 델타 분석 중...</>
                ) : "델타 분석"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/benchmarks/new?reanalyze=${accountId}`)}
                className="px-4 py-2 rounded-xl border border-border-soft text-charcoal-light text-sm hover:bg-white/80 transition-colors"
              >
                재분석
              </button>
            </div>
          </div>

          {latestAnalysis ? (
            <div className="space-y-6">
              {/* 델타 카드 */}
              {latestDelta && (
                <GlassCard>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
                      <span className="text-sm">📈</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-sm font-semibold text-charcoal">변화 감지 리포트</h2>
                        {latestDelta.prev_analysis_date && latestDelta.curr_analysis_date && (
                          <span className="text-xs text-charcoal-light/60">
                            {new Date(latestDelta.prev_analysis_date).toLocaleDateString("ko-KR")} →{" "}
                            {new Date(latestDelta.curr_analysis_date).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                      </div>
                      {latestDelta.headline && (
                        <p className="text-sm text-charcoal font-medium mb-3">{latestDelta.headline}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {latestDelta.new_patterns && latestDelta.new_patterns.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-sage-dark mb-1">새 패턴 발견</p>
                            <ul className="space-y-1">
                              {latestDelta.new_patterns.map((p, i) => (
                                <li key={i} className="text-xs text-charcoal flex items-start gap-1.5">
                                  <span className="text-sage mt-0.5">+</span>{p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {latestDelta.lost_patterns && latestDelta.lost_patterns.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-red-500 mb-1">약화된 패턴</p>
                            <ul className="space-y-1">
                              {latestDelta.lost_patterns.map((p, i) => (
                                <li key={i} className="text-xs text-charcoal-light flex items-start gap-1.5">
                                  <span className="text-red-400 mt-0.5">−</span>{p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {latestDelta.new_playbooks && latestDelta.new_playbooks.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-charcoal-light mb-1">새 Playbook</p>
                            <div className="flex flex-wrap gap-1">
                              {latestDelta.new_playbooks.map((pb, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-full bg-sage/10 text-sage-dark text-xs">
                                  {pb.code}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {latestDelta.recommendation && (
                        <div className="mt-3 pt-3 border-t border-border-soft">
                          <p className="text-xs font-medium text-charcoal-light mb-1">추천 액션</p>
                          <p className="text-sm text-charcoal">{latestDelta.recommendation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* 포트폴리오 도넛 차트 섹션 */}
              <GlassCard>
                <h2 className="text-base font-semibold text-charcoal mb-4">
                  포트폴리오 분포
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
                  {/* 단순 바 차트 (Canvas 없이) */}
                  <div className="flex-1 space-y-2">
                    {Object.entries(portfolioBreakdown).map(([cat, count]) => {
                      const pct = totalPosts > 0 ? (count / totalPosts) * 100 : 0;
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-sm text-charcoal-light w-24 text-right">
                            {CATEGORY_LABELS[cat] ?? cat}
                          </span>
                          <div className="flex-1 h-6 bg-white/40 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: CATEGORY_COLORS[cat] ?? "#87A96B",
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-charcoal w-12">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 비용·시간 요약 */}
                  <div className="w-48 space-y-3">
                    <div className="px-4 py-3 rounded-xl bg-sage/5 border border-sage/10">
                      <p className="text-xs text-charcoal-light">분석 비용</p>
                      <p className="text-lg font-bold text-charcoal">
                        ${latestAnalysis.total_cost_usd?.toFixed(2) ?? "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3 rounded-xl bg-sage/5 border border-sage/10">
                      <p className="text-xs text-charcoal-light">LLM 호출 수</p>
                      <p className="text-lg font-bold text-charcoal">
                        {latestAnalysis.llm_call_count ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Viral 하이라이트 섹션 */}
              {viralHighlights.length > 0 && (
                <GlassCard>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-base font-semibold text-charcoal">
                      Viral 하이라이트
                    </h2>
                    <ViralBadge />
                    <span className="text-sm text-charcoal-light">
                      {viralHighlights.length}건
                    </span>
                  </div>
                  <div className="space-y-4">
                    {viralHighlights.map((vh, i) => (
                      <div
                        key={vh.post_id}
                        className="p-4 rounded-2xl bg-red-50/30 border border-red-200/30"
                      >
                        <p className="text-xs font-medium text-red-500 mb-2">
                          Viral #{i + 1}
                        </p>
                        {vh.why_viral_replicable?.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-charcoal-light mb-1">
                              복제 가능 요인
                            </p>
                            <ul className="space-y-1">
                              {vh.why_viral_replicable.map((r, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm text-charcoal">
                                  <span className="text-sage mt-0.5">✓</span>
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {vh.application_warnings?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-amber-600 mb-1">
                              적용 시 주의
                            </p>
                            <ul className="space-y-1">
                              {vh.application_warnings.map((w, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm text-charcoal-light">
                                  <span className="text-amber-500 mt-0.5">⚠</span>
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Playbook 라이브러리 */}
              <GlassCard>
                <h2 className="text-base font-semibold text-charcoal mb-4">
                  Playbook 라이브러리
                </h2>
                {playbooks.length === 0 ? (
                  <p className="text-sm text-charcoal-light/60 text-center py-6">
                    추출된 Playbook이 없습니다
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {playbooks.map((pb) => (
                      <Link key={pb.id} href={`/playbooks/${pb.id}`}>
                        <div className="p-4 rounded-2xl bg-white/50 border border-border-soft hover:shadow-glass hover:bg-white/70 transition-all cursor-pointer">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-xs text-charcoal-light/60 font-mono">
                                {pb.code}
                              </p>
                              <h3 className="font-semibold text-charcoal">
                                {pb.name}
                              </h3>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              {pb.derived_from_viral && <ViralBadge />}
                              {pb.is_recommended && <RecommendBadge />}
                            </div>
                          </div>
                          {pb.category && (
                            <span className="text-xs text-charcoal-light">
                              {CATEGORY_LABELS[pb.category] ?? pb.category}
                            </span>
                          )}
                          {pb.avg_engagement_rate != null && (
                            <p className="text-xs text-sage-dark font-medium mt-1">
                              평균 참여율 {(pb.avg_engagement_rate * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* 톤 프로파일 */}
              {voiceProfile && (
                <GlassCard>
                  <h2 className="text-base font-semibold text-charcoal mb-4">
                    톤 프로파일
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* 어미 비율 */}
                    {voiceProfile.ending_ratio && (
                      <div>
                        <p className="text-xs font-medium text-charcoal-light mb-2">
                          어미 비율
                        </p>
                        <div className="space-y-1.5">
                          {Object.entries(
                            voiceProfile.ending_ratio as Record<string, number>
                          ).map(([ending, ratio]) => (
                            <div key={ending} className="flex items-center gap-2">
                              <span className="text-sm text-charcoal w-20">{ending}</span>
                              <div className="flex-1 h-2 bg-sage-light/20 rounded-full">
                                <div
                                  className="h-full bg-sage rounded-full"
                                  style={{ width: `${(ratio * 100).toFixed(0)}%` }}
                                />
                              </div>
                              <span className="text-xs text-charcoal-light w-10 text-right">
                                {(ratio * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 금지 문구 블랙리스트 */}
                    <div>
                      <p className="text-xs font-medium text-charcoal-light mb-2">
                        Signature Phrase 블랙리스트
                      </p>
                      {(voiceProfile.signature_phrases_blacklist ?? []).length > 0 ? (
                        <div className="space-y-1.5">
                          {(voiceProfile.signature_phrases_blacklist ?? []).map(
                            (phrase, i) => (
                              <div
                                key={i}
                                className="px-3 py-1.5 rounded-xl bg-red-50/50 border border-red-200/50 text-sm text-red-700"
                              >
                                🚫 {phrase}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-charcoal-light/60">없음</p>
                      )}
                    </div>

                    {/* 고빈도 어휘 */}
                    {(voiceProfile.vocabulary_high_freq ?? []).length > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-charcoal-light mb-2">
                          고빈도 어휘
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(voiceProfile.vocabulary_high_freq ?? []).map((w, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-full text-sm bg-sage-light/20 text-sage-dark"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}
            </div>
          ) : (
            /* 분석 전 상태 */
            <GlassCard className="text-center py-16">
              <p className="text-charcoal-light mb-4">아직 분석이 완료되지 않았습니다.</p>
              <button
                type="button"
                onClick={() => router.push(`/benchmarks/new?reanalyze=${accountId}`)}
                className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors"
              >
                분석 시작하기
              </button>
            </GlassCard>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
