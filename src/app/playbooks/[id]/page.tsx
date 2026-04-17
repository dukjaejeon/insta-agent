"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { ViralBadge } from "@/components/ui/ViralBadge";
import { RecommendBadge } from "@/components/ui/RecommendBadge";
import { TierTag } from "@/components/ui/TierTag";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Playbook = Database["public"]["Tables"]["playbooks"]["Row"];
type BenchmarkPost = Database["public"]["Tables"]["benchmark_posts"]["Row"];
type BenchmarkAccount = Database["public"]["Tables"]["benchmark_accounts"]["Row"];

const CATEGORY_LABELS: Record<string, string> = {
  listing: "매물 광고",
  market_info: "시세 정보",
  lifestyle: "라이프스타일",
  authority: "전문성",
  engagement: "인게이지먼트",
};

interface PlaybookVisual {
  composition?: string;
  color_palette?: string[];
  font_style?: string;
  hero_image_rule?: string;
  overlay_style?: string;
  checklist?: string[];
}

interface PlaybookCopy {
  hook_pattern?: string;
  hook_examples?: string[];
  body_structure?: string;
  cta_formula?: string;
  tone?: string;
  checklist?: string[];
}

interface PlaybookFormat {
  media_type?: string;
  slide_count?: number | string;
  caption_length?: string;
  hashtag_count?: number;
  checklist?: string[];
}

interface PlaybookHashtags {
  seed_tags?: string[];
  volume_tags?: string[];
  niche_tags?: string[];
  warning?: string;
}

interface PlaybookTiming {
  best_days?: string[];
  best_hours?: string;
  frequency?: string;
}

export default function PlaybookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playbookId = params.id as string;

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [account, setAccount] = useState<BenchmarkAccount | null>(null);
  const [evidencePosts, setEvidencePosts] = useState<BenchmarkPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "visual" | "copy" | "format" | "hashtags">("overview");

  // 콘텐츠 생성
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<{ caption: string; hashtags: string[]; tip: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const { data: pb } = await supabase
        .from("playbooks")
        .select("*")
        .eq("id", playbookId)
        .single();

      if (!pb) {
        setLoading(false);
        return;
      }
      setPlaybook(pb);

      const [accountRes, postsRes] = await Promise.all([
        pb.source_account_id
          ? supabase
              .from("benchmark_accounts")
              .select("*")
              .eq("id", pb.source_account_id)
              .single()
          : Promise.resolve({ data: null }),
        pb.evidence_post_ids && pb.evidence_post_ids.length > 0
          ? supabase
              .from("benchmark_posts")
              .select("*")
              .in("id", pb.evidence_post_ids)
          : Promise.resolve({ data: [] }),
      ]);

      setAccount(accountRes.data);
      setEvidencePosts(postsRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [playbookId]);

  const handleGenerate = async () => {
    if (!topic.trim() || !playbook) return;
    setGenerating(true);
    setResult(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("generate-post", {
        body: {
          playbook_id: playbookId,
          topic: topic.trim(),
          user_id: getCurrentUserId(),
        },
      });
      if (error) throw error;
      setResult(data as { caption: string; hashtags: string[]; tip: string });
    } catch (e) {
      console.error("캡션 생성 실패:", e);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `${result.caption}\n\n${result.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 무시 */ }
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

  if (!playbook) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-bg-primary">
          <Navigation />
          <div className="max-w-7xl mx-auto px-6 py-8">
            <p className="text-charcoal-light">Playbook을 찾을 수 없습니다.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const visual = (playbook.visual ?? {}) as PlaybookVisual;
  const copy = (playbook.copy ?? {}) as PlaybookCopy;
  const format = (playbook.format ?? {}) as PlaybookFormat;
  const hashtags = (playbook.hashtags ?? {}) as PlaybookHashtags;
  const timing = (playbook.timing ?? {}) as PlaybookTiming;

  const tabs = [
    { key: "overview", label: "개요" },
    { key: "visual", label: "비주얼" },
    { key: "copy", label: "카피" },
    { key: "format", label: "포맷" },
    { key: "hashtags", label: "해시태그" },
  ] as const;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* 브레드크럼 + 헤더 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 text-sm">
              <Link href="/benchmarks" className="text-charcoal-light hover:text-charcoal">
                벤치마크
              </Link>
              {account && (
                <>
                  <span className="text-charcoal-light/40">/</span>
                  <Link
                    href={`/benchmarks/${account.id}`}
                    className="text-charcoal-light hover:text-charcoal"
                  >
                    {account.handle}
                  </Link>
                </>
              )}
              <span className="text-charcoal-light/40">/</span>
              <span className="text-charcoal">{playbook.code}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="text-xs text-charcoal-light/60 font-mono mb-1">
                  {playbook.code}
                </p>
                <h1 className="text-2xl font-bold text-charcoal">{playbook.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  {playbook.category && (
                    <span className="px-2.5 py-1 rounded-full text-xs bg-sage/10 text-sage-dark">
                      {CATEGORY_LABELS[playbook.category] ?? playbook.category}
                    </span>
                  )}
                  {playbook.derived_from_viral && <ViralBadge />}
                  {playbook.is_recommended && <RecommendBadge />}
                  {playbook.avg_engagement_rate != null && (
                    <span className="text-sm text-sage-dark font-medium">
                      평균 참여율 {(playbook.avg_engagement_rate * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* 매물 적용 CTA */}
              <button
                type="button"
                onClick={() =>
                  router.push(`/listings/new?playbook_id=${playbookId}`)
                }
                className="px-5 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors flex items-center gap-2 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                이 공식으로 매물 적용
              </button>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-1 mb-6 border-b border-border-soft">
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

          {/* 탭 컨텐츠 */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* 복제 체크리스트 */}
              <GlassCard>
                <h2 className="text-base font-semibold text-charcoal mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sage/10 flex items-center justify-center text-sage text-xs">✓</span>
                  복제 체크리스트
                </h2>
                <div className="space-y-2">
                  {[
                    ...(visual.checklist ?? []).map((item) => ({ section: "비주얼", item })),
                    ...(copy.checklist ?? []).map((item) => ({ section: "카피", item })),
                    ...(format.checklist ?? []).map((item) => ({ section: "포맷", item })),
                  ].map((entry, i) => (
                    <ChecklistItem key={i} section={entry.section} text={entry.item} />
                  ))}
                  {visual.checklist?.length === 0 &&
                    copy.checklist?.length === 0 &&
                    format.checklist?.length === 0 && (
                      <p className="text-sm text-charcoal-light/60">체크리스트가 없습니다.</p>
                    )}
                </div>
              </GlassCard>

              {/* 적용 경고 */}
              {hashtags.warning && (
                <GlassCard>
                  <h2 className="text-base font-semibold text-amber-600 mb-3 flex items-center gap-2">
                    <span>⚠</span> 적용 시 주의사항
                  </h2>
                  <p className="text-sm text-charcoal">{hashtags.warning}</p>
                </GlassCard>
              )}

              {/* 타이밍 */}
              {timing && Object.keys(timing).length > 0 && (
                <GlassCard>
                  <h2 className="text-base font-semibold text-charcoal mb-3">최적 포스팅 타이밍</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {timing.best_days && timing.best_days.length > 0 && (
                      <div>
                        <p className="text-xs text-charcoal-light mb-1.5">최적 요일</p>
                        <div className="flex flex-wrap gap-1">
                          {timing.best_days.map((d) => (
                            <span key={d} className="px-2 py-0.5 rounded-full bg-sage/10 text-sage-dark text-xs">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {timing.best_hours && (
                      <div>
                        <p className="text-xs text-charcoal-light mb-1.5">최적 시간</p>
                        <p className="text-sm font-medium text-charcoal">{timing.best_hours}</p>
                      </div>
                    )}
                    {timing.frequency && (
                      <div>
                        <p className="text-xs text-charcoal-light mb-1.5">권장 빈도</p>
                        <p className="text-sm font-medium text-charcoal">{timing.frequency}</p>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}

              {/* 근거 게시물 */}
              {evidencePosts.length > 0 && (
                <GlassCard>
                  <h2 className="text-base font-semibold text-charcoal mb-4">
                    근거 게시물 ({evidencePosts.length}건)
                  </h2>
                  <div className="space-y-3">
                    {evidencePosts.map((post) => (
                      <EvidencePostCard key={post.id} post={post} />
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {activeTab === "visual" && (
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">비주얼 공식</h2>
              <div className="space-y-4">
                {visual.composition && (
                  <InfoRow label="구도" value={visual.composition} />
                )}
                {visual.hero_image_rule && (
                  <InfoRow label="메인 이미지 규칙" value={visual.hero_image_rule} />
                )}
                {visual.overlay_style && (
                  <InfoRow label="오버레이 스타일" value={visual.overlay_style} />
                )}
                {visual.font_style && (
                  <InfoRow label="폰트 스타일" value={visual.font_style} />
                )}
                {visual.color_palette && visual.color_palette.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-charcoal-light mb-2">컬러 팔레트</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {visual.color_palette.map((color, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div
                            className="w-6 h-6 rounded-full border border-border-soft"
                            style={{ backgroundColor: color.startsWith("#") ? color : undefined }}
                          />
                          <span className="text-xs text-charcoal-light">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {visual.checklist && visual.checklist.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-charcoal-light mb-2">비주얼 체크리스트</p>
                    <div className="space-y-1.5">
                      {visual.checklist.map((item, i) => (
                        <ChecklistItem key={i} text={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {activeTab === "copy" && (
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">카피 공식</h2>
              <div className="space-y-4">
                {copy.hook_pattern && (
                  <div>
                    <p className="text-xs font-medium text-charcoal-light mb-1.5">훅 패턴</p>
                    <div className="px-4 py-3 rounded-xl bg-sage/5 border border-sage/10">
                      <p className="text-sm text-charcoal font-medium">{copy.hook_pattern}</p>
                    </div>
                  </div>
                )}
                {copy.hook_examples && copy.hook_examples.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-charcoal-light mb-2">훅 예시</p>
                    <div className="space-y-2">
                      {copy.hook_examples.map((ex, i) => (
                        <div key={i} className="px-3 py-2 rounded-xl bg-white/60 border border-border-soft text-sm text-charcoal">
                          &ldquo;{ex}&rdquo;
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {copy.body_structure && (
                  <InfoRow label="본문 구조" value={copy.body_structure} />
                )}
                {copy.cta_formula && (
                  <InfoRow label="CTA 공식" value={copy.cta_formula} />
                )}
                {copy.tone && (
                  <InfoRow label="톤 앤 매너" value={copy.tone} />
                )}
                {copy.checklist && copy.checklist.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-charcoal-light mb-2">카피 체크리스트</p>
                    <div className="space-y-1.5">
                      {copy.checklist.map((item, i) => (
                        <ChecklistItem key={i} text={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {activeTab === "format" && (
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">포맷 공식</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {format.media_type && (
                    <StatCard label="미디어 타입" value={format.media_type} />
                  )}
                  {format.slide_count !== undefined && (
                    <StatCard label="슬라이드 수" value={String(format.slide_count)} />
                  )}
                  {format.caption_length && (
                    <StatCard label="캡션 길이" value={format.caption_length} />
                  )}
                  {format.hashtag_count !== undefined && (
                    <StatCard label="해시태그 수" value={String(format.hashtag_count)} />
                  )}
                </div>
                {format.checklist && format.checklist.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-charcoal-light mb-2">포맷 체크리스트</p>
                    <div className="space-y-1.5">
                      {format.checklist.map((item, i) => (
                        <ChecklistItem key={i} text={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {activeTab === "hashtags" && (
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">해시태그 전략</h2>
              {hashtags.warning && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    <span>⚠</span> {hashtags.warning}
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {hashtags.seed_tags && hashtags.seed_tags.length > 0 && (
                  <TagGroup label="시드 태그 (브랜드/틈새)" tags={hashtags.seed_tags} color="sage" />
                )}
                {hashtags.volume_tags && hashtags.volume_tags.length > 0 && (
                  <TagGroup label="볼륨 태그 (높은 노출)" tags={hashtags.volume_tags} color="blue" />
                )}
                {hashtags.niche_tags && hashtags.niche_tags.length > 0 && (
                  <TagGroup label="틈새 태그 (타겟팅)" tags={hashtags.niche_tags} color="purple" />
                )}
              </div>
            </GlassCard>
          )}

          {/* 콘텐츠 생성 — 항상 표시 */}
          <GlassCard>
            <h2 className="text-base font-semibold text-charcoal mb-1">콘텐츠 생성</h2>
            <p className="text-sm text-charcoal-light mb-4">
              이 Playbook 공식으로 즉시 사용 가능한 캡션을 생성합니다
            </p>

            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 광교 24평 오피스텔, 보증금 5000/월세 250, 즉시입주 가능"
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/50 text-charcoal placeholder-charcoal-light/50 text-sm resize-none focus:outline-none focus:border-sage/50 focus:ring-1 focus:ring-sage/20 mb-3"
            />

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  생성 중...
                </>
              ) : "캡션 생성"}
            </button>

            {result && (
              <div className="mt-5 space-y-3">
                {result.tip && (
                  <p className="text-xs text-sage-dark">
                    <span className="font-medium">공식 적용 이유: </span>{result.tip}
                  </p>
                )}

                <div className="p-4 rounded-2xl bg-white border border-border-soft">
                  <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                    {result.caption}
                  </p>
                </div>

                {result.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.hashtags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-full text-xs bg-sage/10 text-sage-dark"
                      >
                        #{tag.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-5 py-2 rounded-2xl border border-sage/30 text-sage-dark text-sm hover:bg-sage/5 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      복사됨!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                      복사
                    </>
                  )}
                </button>
              </div>
            )}
          </GlassCard>
        </main>
      </div>
    </AuthGuard>
  );
}

function ChecklistItem({
  text,
  section,
}: {
  text: string;
  section?: string;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="sr-only"
      />
      <div
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked
            ? "border-sage bg-sage"
            : "border-border-soft group-hover:border-sage/60"
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        {section && (
          <span className="text-xs text-charcoal-light/60 mr-2">[{section}]</span>
        )}
        <span className={`text-sm transition-colors ${checked ? "line-through text-charcoal-light/60" : "text-charcoal"}`}>
          {text}
        </span>
      </div>
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-charcoal-light mb-1">{label}</p>
      <p className="text-sm text-charcoal">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-sage/5 border border-sage/10 text-center">
      <p className="text-xs text-charcoal-light mb-1">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

function TagGroup({
  label,
  tags,
  color,
}: {
  label: string;
  tags: string[];
  color: "sage" | "blue" | "purple";
}) {
  const colorMap = {
    sage: "bg-sage-light/20 text-sage-dark",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div>
      <p className="text-xs font-medium text-charcoal-light mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span key={i} className={`px-2.5 py-1 rounded-full text-sm ${colorMap[color]}`}>
            #{tag.startsWith("#") ? tag.slice(1) : tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function EvidencePostCard({ post }: { post: BenchmarkPost }) {
  const tier = post.tier_manual_override ?? post.tier;
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/50 border border-border-soft">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {tier && <TierTag tier={tier as "viral" | "high_performer" | "standard"} />}
          {post.media_type && (
            <span className="text-xs text-charcoal-light/60">{post.media_type}</span>
          )}
        </div>
        {post.caption && (
          <p className="text-sm text-charcoal line-clamp-2 mb-2">{post.caption}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-charcoal-light/70">
          {post.like_count != null && (
            <span>❤ {post.like_count.toLocaleString()}</span>
          )}
          {post.comment_count != null && (
            <span>💬 {post.comment_count.toLocaleString()}</span>
          )}
          {post.view_count != null && (
            <span>👁 {post.view_count.toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
