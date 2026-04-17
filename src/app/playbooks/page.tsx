"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { ViralBadge } from "@/components/ui/ViralBadge";
import { RecommendBadge } from "@/components/ui/RecommendBadge";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Playbook = Database["public"]["Tables"]["playbooks"]["Row"];
type BenchmarkAccount = Database["public"]["Tables"]["benchmark_accounts"]["Row"];

const CATEGORY_LABELS: Record<string, string> = {
  listing: "매물 광고",
  market_info: "시세 정보",
  lifestyle: "라이프스타일",
  authority: "전문성",
  engagement: "인게이지먼트",
};

export default function PlaybooksPage() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [accounts, setAccounts] = useState<Record<string, BenchmarkAccount>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();

      // Playbook 전체 로드
      let pbData: Playbook[] = [];
      try {
        const { data } = await supabase
          .from("playbooks")
          .select("*")
          .order("created_at", { ascending: false });
        pbData = data ?? [];
        setPlaybooks(pbData);
      } catch { /* 무시 */ }

      // benchmark_accounts 로드
      try {
        const { data } = await supabase
          .from("benchmark_accounts")
          .select("*");
        const accountMap: Record<string, BenchmarkAccount> = {};
        for (const acc of data ?? []) {
          accountMap[acc.id] = acc;
        }
        setAccounts(accountMap);
      } catch { /* 무시 */ }

      setLoading(false);
    };
    load();
  }, []);

  // source_account_id 별로 그룹화
  const grouped: Record<string, Playbook[]> = {};
  const noAccountGroup: Playbook[] = [];

  for (const pb of playbooks) {
    if (pb.source_account_id) {
      if (!grouped[pb.source_account_id]) grouped[pb.source_account_id] = [];
      grouped[pb.source_account_id].push(pb);
    } else {
      noAccountGroup.push(pb);
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-charcoal">Playbook 라이브러리</h1>
            <p className="text-sm text-charcoal-light mt-0.5">
              벤치마크 분석에서 추출된 콘텐츠 공식 모음
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
            </div>
          ) : playbooks.length === 0 ? (
            <GlassCard className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-charcoal mb-2">아직 Playbook이 없습니다</h2>
              <p className="text-sm text-charcoal-light">
                벤치마크 계정을 분석하면 자동으로 생성됩니다.
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-8">
              {/* 계정별 섹션 */}
              {Object.entries(grouped).map(([accountId, pbs]) => {
                const acc = accounts[accountId];
                return (
                  <section key={accountId}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-sage/15 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-sage-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-charcoal">
                          {acc?.handle ?? accountId}
                        </h2>
                        {acc?.display_name && (
                          <p className="text-xs text-charcoal-light">{acc.display_name}</p>
                        )}
                      </div>
                      <span className="ml-auto text-xs text-charcoal-light/60">
                        {pbs.length}개
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {pbs.map((pb) => (
                        <PlaybookCard
                          key={pb.id}
                          playbook={pb}
                          onClick={() => router.push(`/playbooks/${pb.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              {/* 계정 없는 Playbook */}
              {noAccountGroup.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-semibold text-charcoal">기타</h2>
                    <span className="ml-auto text-xs text-charcoal-light/60">
                      {noAccountGroup.length}개
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {noAccountGroup.map((pb) => (
                      <PlaybookCard
                        key={pb.id}
                        playbook={pb}
                        onClick={() => router.push(`/playbooks/${pb.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function PlaybookCard({
  playbook,
  onClick,
}: {
  playbook: Playbook;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full"
    >
      <GlassCard className="hover:shadow-glass hover:bg-white/70 transition-all cursor-pointer h-full">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs text-charcoal-light/60 font-mono truncate">
              {playbook.code}
            </p>
            <h3 className="font-semibold text-charcoal leading-snug mt-0.5">
              {playbook.name}
            </h3>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            {playbook.derived_from_viral && <ViralBadge />}
            {playbook.is_recommended && <RecommendBadge />}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-2">
          {playbook.category && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-sage/10 text-sage-dark">
              {CATEGORY_LABELS[playbook.category] ?? playbook.category}
            </span>
          )}
          {playbook.avg_engagement_rate != null && (
            <span className="text-xs text-charcoal-light">
              참여율 {(playbook.avg_engagement_rate * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </GlassCard>
    </button>
  );
}
