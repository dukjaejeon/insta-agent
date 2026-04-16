"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { OverlayPreview } from "@/components/listings/OverlayPreview";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Listing = Database["public"]["Tables"]["listings"]["Row"];
type Proposal = Database["public"]["Tables"]["proposals"]["Row"];
type PlaybookSummary = Pick<
  Database["public"]["Tables"]["playbooks"]["Row"],
  "id" | "code" | "name" | "category" | "is_recommended" | "avg_engagement_rate"
>;

interface ShootingGuide {
  angles?: string[];
  lighting?: string;
  props?: string[];
  timing?: string;
  notes?: string;
}

interface CarouselPlan {
  slides?: Array<{ order: number; title: string; body: string; visual_note?: string }>;
  cover_caption?: string;
}

interface ReelScript {
  hook_text?: string;
  scenes?: Array<{ duration: string; action: string; text_overlay?: string }>;
  background_music?: string;
  caption?: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  sold: "거래 완료",
  hidden: "숨김",
};

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = params.id as string;
  const autoPropose = searchParams.get("propose") === "true";
  const defaultPlaybookId = searchParams.get("playbook_id");

  const [listing, setListing] = useState<Listing | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [activeTab, setActiveTab] = useState<"caption" | "shooting" | "carousel" | "reel" | "schedule">("caption");
  const [editedCaption, setEditedCaption] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [listingRes, proposalsRes, playbooksRes] = await Promise.all([
      supabase.from("listings").select("*").eq("id", listingId).single(),
      supabase
        .from("proposals")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false }),
      supabase.from("playbooks").select("id, code, name, category, is_recommended, avg_engagement_rate").order("created_at", { ascending: false }),
    ]);

    setListing(listingRes.data);
    const props = proposalsRes.data ?? [];
    setProposals(props);
    if (props.length > 0) setSelectedProposal(props[0]);
    setPlaybooks(playbooksRes.data ?? []);
    setLoading(false);
  }, [listingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedProposal?.caption) {
      setEditedCaption(selectedProposal.caption);
    }
  }, [selectedProposal]);

  const handlePropose = useCallback(
    async (playbookId?: string) => {
      setProposing(true);
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("match-and-propose", {
        body: {
          listing_id: listingId,
          playbook_id: playbookId ?? null,
        },
      });

      if (error) {
        console.error("제안 생성 실패:", error);
        setProposing(false);
        return;
      }

      if (data?.proposal_id) {
        await loadData();
      }
      setProposing(false);
    },
    [listingId, loadData]
  );

  useEffect(() => {
    if (autoPropose && !loading && proposals.length === 0) {
      handlePropose(defaultPlaybookId ?? undefined);
    }
  }, [autoPropose, loading, proposals.length, handlePropose, defaultPlaybookId]);

  const handleSaveCaption = async () => {
    if (!selectedProposal) return;
    const supabase = createClient();
    await supabase
      .from("proposals")
      .update({
        caption: editedCaption,
        user_edits: { ...(selectedProposal.user_edits as object ?? {}), caption: editedCaption },
      })
      .eq("id", selectedProposal.id);
    setSelectedProposal((prev) => prev ? { ...prev, caption: editedCaption } : null);
  };

  const handleStatusChange = async (status: string) => {
    if (!listing) return;
    const supabase = createClient();
    await supabase.from("listings").update({ status }).eq("id", listingId);
    setListing((prev) => prev ? { ...prev, status } : null);
  };

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

  if (!listing) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-bg-primary">
          <Navigation />
          <div className="max-w-7xl mx-auto px-6 py-8">
            <p className="text-charcoal-light">매물을 찾을 수 없습니다.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const priceInfo = listing.price_info as Record<string, unknown> | null;
  const shootingGuide = selectedProposal?.shooting_guide as ShootingGuide | null;
  const carouselPlan = selectedProposal?.carousel_plan as CarouselPlan | null;
  const reelScript = selectedProposal?.reel_script as ReelScript | null;

  const tabs = [
    { key: "caption", label: "캡션" },
    { key: "shooting", label: "촬영 가이드" },
    { key: "carousel", label: "캐러셀" },
    { key: "reel", label: "릴스 스크립트" },
    { key: "schedule", label: "일정" },
  ] as const;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* 헤더 */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1 text-sm">
                <Link href="/listings" className="text-charcoal-light hover:text-charcoal">
                  매물
                </Link>
                <span className="text-charcoal-light/40">/</span>
                <span className="text-charcoal">
                  {listing.title ?? listing.complex_name ?? "매물 상세"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-charcoal">
                {listing.title ?? (`${listing.complex_name ?? ""} ${listing.dong ?? ""}`.trim() || "매물 상세")}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-sm text-charcoal-light">
                  {[listing.district, listing.dong, listing.complex_name].filter(Boolean).join(" · ")}
                </p>
                {listing.size_pyeong && <span className="text-sm text-charcoal-light">{listing.size_pyeong}평</span>}
                {listing.floor && <span className="text-sm text-charcoal-light">{listing.floor}층</span>}
                {listing.direction && <span className="text-sm text-charcoal-light">{listing.direction}</span>}
              </div>
              {priceInfo && (
                <p className="text-base font-semibold text-sage-dark mt-1">
                  <PriceText priceInfo={priceInfo} />
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={listing.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border-soft bg-white/60 text-sm text-charcoal focus:outline-none"
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => router.push(`/listings/${listingId}/edit`)}
                className="px-4 py-1.5 rounded-xl border border-border-soft text-sm text-charcoal-light hover:bg-white/80 transition-colors"
              >
                수정
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 왼쪽: 제안 목록 + 콘텐츠 탭 */}
            <div className="lg:col-span-2 space-y-4">
              {/* 제안 선택 / 생성 */}
              <GlassCard>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-charcoal">콘텐츠 제안</h2>
                  <button
                    type="button"
                    onClick={() => handlePropose()}
                    disabled={proposing}
                    className="px-4 py-1.5 rounded-xl bg-sage text-white text-sm font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {proposing ? (
                      <>
                        <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        AI 제안 생성 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        새 제안 생성
                      </>
                    )}
                  </button>
                </div>

                {proposals.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {proposals.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProposal(p)}
                        className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                          selectedProposal?.id === p.id
                            ? "bg-sage text-white"
                            : "border border-border-soft text-charcoal-light hover:bg-white/80"
                        }`}
                      >
                        제안 #{i + 1}
                        {p.match_score != null && (
                          <span className="ml-1 text-xs opacity-70">
                            ({Math.round(p.match_score * 100)}%)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-charcoal-light/60">
                    아직 생성된 제안이 없습니다. &ldquo;새 제안 생성&rdquo;을 클릭하세요.
                  </p>
                )}

                {selectedProposal?.match_reasoning && (
                  <div className="mt-3 pt-3 border-t border-border-soft">
                    <p className="text-xs text-charcoal-light mb-1">매칭 이유</p>
                    <p className="text-sm text-charcoal">{selectedProposal.match_reasoning}</p>
                    {selectedProposal.match_risks && selectedProposal.match_risks.length > 0 && (
                      <div className="mt-2">
                        {selectedProposal.match_risks.map((risk, i) => (
                          <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                            <span>⚠</span> {risk}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>

              {selectedProposal && (
                <>
                  {/* 탭 */}
                  <div className="flex gap-1 border-b border-border-soft">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-t-xl -mb-px ${
                          activeTab === tab.key
                            ? "text-sage-dark border-b-2 border-sage-dark bg-sage/5"
                            : "text-charcoal-light hover:text-charcoal"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* 탭 내용 */}
                  {activeTab === "caption" && (
                    <GlassCard>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-charcoal">캡션 편집</h3>
                        <button
                          type="button"
                          onClick={handleSaveCaption}
                          className="text-xs px-3 py-1.5 rounded-xl bg-sage/10 text-sage-dark hover:bg-sage/20 transition-colors"
                        >
                          저장
                        </button>
                      </div>
                      <textarea
                        value={editedCaption}
                        onChange={(e) => setEditedCaption(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30 resize-none"
                      />
                      {selectedProposal.hashtags && selectedProposal.hashtags.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-charcoal-light mb-2">추천 해시태그</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedProposal.hashtags.map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full bg-sage-light/20 text-sage-dark text-xs">
                                #{tag.startsWith("#") ? tag.slice(1) : tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  )}

                  {activeTab === "shooting" && (
                    <GlassCard>
                      <h3 className="text-sm font-semibold text-charcoal mb-4">촬영 가이드</h3>
                      {shootingGuide ? (
                        <div className="space-y-4">
                          {shootingGuide.lighting && (
                            <div>
                              <p className="text-xs font-medium text-charcoal-light mb-1">조명</p>
                              <p className="text-sm text-charcoal">{shootingGuide.lighting}</p>
                            </div>
                          )}
                          {shootingGuide.timing && (
                            <div>
                              <p className="text-xs font-medium text-charcoal-light mb-1">촬영 시간</p>
                              <p className="text-sm text-charcoal">{shootingGuide.timing}</p>
                            </div>
                          )}
                          {shootingGuide.angles && shootingGuide.angles.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-charcoal-light mb-2">앵글</p>
                              <ul className="space-y-1.5">
                                {shootingGuide.angles.map((angle, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-charcoal">
                                    <span className="text-sage mt-0.5 shrink-0">📷</span>
                                    {angle}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {shootingGuide.props && shootingGuide.props.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-charcoal-light mb-2">소품</p>
                              <div className="flex flex-wrap gap-2">
                                {shootingGuide.props.map((prop, i) => (
                                  <span key={i} className="px-2.5 py-1 rounded-full bg-white/60 border border-border-soft text-sm text-charcoal">
                                    {prop}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {shootingGuide.notes && (
                            <div className="px-4 py-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
                              <p className="text-xs font-medium text-amber-700 mb-1">주의사항</p>
                              <p className="text-sm text-amber-800">{shootingGuide.notes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-charcoal-light/60">촬영 가이드 데이터가 없습니다.</p>
                      )}
                    </GlassCard>
                  )}

                  {activeTab === "carousel" && (
                    <GlassCard>
                      <h3 className="text-sm font-semibold text-charcoal mb-4">캐러셀 플랜</h3>
                      {carouselPlan ? (
                        <div className="space-y-3">
                          {carouselPlan.cover_caption && (
                            <div className="px-4 py-3 rounded-xl bg-sage/5 border border-sage/10">
                              <p className="text-xs font-medium text-charcoal-light mb-1">커버 캡션</p>
                              <p className="text-sm text-charcoal font-medium">{carouselPlan.cover_caption}</p>
                            </div>
                          )}
                          {carouselPlan.slides && carouselPlan.slides.length > 0 && (
                            <div className="space-y-2">
                              {carouselPlan.slides.map((slide) => (
                                <div key={slide.order} className="p-4 rounded-2xl bg-white/50 border border-border-soft">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="w-6 h-6 rounded-full bg-sage text-white text-xs flex items-center justify-center font-bold shrink-0">
                                      {slide.order}
                                    </span>
                                    <p className="text-sm font-semibold text-charcoal">{slide.title}</p>
                                  </div>
                                  <p className="text-sm text-charcoal-light ml-8">{slide.body}</p>
                                  {slide.visual_note && (
                                    <p className="text-xs text-sage-dark/70 ml-8 mt-1">🎨 {slide.visual_note}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-charcoal-light/60">캐러셀 플랜 데이터가 없습니다.</p>
                      )}
                    </GlassCard>
                  )}

                  {activeTab === "reel" && (
                    <GlassCard>
                      <h3 className="text-sm font-semibold text-charcoal mb-4">릴스 스크립트</h3>
                      {reelScript ? (
                        <div className="space-y-4">
                          {reelScript.hook_text && (
                            <div className="px-4 py-3 rounded-xl bg-red-50/40 border border-red-200/40">
                              <p className="text-xs font-medium text-red-500 mb-1">오프닝 훅</p>
                              <p className="text-sm text-charcoal font-medium">&ldquo;{reelScript.hook_text}&rdquo;</p>
                            </div>
                          )}
                          {reelScript.scenes && reelScript.scenes.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-charcoal-light mb-2">씬 구성</p>
                              <div className="space-y-2">
                                {reelScript.scenes.map((scene, i) => (
                                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/50 border border-border-soft">
                                    <span className="text-xs text-charcoal-light/60 w-12 shrink-0 pt-0.5">{scene.duration}</span>
                                    <div>
                                      <p className="text-sm text-charcoal">{scene.action}</p>
                                      {scene.text_overlay && (
                                        <p className="text-xs text-sage-dark mt-1">텍스트: &ldquo;{scene.text_overlay}&rdquo;</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {reelScript.background_music && (
                            <div>
                              <p className="text-xs font-medium text-charcoal-light mb-1">배경음악</p>
                              <p className="text-sm text-charcoal">🎵 {reelScript.background_music}</p>
                            </div>
                          )}
                          {reelScript.caption && (
                            <div>
                              <p className="text-xs font-medium text-charcoal-light mb-1">릴스 캡션</p>
                              <p className="text-sm text-charcoal whitespace-pre-wrap">{reelScript.caption}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-charcoal-light/60">릴스 스크립트 데이터가 없습니다.</p>
                      )}
                    </GlassCard>
                  )}

                  {activeTab === "schedule" && (
                    <GlassCard>
                      <h3 className="text-sm font-semibold text-charcoal mb-4">포스팅 일정</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-charcoal-light mb-1">예정 일시</p>
                          {selectedProposal.scheduled_at ? (
                            <p className="text-sm text-charcoal">
                              {new Date(selectedProposal.scheduled_at).toLocaleString("ko-KR")}
                            </p>
                          ) : (
                            <p className="text-sm text-charcoal-light/60">미정</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-charcoal-light mb-1">상태</p>
                          <StatusSelect
                            value={selectedProposal.user_status}
                            proposalId={selectedProposal.id}
                            onUpdate={(status) =>
                              setSelectedProposal((prev) => prev ? { ...prev, user_status: status } : null)
                            }
                          />
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </>
              )}
            </div>

            {/* 오른쪽: 오버레이 프리뷰 */}
            <div className="space-y-4">
              <GlassCard>
                <h2 className="text-base font-semibold text-charcoal mb-3">오버레이 프리뷰</h2>
                <OverlayPreview
                  config={{
                    headline: listing.title ?? listing.complex_name ?? "매물",
                    subtext: [listing.district, listing.dong].filter(Boolean).join(" "),
                    priceText: priceInfo ? getPriceShort(priceInfo) : undefined,
                    locationText: [listing.dong, listing.complex_name].filter(Boolean).join(" "),
                    overlayStyle: "gradient",
                  }}
                />
              </GlassCard>

              {/* Playbook 적용 */}
              {playbooks.length > 0 && (
                <GlassCard>
                  <h2 className="text-base font-semibold text-charcoal mb-3">Playbook으로 제안</h2>
                  <div className="space-y-2">
                    {playbooks.slice(0, 5).map((pb) => (
                      <button
                        key={pb.id}
                        type="button"
                        onClick={() => handlePropose(pb.id)}
                        disabled={proposing}
                        className="w-full text-left px-3 py-2.5 rounded-xl border border-border-soft hover:bg-sage/5 transition-colors disabled:opacity-50"
                      >
                        <p className="text-xs text-charcoal-light/60 font-mono">{pb.code}</p>
                        <p className="text-sm font-medium text-charcoal">{pb.name}</p>
                        {pb.avg_engagement_rate != null && (
                          <p className="text-xs text-sage-dark">
                            참여율 {(pb.avg_engagement_rate * 100).toFixed(1)}%
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

function PriceText({ priceInfo }: { priceInfo: Record<string, unknown> }) {
  const type = priceInfo.type as string;
  if (type === "sale") return <>{formatPrice(priceInfo.sale_price as number)} 매매</>;
  if (type === "jeonse") return <>{formatPrice(priceInfo.jeonse_price as number)} 전세</>;
  return <>{formatPrice(priceInfo.deposit as number)} / {formatPrice(priceInfo.monthly as number)} 월세</>;
}

function getPriceShort(priceInfo: Record<string, unknown>): string {
  const type = priceInfo.type as string;
  if (type === "sale") return formatPrice(priceInfo.sale_price as number);
  if (type === "jeonse") return `전세 ${formatPrice(priceInfo.jeonse_price as number)}`;
  return `월세 ${formatPrice(priceInfo.monthly as number)}`;
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

function StatusSelect({
  value,
  proposalId,
  onUpdate,
}: {
  value: string;
  proposalId: string;
  onUpdate: (status: string) => void;
}) {
  const STATUS_OPTIONS = [
    { value: "pending", label: "대기" },
    { value: "approved", label: "승인" },
    { value: "posted", label: "게시 완료" },
    { value: "rejected", label: "반려" },
  ];

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    const supabase = createClient();
    await supabase.from("proposals").update({ user_status: newStatus }).eq("id", proposalId);
    onUpdate(newStatus);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      className="px-3 py-1.5 rounded-xl border border-border-soft bg-white/60 text-sm text-charcoal focus:outline-none"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
