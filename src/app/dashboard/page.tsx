"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";

interface WeeklySuggestion {
  day: string;
  format: string;
  topic: string;
  caption: string;
  hashtags: string[];
  basis: string;
}

interface DashboardStats {
  displayName: string | null;
  todayScheduled: number;
  pendingProposals: number;
  activeListings: number;
  benchmarkAccounts: number;
  totalPlaybooks: number;
  thisMonthCost: number;
  recentProposals: Array<{
    id: string;
    listing_title: string;
    scheduled_at: string | null;
    user_status: string;
    format: string | null;
  }>;
  topPlaybooks: Array<{
    id: string;
    code: string;
    name: string;
    avg_engagement_rate: number | null;
    is_recommended: boolean;
  }>;
  thisWeekCalendar: Array<{
    date: string;
    day: string;
    topic: string;
    category: string;
  }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  listing: "bg-sage/10 text-sage-dark",
  market_info: "bg-blue-50 text-blue-700",
  lifestyle: "bg-amber-50 text-amber-700",
  authority: "bg-purple-50 text-purple-700",
  engagement: "bg-pink-50 text-pink-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  listing: "매물",
  market_info: "시세",
  lifestyle: "라이프",
  authority: "전문성",
  engagement: "인게이지",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  posted: "게시 완료",
  rejected: "반려",
};

const FORMAT_LABEL: Record<string, string> = {
  carousel: "카드뉴스", reel: "릴스", photo: "사진",
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // 이번 주 콘텐츠 추천
  const [weeklyBrief, setWeeklyBrief] = useState<WeeklySuggestion[] | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const generateWeeklyBrief = async (sendDiscord = false) => {
    setBriefLoading(true);
    setBriefError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("generate-weekly-brief", {
        body: { user_id: getCurrentUserId(), send_discord: sendDiscord },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "생성 실패");
      setWeeklyBrief((data as { suggestions: WeeklySuggestion[] }).suggestions ?? []);
    } catch (err) {
      setBriefError((err as Error).message);
    } finally {
      setBriefLoading(false);
    }
  };

  const copyCaption = async (caption: string, hashtags: string[], idx: number) => {
    const fullText = `${caption}\n\n${hashtags.join(" ")}`;
    await navigator.clipboard.writeText(fullText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const userId = getCurrentUserId();
      const user = { id: userId };

      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // 이번 주 월요일
      const now = new Date();
      const monday = new Date(now);
      const day = monday.getDay();
      monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
      monday.setHours(0, 0, 0, 0);
      const weekStart = monday.toISOString().split("T")[0];

      const [
        profileRes,
        listingsRes,
        benchmarksRes,
        playbooksRes,
        proposalsRes,
        llmCallsRes,
        calendarRes,
      ] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).single(),
        supabase.from("listings").select("id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("benchmark_accounts").select("id").eq("user_id", user.id).eq("tracking_enabled", true),
        supabase
          .from("playbooks")
          .select("id, code, name, avg_engagement_rate, is_recommended")
          .eq("user_id", user.id)
          .order("avg_engagement_rate", { ascending: false })
          .limit(3),
        supabase
          .from("proposals")
          .select("id, listing_id, scheduled_at, user_status, reel_script, carousel_plan")
          .eq("user_status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("llm_calls")
          .select("cost_usd")
          .gte("created_at", monthStart.toISOString()),
        supabase
          .from("content_calendar")
          .select("plan")
          .eq("user_id", user.id)
          .eq("week_start", weekStart)
          .single(),
      ]);

      // 오늘 예정 게시물 수
      const todayProposals = (proposalsRes.data ?? []).filter((p) =>
        p.scheduled_at && p.scheduled_at.startsWith(today)
      );

      // 이번 주 캘린더에서 앞으로 예정된 포스팅 추출
      const calendarPlan = calendarRes.data?.plan as {
        days?: Array<{
          date: string;
          day: string;
          posts: Array<{ topic: string; category: string; time: string }>;
        }>;
      } | null;

      const upcomingPosts: DashboardStats["thisWeekCalendar"] = [];
      if (calendarPlan?.days) {
        for (const d of calendarPlan.days) {
          if (d.date >= today && d.posts.length > 0) {
            for (const p of d.posts.slice(0, 1)) {
              upcomingPosts.push({ date: d.date, day: d.day, topic: p.topic, category: p.category });
            }
          }
        }
      }

      // 매물 제목 조회
      const listingIds = (proposalsRes.data ?? []).map((p) => p.listing_id).filter(Boolean) as string[];
      const listingTitleMap: Record<string, string> = {};
      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from("listings")
          .select("id, title, complex_name, dong")
          .in("id", listingIds);
        for (const l of listings ?? []) {
          listingTitleMap[l.id] = l.title ?? (`${l.complex_name ?? ""} ${l.dong ?? ""}`.trim() || "매물");
        }
      }

      const thisMonthCost = (llmCallsRes.data ?? []).reduce((s, c) => s + (c.cost_usd ?? 0), 0);

      setStats({
        displayName: profileRes.data?.display_name ?? null,
        todayScheduled: todayProposals.length,
        pendingProposals: (proposalsRes.data ?? []).length,
        activeListings: (listingsRes.data ?? []).length,
        benchmarkAccounts: (benchmarksRes.data ?? []).length,
        totalPlaybooks: (playbooksRes.data ?? []).length,
        thisMonthCost,
        recentProposals: (proposalsRes.data ?? []).map((p) => ({
          id: p.id,
          listing_title: p.listing_id ? (listingTitleMap[p.listing_id] ?? "매물") : "매물",
          scheduled_at: p.scheduled_at,
          user_status: p.user_status,
          format: p.reel_script ? "릴스" : p.carousel_plan ? "캐러셀" : "사진",
        })),
        topPlaybooks: playbooksRes.data ?? [],
        thisWeekCalendar: upcomingPosts.slice(0, 4),
      });
      setLoading(false);
    };
    load();
  }, []);

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

  const s = stats!;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Row 1 — 인사말 */}
          <GlassCard className="mb-6" padding="lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-charcoal mb-1">
                  안녕하세요{s.displayName ? `, ${s.displayName}` : ""} 선생님
                </h1>
                <p className="text-charcoal-light">
                  오늘 발행 예정{" "}
                  <span className={s.todayScheduled > 0 ? "text-sage-dark font-semibold" : ""}>
                    {s.todayScheduled}건
                  </span>
                  {" "}·{" "}
                  미응답 제안{" "}
                  <span className={s.pendingProposals > 0 ? "text-amber-600 font-semibold" : ""}>
                    {s.pendingProposals}건
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/listings/new"
                  className="px-4 py-2 rounded-xl bg-sage text-white text-sm font-medium hover:bg-sage-dark transition-colors"
                >
                  + 매물 등록
                </Link>
                <Link
                  href="/benchmarks/new"
                  className="px-4 py-2 rounded-xl border border-border-soft text-charcoal-light text-sm hover:bg-white/80 transition-colors"
                >
                  + 벤치마크
                </Link>
              </div>
            </div>
          </GlassCard>

          {/* ── 이번 주 콘텐츠 추천 ── */}
          <GlassCard className="mb-6" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-charcoal">이번 주 콘텐츠 추천</h2>
                <p className="text-xs text-charcoal-light mt-0.5">
                  벤치마크 Playbook + 최신 부동산 뉴스 기반
                </p>
              </div>
              <div className="flex gap-2">
                {weeklyBrief && (
                  <button
                    type="button"
                    onClick={() => generateWeeklyBrief(true)}
                    disabled={briefLoading}
                    className="px-3 py-1.5 rounded-xl border border-border-soft text-xs text-charcoal-light hover:bg-white/80 transition-colors disabled:opacity-50"
                  >
                    디스코드 공유
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => generateWeeklyBrief(false)}
                  disabled={briefLoading}
                  className="px-4 py-1.5 rounded-xl bg-sage text-white text-xs font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {briefLoading ? (
                    <>
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      생성 중...
                    </>
                  ) : weeklyBrief ? "다시 생성" : "생성하기"}
                </button>
              </div>
            </div>

            {/* 에러 */}
            {briefError && (
              <div className="rounded-xl bg-red-50 border border-red-200/50 px-4 py-3 text-sm text-red-600">
                {briefError}
              </div>
            )}

            {/* 로딩 */}
            {briefLoading && (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-charcoal-light">Playbook 분석 + 뉴스 검색 중...</p>
                <p className="text-xs text-charcoal-light/60">약 15~30초 소요</p>
              </div>
            )}

            {/* 결과 없음 (초기) */}
            {!briefLoading && !weeklyBrief && !briefError && (
              <div className="flex flex-col items-center py-8 gap-2 text-charcoal-light/50">
                <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-sm">벤치마크 Playbook을 기반으로 이번 주 올릴 콘텐츠 3개를 자동 기획합니다</p>
                <p className="text-xs">벤치마크 계정이 없으면 먼저 분석이 필요합니다</p>
              </div>
            )}

            {/* 추천 카드 3개 */}
            {!briefLoading && weeklyBrief && weeklyBrief.length > 0 && (
              <div className="space-y-3">
                {weeklyBrief.map((s, idx) => (
                  <div
                    key={idx}
                    className="border border-border-soft rounded-2xl overflow-hidden bg-white/40"
                  >
                    {/* 헤더 행 */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/60 transition-colors"
                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    >
                      <span className="w-8 h-8 rounded-full bg-sage/10 flex items-center justify-center text-sm font-bold text-sage-dark shrink-0">
                        {s.day}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-charcoal/5 text-charcoal-light font-medium shrink-0">
                        {FORMAT_LABEL[s.format] ?? s.format}
                      </span>
                      <p className="text-sm font-medium text-charcoal flex-1 truncate">{s.topic}</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); copyCaption(s.caption, s.hashtags, idx); }}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-sage text-white text-xs font-medium hover:bg-sage-dark transition-colors"
                      >
                        {copiedIdx === idx ? "복사됨 ✓" : "캡션 복사"}
                      </button>
                      <svg
                        className={`w-4 h-4 text-charcoal-light/40 transition-transform shrink-0 ${expandedIdx === idx ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* 펼쳐진 내용 */}
                    {expandedIdx === idx && (
                      <div className="px-4 pb-4 border-t border-border-soft bg-white/30 space-y-3 pt-3">
                        {/* 캡션 */}
                        <div>
                          <p className="text-xs font-medium text-charcoal-light mb-1.5">캡션</p>
                          <div className="bg-white/60 rounded-xl p-3 text-sm text-charcoal whitespace-pre-wrap leading-relaxed">
                            {s.caption}
                          </div>
                        </div>
                        {/* 해시태그 */}
                        <div>
                          <p className="text-xs font-medium text-charcoal-light mb-1.5">해시태그</p>
                          <div className="flex flex-wrap gap-1">
                            {s.hashtags.map((tag, ti) => (
                              <span key={ti} className="text-xs px-2 py-0.5 rounded-full bg-sage/10 text-sage-dark">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* 근거 */}
                        <div className="rounded-xl bg-amber-50/60 border border-amber-200/40 px-3 py-2.5">
                          <p className="text-xs font-medium text-amber-700 mb-1">추천 근거</p>
                          <p className="text-xs text-amber-700/80 leading-relaxed">{s.basis}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Row 2 — KPI 카드 4개 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="활성 매물"
              value={s.activeListings}
              unit="건"
              href="/listings"
              color="sage"
            />
            <KpiCard
              label="추적 벤치마크"
              value={s.benchmarkAccounts}
              unit="개"
              href="/benchmarks"
              color="blue"
            />
            <KpiCard
              label="Playbook"
              value={s.totalPlaybooks}
              unit="개"
              href="/benchmarks"
              color="purple"
            />
            <KpiCard
              label="이달 AI 비용"
              value={`$${s.thisMonthCost.toFixed(3)}`}
              href="/settings"
              color="neutral"
            />
          </div>

          {/* Row 3 — 제안 대기 + 탑 Playbook */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            <GlassCard className="lg:col-span-7">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-charcoal">미응답 제안</h2>
                <Link href="/listings" className="text-xs text-sage-dark hover:underline">
                  전체 보기
                </Link>
              </div>
              {s.recentProposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-charcoal-light/50 text-sm gap-2">
                  <span>대기 중인 제안이 없습니다</span>
                  <Link href="/listings/new" className="text-sage-dark text-xs hover:underline">
                    매물을 등록하고 AI 제안을 받으세요
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {s.recentProposals.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => router.push(`/listings/${p.id}`)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/50 border border-border-soft hover:bg-white/80 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-charcoal">{p.listing_title}</p>
                        <p className="text-xs text-charcoal-light mt-0.5">
                          {p.format}
                          {p.scheduled_at && (
                            <> · {new Date(p.scheduled_at).toLocaleDateString("ko-KR")}</>
                          )}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">
                        {STATUS_LABELS[p.user_status] ?? p.user_status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="lg:col-span-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-charcoal">Top Playbook</h2>
                <Link href="/benchmarks" className="text-xs text-sage-dark hover:underline">
                  전체 보기
                </Link>
              </div>
              {s.topPlaybooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-charcoal-light/50 text-sm gap-2">
                  <span>분석 완료 후 표시됩니다</span>
                  <Link href="/benchmarks/new" className="text-sage-dark text-xs hover:underline">
                    벤치마크 분석 시작
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {s.topPlaybooks.map((pb) => (
                    <Link key={pb.id} href={`/playbooks/${pb.id}`}>
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/50 border border-border-soft hover:bg-white/80 transition-colors">
                        <div>
                          <p className="text-xs text-charcoal-light/60 font-mono">{pb.code}</p>
                          <p className="text-sm font-medium text-charcoal">{pb.name}</p>
                        </div>
                        {pb.avg_engagement_rate != null && (
                          <span className="text-xs text-sage-dark font-medium shrink-0">
                            {(pb.avg_engagement_rate * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Row 4 — 이번 주 캘린더 */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-charcoal">이번 주 예정 포스팅</h2>
              <Link href="/calendar" className="text-xs text-sage-dark hover:underline">
                캘린더 전체 보기
              </Link>
            </div>
            {s.thisWeekCalendar.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-charcoal-light/50 text-sm gap-2">
                <span>이번 주 캘린더가 비어있습니다</span>
                <Link href="/calendar" className="text-sage-dark text-xs hover:underline">
                  AI 캘린더 생성하기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {s.thisWeekCalendar.map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border text-sm ${
                      CATEGORY_COLORS[item.category] ?? "bg-sage/5 text-charcoal border-border-soft"
                    }`}
                  >
                    <p className="text-xs opacity-70 mb-1">
                      {item.day} {new Date(item.date).getDate()}일
                    </p>
                    <p className="font-medium text-xs leading-snug line-clamp-2">{item.topic}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </main>
      </div>
    </AuthGuard>
  );
}

function KpiCard({
  label,
  value,
  unit,
  href,
  color,
}: {
  label: string;
  value: number | string;
  unit?: string;
  href: string;
  color: "sage" | "blue" | "purple" | "neutral";
}) {
  const colorMap = {
    sage: "text-sage-dark",
    blue: "text-blue-700",
    purple: "text-purple-700",
    neutral: "text-charcoal",
  };

  return (
    <Link href={href}>
      <GlassCard className="hover:shadow-glass hover:bg-white/70 transition-all cursor-pointer">
        <p className="text-xs text-charcoal-light mb-2">{label}</p>
        <p className={`text-3xl font-bold ${colorMap[color]}`}>
          {value}
          {unit && <span className="text-base font-medium ml-1">{unit}</span>}
        </p>
      </GlassCard>
    </Link>
  );
}
