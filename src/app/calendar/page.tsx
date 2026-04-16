"use client";

import { useEffect, useState, useCallback } from "react";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/client";

interface CalendarPost {
  time: string;
  category: string;
  playbook_code: string | null;
  listing_id: string | null;
  topic: string;
  hook: string;
  format: string;
  estimated_reach: "low" | "medium" | "high";
}

interface CalendarDay {
  date: string;
  day: string;
  posts: CalendarPost[];
}

interface CalendarPlan {
  week_start: string;
  total_posts: number;
  strategy_summary: string;
  days: CalendarDay[];
}

const CATEGORY_COLORS: Record<string, string> = {
  listing: "bg-sage/10 text-sage-dark border-sage/20",
  market_info: "bg-blue-50 text-blue-700 border-blue-200/40",
  lifestyle: "bg-amber-50 text-amber-700 border-amber-200/40",
  authority: "bg-purple-50 text-purple-700 border-purple-200/40",
  engagement: "bg-pink-50 text-pink-700 border-pink-200/40",
};

const CATEGORY_LABELS: Record<string, string> = {
  listing: "매물",
  market_info: "시세",
  lifestyle: "라이프",
  authority: "전문성",
  engagement: "인게이지",
};

const REACH_COLORS = {
  high: "text-sage-dark",
  medium: "text-amber-600",
  low: "text-charcoal-light/60",
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekStart(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(() => getMonday(new Date()));
  const [calendarPlan, setCalendarPlan] = useState<CalendarPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const weekStart = formatWeekStart(currentWeek);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("content_calendar")
      .select("*")
      .eq("week_start", weekStart)
      .single();

    setCalendarPlan(data?.plan as CalendarPlan | null);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const handleGenerate = async () => {
    setGenerating(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("generate-calendar", {
      body: { week_start: weekStart },
    });

    if (!error && data?.plan) {
      setCalendarPlan(data.plan as CalendarPlan);
    } else {
      console.error("캘린더 생성 실패:", error);
    }
    setGenerating(false);
  };

  const weekLabel = `${currentWeek.getMonth() + 1}월 ${currentWeek.getDate()}일 주`;

  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* 헤더 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-charcoal">콘텐츠 캘린더</h1>
              <p className="text-sm text-charcoal-light mt-0.5">
                AI가 이번 주 최적 포스팅 일정을 설계합니다
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="self-start sm:self-auto px-4 sm:px-5 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {calendarPlan ? "재생성" : "AI 캘린더 생성"}
                </>
              )}
            </button>
          </div>

          {/* 주간 네비게이션 */}
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={prevWeek}
              className="w-9 h-9 rounded-xl border border-border-soft flex items-center justify-center text-charcoal-light hover:bg-white/80 transition-colors shrink-0"
            >
              ←
            </button>
            <h2 className="text-base font-semibold text-charcoal text-center flex-1 sm:flex-none sm:w-36">{weekLabel}</h2>
            <button
              type="button"
              onClick={nextWeek}
              className="w-9 h-9 rounded-xl border border-border-soft flex items-center justify-center text-charcoal-light hover:bg-white/80 transition-colors shrink-0"
            >
              →
            </button>
            {calendarPlan?.total_posts != null && (
              <span className="text-sm text-charcoal-light hidden sm:inline">
                총 {calendarPlan.total_posts}개
              </span>
            )}
          </div>

          {calendarPlan?.strategy_summary && (
            <GlassCard className="mb-6">
              <p className="text-sm text-charcoal">
                <span className="font-medium text-sage-dark">이번 주 전략:</span>{" "}
                {calendarPlan.strategy_summary}
              </p>
            </GlassCard>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !calendarPlan ? (
            <GlassCard className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-charcoal mb-2">캘린더가 없습니다</h2>
              <p className="text-sm text-charcoal-light mb-6">
                &ldquo;AI 캘린더 생성&rdquo;을 눌러 이번 주 콘텐츠 계획을 만들어보세요
              </p>
            </GlassCard>
          ) : (
            /* 모바일: 가로 스크롤 / 데스크톱: 7열 그리드 */
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="grid grid-cols-7 gap-2 sm:gap-3 min-w-[560px]">
                {calendarPlan.days.map((day) => (
                  <div key={day.date} className="space-y-2">
                    {/* 날짜 헤더 */}
                    <div className="text-center">
                      <p className="text-xs font-medium text-charcoal-light">{day.day}</p>
                      <p className="text-sm font-semibold text-charcoal">
                        {new Date(day.date).getDate()}
                      </p>
                    </div>

                    {/* 포스팅 카드 */}
                    <div className="space-y-2 min-h-[80px]">
                      {day.posts.length === 0 ? (
                        <div className="h-16 rounded-xl border border-dashed border-border-soft flex items-center justify-center">
                          <span className="text-xs text-charcoal-light/40">휴식</span>
                        </div>
                      ) : (
                        day.posts.map((post, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded-xl border text-left ${
                              CATEGORY_COLORS[post.category] ?? "bg-sage/5 text-charcoal border-border-soft"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate">
                                {CATEGORY_LABELS[post.category] ?? post.category}
                              </span>
                              <span className="text-xs opacity-60 shrink-0 ml-1">{post.time}</span>
                            </div>
                            <p className="text-xs leading-tight line-clamp-2">{post.topic}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs opacity-60">{post.format}</span>
                              <span className={`text-xs ${REACH_COLORS[post.estimated_reach]}`}>
                                {post.estimated_reach === "high" ? "↑↑" : post.estimated_reach === "medium" ? "↑" : "→"}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
