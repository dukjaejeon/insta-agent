"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

export interface ExtractedPost {
  temp_id: string;
  media_type: "photo" | "carousel" | "reel";
  slide_count: number;
  caption: string;
  hashtags: string[];
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  posted_relative: string;
  posted_at: string | null;
  top_comments: Array<{ author: string; text: string }>;
  confidence: number;
  needs_review_fields: string[];
  is_viral_manual: boolean;
  is_from_highlight: boolean;
  within_scope: boolean;
  screenshot_paths: string[];
}

interface Step3Props {
  posts: ExtractedPost[];
  onPostsChange: (posts: ExtractedPost[]) => void;
  ocrLoading: boolean;
  onRunOcr: () => void;
  onNext: () => void;
  onBack: () => void;
}

function newEmptyPost(): ExtractedPost {
  return {
    temp_id: `manual-${Date.now()}-${Math.random()}`,
    media_type: "photo",
    slide_count: 1,
    caption: "",
    hashtags: [],
    like_count: null,
    comment_count: null,
    view_count: null,
    posted_relative: "",
    posted_at: null,
    top_comments: [],
    confidence: 1,
    needs_review_fields: [],
    is_viral_manual: false,
    is_from_highlight: false,
    within_scope: true,
    screenshot_paths: [],
  };
}

export function Step3Review({
  posts,
  onPostsChange,
  ocrLoading,
  onRunOcr,
  onNext,
  onBack,
}: Step3Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const updatePost = (idx: number, updates: Partial<ExtractedPost>) => {
    const updated = [...posts];
    updated[idx] = { ...updated[idx], ...updates };
    onPostsChange(updated);
  };

  const addPost = () => {
    const updated = [...posts, newEmptyPost()];
    onPostsChange(updated);
    setExpandedIdx(updated.length - 1);
  };

  const removePost = (idx: number) => {
    const updated = posts.filter((_, i) => i !== idx);
    onPostsChange(updated);
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const inScopePosts = posts.filter((p) => p.within_scope);

  if (ocrLoading) {
    return (
      <GlassCard padding="lg">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          Step 3. 게시물 입력
        </h2>
        <div className="flex flex-col items-center py-12">
          <div className="w-10 h-10 border-2 border-sage border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-charcoal-light text-sm">분석 중...</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-charcoal">
          Step 3. 게시물 입력
        </h2>
        <button
          type="button"
          onClick={onRunOcr}
          className="text-xs text-sage-dark hover:underline"
        >
          AI 자동 추출 시도
        </button>
      </div>
      <p className="text-sm text-charcoal-light mb-6">
        경쟁 계정의 게시물 정보를 입력해 주세요. {posts.length > 0 && `${posts.length}개 입력됨`}
      </p>

      {/* 게시물 목록 */}
      <div className="space-y-3 mb-4">
        {posts.map((post, idx) => (
          <div
            key={post.temp_id}
            className="border rounded-2xl overflow-hidden border-border-soft bg-white/40"
          >
            {/* 요약 행 */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/60 transition-colors"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <span className="text-xs font-mono text-charcoal-light w-6">
                #{idx + 1}
              </span>
              <span className="text-sm font-medium text-charcoal w-16 shrink-0">
                {post.media_type === "carousel"
                  ? `슬라이드 ${post.slide_count}장`
                  : post.media_type === "reel"
                  ? "릴스"
                  : "사진"}
              </span>
              <span className="text-sm text-charcoal-light flex-1 truncate">
                {post.caption || "(캡션 없음)"}
              </span>
              <span className="text-xs text-charcoal-light shrink-0">
                {post.like_count != null ? `❤️ ${post.like_count.toLocaleString()}` : ""}
              </span>
              <label
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={post.is_viral_manual}
                  onChange={(e) => updatePost(idx, { is_viral_manual: e.target.checked })}
                  className="w-4 h-4 rounded text-red-500"
                />
                <span className="text-xs text-red-500 font-medium">대박</span>
              </label>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removePost(idx); }}
                className="text-xs text-charcoal-light/40 hover:text-red-400 transition-colors px-1"
              >
                ✕
              </button>
              <svg
                className={`w-4 h-4 text-charcoal-light transition-transform shrink-0 ${expandedIdx === idx ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* 확장 편집 */}
            {expandedIdx === idx && (
              <div className="px-4 py-4 border-t border-border-soft bg-white/30">
                <div className="grid grid-cols-2 gap-3">
                  {/* 미디어 타입 */}
                  <div>
                    <label className="block text-xs font-medium text-charcoal-light mb-1">게시물 형식</label>
                    <select
                      value={post.media_type}
                      onChange={(e) => updatePost(idx, { media_type: e.target.value as "photo" | "carousel" | "reel" })}
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                    >
                      <option value="photo">사진</option>
                      <option value="carousel">슬라이드 (여러 장)</option>
                      <option value="reel">릴스 (동영상)</option>
                    </select>
                  </div>

                  {/* 슬라이드 수 */}
                  {post.media_type === "carousel" && (
                    <div>
                      <label className="block text-xs font-medium text-charcoal-light mb-1">슬라이드 수</label>
                      <input
                        type="number"
                        value={post.slide_count}
                        onChange={(e) => updatePost(idx, { slide_count: Number(e.target.value) || 1 })}
                        min={2} max={10}
                        className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                      />
                    </div>
                  )}

                  {/* 좋아요 */}
                  <div>
                    <label className="block text-xs font-medium text-charcoal-light mb-1">좋아요 수</label>
                    <input
                      type="number"
                      value={post.like_count ?? ""}
                      onChange={(e) => updatePost(idx, { like_count: e.target.value ? Number(e.target.value) : null })}
                      placeholder="예: 245"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </div>

                  {/* 댓글 */}
                  <div>
                    <label className="block text-xs font-medium text-charcoal-light mb-1">댓글 수</label>
                    <input
                      type="number"
                      value={post.comment_count ?? ""}
                      onChange={(e) => updatePost(idx, { comment_count: e.target.value ? Number(e.target.value) : null })}
                      placeholder="예: 12"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </div>

                  {/* 조회수 (릴스) */}
                  {post.media_type === "reel" && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-charcoal-light mb-1">조회수</label>
                      <input
                        type="number"
                        value={post.view_count ?? ""}
                        onChange={(e) => updatePost(idx, { view_count: e.target.value ? Number(e.target.value) : null })}
                        placeholder="예: 3200"
                        className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                      />
                    </div>
                  )}

                  {/* 캡션 */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-charcoal-light mb-1">캡션 (게시글 내용)</label>
                    <textarea
                      value={post.caption}
                      onChange={(e) => updatePost(idx, { caption: e.target.value })}
                      rows={3}
                      placeholder="인스타그램 게시물 내용을 입력하세요"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 resize-none"
                    />
                  </div>

                  {/* 게시 시기 */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-charcoal-light mb-1">게시 시기</label>
                    <select
                      value={post.posted_relative}
                      onChange={(e) => updatePost(idx, { posted_relative: e.target.value, within_scope: !e.target.value.includes("4개월") && !e.target.value.includes("5개월") && !e.target.value.includes("6개월") && !e.target.value.includes("년") })}
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                    >
                      <option value="">선택</option>
                      <option value="1주일 전">1주일 전</option>
                      <option value="2주일 전">2주일 전</option>
                      <option value="1개월 전">1개월 전</option>
                      <option value="2개월 전">2개월 전</option>
                      <option value="3개월 전">3개월 전</option>
                      <option value="4개월 전">4개월 전 (분석 제외)</option>
                      <option value="6개월 전">6개월 전 (분석 제외)</option>
                      <option value="1년 전">1년 전 (분석 제외)</option>
                    </select>
                  </div>

                  {/* 하이라이트 */}
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={post.is_from_highlight}
                        onChange={(e) => updatePost(idx, { is_from_highlight: e.target.checked })}
                        className="w-4 h-4 rounded text-sage"
                      />
                      <span className="text-sm text-charcoal">하이라이트 게시물</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 게시물 추가 버튼 */}
      <button
        type="button"
        onClick={addPost}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-border-soft text-charcoal-light hover:border-sage/40 hover:text-sage transition-colors text-sm flex items-center justify-center gap-2 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        게시물 추가
      </button>

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
          disabled={inScopePosts.length === 0}
          className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음: 분석 설정 ({inScopePosts.length}개)
        </button>
      </div>
    </GlassCard>
  );
}
