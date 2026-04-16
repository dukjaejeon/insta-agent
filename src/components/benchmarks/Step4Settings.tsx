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
  const viralManual = posts.filter((p) => p.is_viral_manual);
  const highlights = posts.filter((p) => p.is_from_highlight);

  // 비용 추정 (스펙 섹션 2.5 기반)
  const estimatedViralCount = Math.max(viralManual.length, highlights.length, Math.ceil(inScope.length * 0.1));
  const estimatedCost = (
    2.0 + // 분류·랭킹 기본
    estimatedViralCount * 4.0 + // Viral 부검
    inScope.length * 0.3 + // 분해
    3.0 + // Playbook 합성
    1.5 + // 톤 프로파일
    0.5 // 리포트
  ).toFixed(1);

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-6">
        Step 4. 분석 설정
      </h2>

      {/* 분석 범위 요약 */}
      <div className="rounded-2xl bg-sage/5 border border-sage/10 p-5 mb-6">
        <h3 className="text-sm font-semibold text-charcoal mb-3">
          분석 범위 요약
        </h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-charcoal-light">전체 게시물</span>
          <span className="text-charcoal font-medium">{posts.length}건</span>
          <span className="text-charcoal-light">최근 3개월 범위</span>
          <span className="text-charcoal font-medium">{inScope.length}건</span>
          <span className="text-charcoal-light">수동 Viral 태그</span>
          <span className="text-charcoal font-medium">{viralManual.length}건</span>
          <span className="text-charcoal-light">하이라이트 게시물</span>
          <span className="text-charcoal font-medium">{highlights.length}건</span>
        </div>
      </div>

      {/* 재분석 주기 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-charcoal mb-2">
          재분석 주기
        </label>
        <div className="flex gap-3">
          {[
            { value: "weekly", label: "매주" },
            { value: "monthly", label: "매월" },
            { value: "manual", label: "수동" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onCadenceChange(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                trackingCadence === opt.value
                  ? "bg-sage text-white"
                  : "bg-white/60 text-charcoal-light border border-border-soft hover:bg-white/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 예상 비용 */}
      <div className="rounded-2xl bg-amber-50/50 border border-amber-200/50 p-5 mb-6">
        <h3 className="text-sm font-semibold text-amber-700 mb-2">
          예상 비용 및 소요 시간
        </h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-amber-600">예상 API 비용</span>
          <span className="text-amber-700 font-medium">~${estimatedCost}</span>
          <span className="text-amber-600">예상 소요 시간</span>
          <span className="text-amber-700 font-medium">3~8분</span>
          <span className="text-amber-600">예상 Viral 부검 대상</span>
          <span className="text-amber-700 font-medium">~{estimatedViralCount}건</span>
        </div>
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
