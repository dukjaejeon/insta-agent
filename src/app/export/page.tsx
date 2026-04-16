"use client";

import { useState } from "react";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";

type ExportTarget =
  | "benchmark_accounts"
  | "benchmark_posts"
  | "playbooks"
  | "proposals"
  | "analyses"
  | "llm_calls";

interface ExportConfig {
  key: ExportTarget;
  label: string;
  description: string;
  icon: string;
}

const EXPORT_TARGETS: ExportConfig[] = [
  {
    key: "benchmark_accounts",
    label: "벤치마크 계정",
    description: "분석한 경쟁 계정 목록 및 메타데이터",
    icon: "👤",
  },
  {
    key: "benchmark_posts",
    label: "벤치마크 게시물",
    description: "추출된 게시물 데이터 (OCR 결과 포함)",
    icon: "📸",
  },
  {
    key: "playbooks",
    label: "Playbook 라이브러리",
    description: "추출된 성공 공식 전체",
    icon: "📖",
  },
  {
    key: "proposals",
    label: "콘텐츠 제안",
    description: "AI가 생성한 매물 콘텐츠 제안 전체",
    icon: "✍️",
  },
  {
    key: "analyses",
    label: "분석 리포트",
    description: "벤치마크 분석 결과 요약",
    icon: "📊",
  },
  {
    key: "llm_calls",
    label: "LLM 호출 로그",
    description: "AI 사용 내역 및 비용 상세",
    icon: "💰",
  },
];

type ExportFormat = "csv" | "json";

export default function ExportPage() {
  const [selected, setSelected] = useState<Set<ExportTarget>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [exporting, setExporting] = useState(false);
  const [lastExported, setLastExported] = useState<string | null>(null);

  const toggleTarget = (key: ExportTarget) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(EXPORT_TARGETS.map((t) => t.key)));
  const clearAll = () => setSelected(new Set());

  const handleExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);

    const supabase = createClient();
    const user = { id: getCurrentUserId() };

    const exportData: Record<string, unknown[]> = {};

    for (const target of Array.from(selected)) {
      const { data } = await fetchTable(supabase, target, user.id);
      exportData[target] = data ?? [];
    }

    const timestamp = new Date().toISOString().split("T")[0];

    if (format === "json") {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, `insta-agent-export-${timestamp}.json`);
    } else {
      // CSV — 각 테이블별로 개별 파일 다운로드
      for (const [tableName, rows] of Object.entries(exportData)) {
        if (rows.length === 0) continue;
        const csv = toCSV(rows);
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }); // BOM for Korean
        downloadBlob(blob, `${tableName}-${timestamp}.csv`);
      }
    }

    setLastExported(new Date().toLocaleString("ko-KR"));
    setExporting(false);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-charcoal">데이터 내보내기</h1>
            <p className="text-sm text-charcoal-light mt-0.5">
              분석 결과와 콘텐츠 데이터를 CSV 또는 JSON으로 다운로드합니다
            </p>
          </div>

          {/* 포맷 선택 */}
          <GlassCard className="mb-4">
            <h2 className="text-sm font-semibold text-charcoal mb-3">내보내기 형식</h2>
            <div className="flex gap-3">
              <FormatButton
                value="csv"
                label="CSV"
                description="엑셀·구글 시트에서 바로 열 수 있음"
                selected={format === "csv"}
                onClick={() => setFormat("csv")}
              />
              <FormatButton
                value="json"
                label="JSON"
                description="개발자용, 전체 데이터 단일 파일"
                selected={format === "json"}
                onClick={() => setFormat("json")}
              />
            </div>
          </GlassCard>

          {/* 대상 선택 */}
          <GlassCard className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-charcoal">내보낼 데이터 선택</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-sage-dark hover:underline"
                >
                  전체 선택
                </button>
                <span className="text-charcoal-light/30">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-charcoal-light hover:underline"
                >
                  전체 해제
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXPORT_TARGETS.map((target) => (
                <button
                  key={target.key}
                  type="button"
                  onClick={() => toggleTarget(target.key)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                    selected.has(target.key)
                      ? "border-sage bg-sage/5 text-charcoal"
                      : "border-border-soft text-charcoal-light hover:bg-white/80"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      selected.has(target.key)
                        ? "border-sage bg-sage"
                        : "border-border-soft"
                    }`}
                  >
                    {selected.has(target.key) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {target.icon} {target.label}
                    </p>
                    <p className="text-xs text-charcoal-light/70 mt-0.5">{target.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* 다운로드 버튼 */}
          <div className="flex items-center justify-between">
            <div>
              {selected.size > 0 && (
                <p className="text-sm text-charcoal-light">
                  {selected.size}개 항목 선택됨
                  {format === "csv" ? ` → ${selected.size}개 CSV 파일` : " → 1개 JSON 파일"}
                </p>
              )}
              {lastExported && (
                <p className="text-xs text-charcoal-light/60 mt-0.5">
                  마지막 내보내기: {lastExported}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={selected.size === 0 || exporting}
              className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  내보내는 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  다운로드
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

function FormatButton({
  label,
  description,
  selected,
  onClick,
}: {
  value: ExportFormat;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 rounded-xl border text-left transition-colors ${
        selected
          ? "border-sage bg-sage/5 text-charcoal"
          : "border-border-soft text-charcoal-light hover:bg-white/80"
      }`}
    >
      <p className="text-sm font-bold">{label}</p>
      <p className="text-xs text-charcoal-light/70 mt-0.5">{description}</p>
    </button>
  );
}

// ============================================
// 헬퍼 함수
// ============================================

async function fetchTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient>,
  target: ExportTarget,
  userId: string
): Promise<{ data: unknown[] | null }> {
  switch (target) {
    case "benchmark_accounts":
      return supabase.from("benchmark_accounts").select("*").eq("user_id", userId);
    case "benchmark_posts":
      return supabase
        .from("benchmark_posts")
        .select("*")
        .in(
          "account_id",
          (
            await supabase
              .from("benchmark_accounts")
              .select("id")
              .eq("user_id", userId)
          ).data?.map((r) => r.id) ?? []
        );
    case "playbooks":
      return supabase.from("playbooks").select("*").eq("user_id", userId);
    case "proposals":
      return supabase
        .from("proposals")
        .select("*")
        .in(
          "listing_id",
          (
            await supabase
              .from("listings")
              .select("id")
              .eq("user_id", userId)
          ).data?.map((r) => r.id) ?? []
        );
    case "analyses":
      return supabase
        .from("analyses")
        .select("*")
        .in(
          "account_id",
          (
            await supabase
              .from("benchmark_accounts")
              .select("id")
              .eq("user_id", userId)
          ).data?.map((r) => r.id) ?? []
        );
    case "llm_calls":
      return supabase.from("llm_calls").select("*").order("created_at", { ascending: false }).limit(1000);
    default:
      return { data: [] };
  }
}

function toCSV(rows: unknown[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] as object);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = (row as Record<string, unknown>)[h];
          if (val === null || val === undefined) return "";
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          // CSV 이스케이프: 쉼표·개행·따옴표 포함 시 따옴표로 감싸기
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
