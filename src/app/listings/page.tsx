"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Listing = Database["public"]["Tables"]["listings"]["Row"];

const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  sold: "거래 완료",
  hidden: "숨김",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-sage/10 text-sage-dark",
  sold: "bg-charcoal/10 text-charcoal-light",
  hidden: "bg-red-50 text-red-500",
};

export default function ListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });
      setListings(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-charcoal">매물 관리</h1>
              <p className="text-sm text-charcoal-light mt-0.5">
                매물을 등록하고 인스타그램 콘텐츠 제안을 받으세요
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/listings/new")}
              className="px-5 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              새 매물 등록
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
            </div>
          ) : listings.length === 0 ? (
            <GlassCard className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-charcoal mb-2">등록된 매물이 없습니다</h2>
              <p className="text-sm text-charcoal-light mb-6">
                첫 매물을 등록하고 AI 콘텐츠 제안을 받아보세요
              </p>
              <Link
                href="/listings/new"
                className="inline-flex px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors"
              >
                첫 매물 등록하기
              </Link>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <GlassCard className="hover:shadow-glass hover:bg-white/70 transition-all cursor-pointer h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-charcoal truncate">
                          {listing.title ?? (`${listing.complex_name ?? ""} ${listing.dong ?? ""}`.trim() || "매물")}
                        </h3>
                        <p className="text-sm text-charcoal-light mt-0.5">
                          {[listing.district, listing.dong, listing.complex_name]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ml-2 shrink-0 ${
                          STATUS_COLORS[listing.status] ?? "bg-sage/10 text-sage-dark"
                        }`}
                      >
                        {STATUS_LABELS[listing.status] ?? listing.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal-light">
                      {listing.size_pyeong != null && (
                        <span>{listing.size_pyeong}평</span>
                      )}
                      {listing.floor != null && (
                        <span>{listing.floor}층</span>
                      )}
                      {listing.direction && <span>{listing.direction}</span>}
                    </div>

                    {listing.price_info && (
                      <div className="mt-3 pt-3 border-t border-border-soft">
                        <PriceDisplay priceInfo={listing.price_info as Record<string, unknown>} />
                      </div>
                    )}

                    <p className="text-xs text-charcoal-light/50 mt-3">
                      {new Date(listing.created_at).toLocaleDateString("ko-KR")}
                    </p>
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

function PriceDisplay({ priceInfo }: { priceInfo: Record<string, unknown> }) {
  const type = priceInfo.type as string;
  if (type === "sale") {
    return (
      <p className="text-sm font-medium text-charcoal">
        매매 {formatPrice(priceInfo.sale_price as number)}
      </p>
    );
  }
  if (type === "jeonse") {
    return (
      <p className="text-sm font-medium text-charcoal">
        전세 {formatPrice(priceInfo.jeonse_price as number)}
      </p>
    );
  }
  if (type === "monthly") {
    return (
      <p className="text-sm font-medium text-charcoal">
        월세 {formatPrice(priceInfo.deposit as number)} / {formatPrice(priceInfo.monthly as number)}
      </p>
    );
  }
  return null;
}

function formatPrice(amount: number): string {
  if (!amount) return "—";
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000);
    const man = amount % 10000;
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`;
  }
  return `${amount.toLocaleString()}만`;
}
