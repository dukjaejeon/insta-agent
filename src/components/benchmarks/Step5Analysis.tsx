"use client";

import { GlassCard } from "@/components/ui/GlassCard";

interface AnalysisStage {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
}

interface Step5Props {
  stages: AnalysisStage[];
  analysisStatus: "idle" | "running" | "completed" | "failed";
  errorMessage: string | null;
  onViewReport: () => void;
  onBack?: () => void;
}

const defaultStages: AnalysisStage[] = [
  { key: "classify", label: "게시물 분류", status: "pending" },
  { key: "rank", label: "성과 랭킹 및 Tier 배정", status: "pending" },
  { key: "autopsy", label: "Viral 부검", status: "pending" },
  { key: "decompose", label: "게시물 분해 분석", status: "pending" },
  { key: "synthesize", label: "Playbook 합성", status: "pending" },
  { key: "voice", label: "톤 프로파일 추출", status: "pending" },
  { key: "report", label: "리포트 생성", status: "pending" },
];

export { defaultStages };

export function Step5Analysis({
  stages,
  analysisStatus,
  errorMessage,
  onViewReport,
  onBack,
}: Step5Props) {
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progress = (completedCount / stages.length) * 100;

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-6">
        Step 5. 분석 실행
      </h2>

      {/* 진행률 바 */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-charcoal-light">
            {analysisStatus === "completed"
              ? "분석 완료"
              : analysisStatus === "failed"
                ? "분석 실패"
                : "분석 진행 중..."}
          </span>
          <span className="text-charcoal font-medium">
            {completedCount}/{stages.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-sage-light/20 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              analysisStatus === "failed" ? "bg-red-400" : "bg-sage"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 단계별 체크리스트 */}
      <div className="space-y-3">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/40"
          >
            {stage.status === "completed" ? (
              <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : stage.status === "running" ? (
              <div className="w-6 h-6 border-2 border-sage border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : stage.status === "failed" ? (
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-border-soft flex-shrink-0" />
            )}
            <span
              className={`text-sm ${
                stage.status === "completed"
                  ? "text-charcoal"
                  : stage.status === "running"
                    ? "text-sage-dark font-medium"
                    : stage.status === "failed"
                      ? "text-red-500"
                      : "text-charcoal-light"
              }`}
            >
              {stage.label}
            </span>
          </div>
        ))}
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* 실패 시 뒤로가기 */}
      {analysisStatus === "failed" && onBack && (
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2.5 rounded-2xl border border-border-soft text-charcoal-light font-medium hover:bg-white/80 transition-colors"
          >
            ← 설정으로 돌아가기
          </button>
        </div>
      )}

      {/* 완료 버튼 */}
      {analysisStatus === "completed" && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={onViewReport}
            className="px-8 py-3 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors"
          >
            분석 리포트 보기
          </button>
        </div>
      )}
    </GlassCard>
  );
}
