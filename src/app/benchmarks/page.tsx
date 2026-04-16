"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type BenchmarkAccount =
  Database["public"]["Tables"]["benchmark_accounts"]["Row"];

export default function BenchmarksPage() {
  const [accounts, setAccounts] = useState<BenchmarkAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("benchmark_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      setAccounts(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-charcoal">벤치마크 계정</h1>
            <Link
              href="/benchmarks/new"
              className="px-5 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors"
            >
              새 벤치마크 추가
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <GlassCard className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sage/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-sage"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-charcoal mb-2">
                아직 추적 중인 벤치마크가 없습니다
              </h2>
              <p className="text-sm text-charcoal-light mb-6">
                닮고 싶은 인스타그램 계정을 추가해 분석을 시작하세요
              </p>
              <Link
                href="/benchmarks/new"
                className="inline-flex px-5 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors"
              >
                첫 벤치마크 추가하기
              </Link>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((account) => (
                <Link key={account.id} href={`/benchmarks/${account.id}`}>
                  <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-charcoal">
                          {account.handle}
                        </h3>
                        {account.display_name && (
                          <p className="text-sm text-charcoal-light">
                            {account.display_name}
                          </p>
                        )}
                      </div>
                      {account.is_niche_account && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sage-light/30 text-sage-dark">
                          니치
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-charcoal-light">
                      {account.follower_count != null && (
                        <span>팔로워 {account.follower_count.toLocaleString()}</span>
                      )}
                      {account.post_count != null && (
                        <span>게시물 {account.post_count}</span>
                      )}
                    </div>
                    {account.last_analyzed_at && (
                      <p className="text-xs text-charcoal-light/60 mt-3">
                        마지막 분석:{" "}
                        {new Date(account.last_analyzed_at).toLocaleDateString("ko-KR")}
                      </p>
                    )}
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
