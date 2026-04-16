"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { ExtractedPost } from "./Step3Review";

interface Step4Props {
  posts: ExtractedPost[];
  trackingCadence: string;
  onCadenceChange: (cadence: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step4Settings({
  posts,
  trackingCadence,
  onCadenceChange,
  onNext,
  onBack,
}: Step4Props) {
  const inScope = posts.filter((p) => p.within_scope);
  const viralCount = posts.filter((p) => p.is_viral_manual).length;

  // 비용: 게시물 수 기반 범위 표시 (Opus 4 기준 실제 요금)
  const costMin = inScope.length <= 5 ? 0.2 : inScope.length <= 15 ? 0.5 : 1.0;
  const costMax = inScope.length <= 5 ? 0.8 : inScope.length <= 15 ? 2.0 : 4.0;

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-6">
        Step 4. 분석 설정
      </h2>

      {/* AI 분석이 하는 일 안내 */}
      <div className="rounded-2xl bg-blue-50/60 border border-blue-200/50 p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          AI가 이렇게 분석합니다
        </h3>
        <ol className="text-sm text-blue-700/80 space-y-1 list-decimal list-inside">
          <li>입력한 게시물을 유형별로 분류 (매물·시세·라이프스타일 등)</li>
          <li>좋아요·댓글 수로 성과 순위 매기기</li>
          <li>바이럴 게시물의 공통 패턴 파악 (훅, 포맷, 시간대)</li>
          <li>성공 패턴을 재사용 가능한 <strong>Playbook</strong>으로 정리</li>
          <li>이 계정 특유의 말투·스타일 추출</li>
        </ol>
        <p className="text-xs text-blue-600/70 mt-2">
          수동으로 입력한 게시물도 동일하게 분석됩니다.
        </p>
      </div>

      {/* 분석 범위 요약 */}
      <div className="rounded-2xl bg-sage/5 border border-sage/10 p-4 mb-6">
        <h3 className="text-sm font-semibold text-charcoal mb-3">분석 범위</h3>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-charcoal-light text-xs mb-0.5">분석 대상</p>
            <p className="text-charcoal font-semibold text-lg">{inScope.length}<span className="text-sm font-normal text-charcoal-light ml-1">개</span></p>
          </div>
          <div>
            <p className="text-charcoal-light text-xs mb-0.5">바이럴 표시</p>
            <p className="text-charcoal font-semibold text-lg">{viralCount}<span className="text-sm font-normal text-charcoal-light ml-1">개</span></p>
          </div>
          <div>
            <p className="text-charcoal-light text-xs mb-0.5">범위 제외</p>
            <p className="text-charcoal font-semibold text-lg">{posts.length - inScope.length}<span className="text-sm font-normal text-charcoal-light ml-1">개</span></p>
          </div>
        </div>
      </div>

      {/* 재분석 주기 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-charcoal mb-1">재분석 주기</label>
        <p className="text-xs text-charcoal-light/70 mb-3">새 게시물이 쌓이면 주기적으로 재분석합니다</p>
        <div className="flex gap-2">
          {[
            { value: "weekly", label: "매주", desc: "활발한 계정" },
            { value: "monthly", label: "매월", desc: "보통" },
            { value: "manual", label: "직접 실행", desc: "필요할 때만" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onCadenceChange(opt.value)}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm transition-colors text-center ${
                trackingCadence === opt.value
                  ? "bg-sage text-white"
                  : "bg-white/60 text-charcoal-light border border-border-soft hover:bg-white/80"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className={`text-xs mt-0.5 ${trackingCadence === opt.value ? "text-white/70" : "text-charcoal-light/60"}`}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 예상 비용 */}
      <div className="rounded-2xl bg-amber-50/50 border border-amber-200/50 p-4 mb-6">
        <h3 className="text-sm font-semibold text-amber-700 mb-2">예상 비용</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-amber-700">${costMin}~${costMax}</span>
          <span className="text-sm text-amber-600">USD (1회 분석)</span>
        </div>
        <p className="text-xs text-amber-600/70 mt-1">
          게시물 {inScope.length}개 기준 · Claude AI API 요금 · 실제 비용은 내용 길이에 따라 다를 수 있음
        </p>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 rounded-2xl border border-border-soft text-charcoal-light font-medium hover:bg-white/80 transition-colors"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors"
        >
          분석 시작
        </button>
      </div>
    </GlassCard>
  );
}
