"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { OCRConfidenceTag } from "@/components/ui/OCRConfidenceTag";

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

  const inScopePosts = posts.filter((p) => p.within_scope);
  const outScopePosts = posts.filter((p) => !p.within_scope);

  if (posts.length === 0 && !ocrLoading) {
    return (
      <GlassCard padding="lg">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          Step 3. 확인 및 수정
        </h2>
        <div className="text-center py-8">
          <p className="text-charcoal-light mb-4">
            스크린샷에서 게시물 데이터를 추출합니다
          </p>
          <button
            type="button"
            onClick={onRunOcr}
            className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors"
          >
            OCR 분석 시작
          </button>
        </div>
      </GlassCard>
    );
  }

  if (ocrLoading) {
    return (
      <GlassCard padding="lg">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          Step 3. OCR 분석 중...
        </h2>
        <div className="flex flex-col items-center py-12">
          <div className="w-10 h-10 border-2 border-sage border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-charcoal-light text-sm">
            스크린샷을 분석하고 있습니다. 잠시만 기다려주세요...
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-2">
        Step 3. 확인 및 수정
      </h2>
      <p className="text-sm text-charcoal-light mb-6">
        추출된 {posts.length}건 중 최근 3개월 범위 {inScopePosts.length}건
        {outScopePosts.length > 0 && (
          <span className="text-charcoal-light/50">
            {" "}(범위 외 {outScopePosts.length}건 회색 표시)
          </span>
        )}
      </p>

      <div className="space-y-3">
        {posts.map((post, idx) => (
          <div
            key={post.temp_id}
            className={`border rounded-2xl overflow-hidden transition-colors ${
              post.within_scope
                ? "border-border-soft bg-white/40"
                : "border-gray-200 bg-gray-50/40 opacity-60"
            }`}
          >
            {/* 요약 행 */}
            <div
              className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-white/60 transition-colors"
              onClick={() =>
                setExpandedIdx(expandedIdx === idx ? null : idx)
              }
            >
              <span className="text-xs font-mono text-charcoal-light w-8">
                #{idx + 1}
              </span>
              <span className="text-sm font-medium text-charcoal w-20">
                {post.media_type === "carousel"
                  ? `캐러셀 ${post.slide_count}장`
                  : post.media_type === "reel"
                    ? "릴스"
                    : "사진"}
              </span>
              <span className="text-sm text-charcoal-light flex-1 truncate">
                {post.caption?.slice(0, 60) || "(캡션 없음)"}
              </span>
              <span className="text-xs text-charcoal-light">
                {post.like_count != null && `${post.like_count.toLocaleString()}`}
              </span>
              {post.needs_review_fields.length > 0 && (
                <OCRConfidenceTag
                  confidence={post.confidence}
                  fieldName={post.needs_review_fields.join(", ")}
                />
              )}
              {/* Viral 수동 태그 */}
              <label
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={post.is_viral_manual}
                  onChange={(e) =>
                    updatePost(idx, { is_viral_manual: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-border-soft text-red-500 focus:ring-red-300"
                />
                <span className="text-xs text-red-500 font-medium">
                  터짐
                </span>
              </label>
              <svg
                className={`w-4 h-4 text-charcoal-light transition-transform ${
                  expandedIdx === idx ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            {/* 확장 편집 */}
            {expandedIdx === idx && (
              <div className="px-5 py-4 border-t border-border-soft bg-white/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-charcoal-light mb-1">
                      캡션
                    </label>
                    <textarea
                      value={post.caption}
                      onChange={(e) =>
                        updatePost(idx, { caption: e.target.value })
                      }
                      rows={4}
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal-light mb-1">
                      좋아요
                    </label>
                    <input
                      type="number"
                      value={post.like_count ?? ""}
                      onChange={(e) =>
                        updatePost(idx, {
                          like_count: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal-light mb-1">
                      댓글
                    </label>
                    <input
                      type="number"
                      value={post.comment_count ?? ""}
                      onChange={(e) =>
                        updatePost(idx, {
                          comment_count: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </div>
                  {post.media_type === "reel" && (
                    <div>
                      <label className="block text-xs font-medium text-charcoal-light mb-1">
                        조회수
                      </label>
                      <input
                        type="number"
                        value={post.view_count ?? ""}
                        onChange={(e) =>
                          updatePost(idx, {
                            view_count: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-charcoal-light mb-1">
                      미디어 타입
                    </label>
                    <select
                      value={post.media_type}
                      onChange={(e) =>
                        updatePost(idx, {
                          media_type: e.target.value as "photo" | "carousel" | "reel",
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/80 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                    >
                      <option value="photo">사진</option>
                      <option value="carousel">캐러셀</option>
                      <option value="reel">릴스</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={post.is_from_highlight}
                        onChange={(e) =>
                          updatePost(idx, {
                            is_from_highlight: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border-soft text-sage focus:ring-sage/30"
                      />
                      <span className="text-sm text-charcoal">
                        하이라이트 게시물
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between">
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
          다음: 분석 설정
        </button>
      </div>
    </GlassCard>
  );
}
